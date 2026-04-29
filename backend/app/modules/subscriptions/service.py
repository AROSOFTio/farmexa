from __future__ import annotations

import json
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.tenant import (
    BillingCycle,
    BillingInvoice,
    BillingPayment,
    ModulePrice,
    ModuleRequestStatus,
    PaymentCallbackLog,
    PaymentStatus,
    PlatformModule,
    SubscriptionHistory,
    Tenant,
    TenantModule,
    TenantModuleRequest,
    TenantModuleRequestItem,
)
from app.models.user import User
from app.utils.audit import write_audit_log

from .schemas import ModuleUpgradeRequestCreate, PaymentCallbackIn


class SubscriptionUpgradeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_tenant(self, user: User) -> Tenant:
        if not user.tenant_id:
            raise HTTPException(status_code=403, detail="Your account is not assigned to a tenant.")
        result = await self.db.execute(
            select(Tenant)
            .where(Tenant.id == user.tenant_id)
            .options(
                selectinload(Tenant.modules),
                selectinload(Tenant.module_requests)
                .selectinload(TenantModuleRequest.items),
                selectinload(Tenant.module_requests)
                .selectinload(TenantModuleRequest.invoice),
            )
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found.")
        return tenant

    @staticmethod
    def _coerce_billing_cycle(value: str) -> BillingCycle:
        try:
            return BillingCycle(value)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid billing cycle.") from exc

    async def get_overview(self, user: User) -> dict:
        tenant = await self._get_tenant(user)
        modules_result = await self.db.execute(
            select(PlatformModule).where(PlatformModule.is_active.is_(True)).order_by(PlatformModule.category, PlatformModule.name)
        )
        prices_result = await self.db.execute(
            select(ModulePrice).where(ModulePrice.billing_cycle == tenant.billing_cycle)
        )
        price_map = {price.module_key: price for price in prices_result.scalars().all()}
        enabled_modules = sorted(module.module_key for module in tenant.modules if module.is_enabled)
        catalog = [
            {
                "key": module.key,
                "name": module.name,
                "category": module.category,
                "description": module.description,
                "is_core": module.is_core,
                "is_enabled": module.key in enabled_modules,
                "monthly_price": price_map.get(module.key).price if price_map.get(module.key) else None,
                "currency": price_map.get(module.key).currency if price_map.get(module.key) else "UGX",
            }
            for module in modules_result.scalars().all()
        ]
        requests = sorted(tenant.module_requests, key=lambda item: item.created_at, reverse=True)
        return {
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "current_plan": tenant.plan.value if hasattr(tenant.plan, "value") else str(tenant.plan),
            "billing_cycle": tenant.billing_cycle.value if hasattr(tenant.billing_cycle, "value") else str(tenant.billing_cycle),
            "enabled_modules": enabled_modules,
            "catalog": catalog,
            "requests": requests,
        }

    async def create_request(self, user: User, payload: ModuleUpgradeRequestCreate) -> TenantModuleRequest:
        tenant = await self._get_tenant(user)
        requested_keys = list(dict.fromkeys(payload.module_keys))
        enabled_modules = {module.module_key for module in tenant.modules if module.is_enabled}
        if any(key in enabled_modules for key in requested_keys):
            duplicate = next(key for key in requested_keys if key in enabled_modules)
            raise HTTPException(status_code=409, detail=f"Module '{duplicate}' is already enabled for this tenant.")

        blocking_request = next(
            (
                request
                for request in tenant.module_requests
                if request.status in {ModuleRequestStatus.PENDING_PAYMENT, ModuleRequestStatus.PAID}
            ),
            None,
        )
        if blocking_request:
            raise HTTPException(status_code=409, detail="There is already an upgrade request waiting for payment or activation.")

        modules_result = await self.db.execute(
            select(PlatformModule).where(PlatformModule.key.in_(requested_keys), PlatformModule.is_active.is_(True))
        )
        modules = {module.key: module for module in modules_result.scalars().all()}
        missing = [key for key in requested_keys if key not in modules]
        if missing:
            raise HTTPException(status_code=404, detail=f"Unknown module(s): {', '.join(missing)}")

        core_modules = [module.key for module in modules.values() if module.is_core]
        if core_modules:
            raise HTTPException(
                status_code=409,
                detail=f"Core module(s) cannot be upgraded through tenant self-service: {', '.join(core_modules)}",
            )

        billing_cycle = self._coerce_billing_cycle(payload.billing_cycle or tenant.billing_cycle.value)
        prices_result = await self.db.execute(
            select(ModulePrice).where(
                ModulePrice.module_key.in_(requested_keys),
                ModulePrice.billing_cycle == billing_cycle,
            )
        )
        price_map = {price.module_key: price for price in prices_result.scalars().all()}
        unpriced = [key for key in requested_keys if key not in price_map]
        if unpriced:
            raise HTTPException(
                status_code=409,
                detail=f"No pricing is configured for module(s): {', '.join(unpriced)}",
            )
        currency = next((price.currency for price in price_map.values()), "UGX")
        total_amount = sum(float(price_map.get(key).price or 0) for key in requested_keys)

        request = TenantModuleRequest(
            tenant_id=tenant.id,
            requested_by_user_id=user.id,
            status=ModuleRequestStatus.PENDING_PAYMENT,
            billing_cycle=billing_cycle,
            total_amount=total_amount,
            currency=currency,
            notes=payload.notes,
        )
        self.db.add(request)
        await self.db.flush()

        for module_key in requested_keys:
            price = price_map.get(module_key)
            self.db.add(
                TenantModuleRequestItem(
                    request_id=request.id,
                    module_key=module_key,
                    price=float(price.price) if price else 0,
                    currency=price.currency if price else currency,
                )
            )

        invoice = BillingInvoice(
            tenant_id=tenant.id,
            request_id=request.id,
            invoice_number=f"SUB-{uuid.uuid4().hex[:10].upper()}",
            amount=total_amount,
            currency=currency,
            status=PaymentStatus.PENDING,
            due_date=date.today() + timedelta(days=7),
            payment_reference=f"PAY-{uuid.uuid4().hex[:10].upper()}",
            payment_url=None,
            notes="Tenant module upgrade payment",
        )
        self.db.add(invoice)
        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant.id,
                changed_by_user_id=user.id,
                event_type="module_request",
                notes=f"Pending payment for modules: {', '.join(requested_keys)}",
            )
        )
        await write_audit_log(
            self.db,
            user_id=user.id,
            action="CREATE",
            entity="tenant_module_request",
            entity_id=request.id,
            meta={
                "tenant_id": tenant.id,
                "module_keys": requested_keys,
                "total_amount": total_amount,
                "currency": currency,
                "billing_cycle": billing_cycle.value,
            },
        )
        await self.db.commit()

        refreshed = await self.db.execute(
            select(TenantModuleRequest)
            .where(TenantModuleRequest.id == request.id)
            .options(
                selectinload(TenantModuleRequest.items),
                selectinload(TenantModuleRequest.invoice),
            )
        )
        return refreshed.scalar_one()

    async def process_payment_callback(self, payload: PaymentCallbackIn, source_ip: str | None, callback_secret: str | None) -> None:
        expected_secret = settings.PAYMENT_CALLBACK_SECRET
        if expected_secret and callback_secret != expected_secret:
            raise HTTPException(status_code=403, detail="Invalid payment callback secret.")

        invoice_result = await self.db.execute(
            select(BillingInvoice)
            .where(BillingInvoice.invoice_number == payload.invoice_number)
            .options(selectinload(BillingInvoice.request).selectinload(TenantModuleRequest.items))
        )
        invoice = invoice_result.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found.")

        normalized_status = payload.status.lower()
        if normalized_status not in {"pending", "successful", "failed", "cancelled"}:
            raise HTTPException(status_code=422, detail="Invalid payment callback status.")

        callback_log = PaymentCallbackLog(
            tenant_id=invoice.tenant_id,
            invoice_id=invoice.id,
            event_type="module_upgrade_payment",
            status=PaymentStatus(normalized_status),
            source_ip=source_ip,
            payload=json.dumps(payload.model_dump(mode="json"), default=str),
            processed_at=datetime.now(UTC),
        )
        self.db.add(callback_log)

        payment = BillingPayment(
            tenant_id=invoice.tenant_id,
            invoice_id=invoice.id,
            amount=float(payload.amount if payload.amount is not None else invoice.amount),
            currency=payload.currency or invoice.currency,
            status=PaymentStatus(normalized_status),
            provider=payload.provider,
            reference=payload.reference or invoice.payment_reference,
            paid_at=datetime.now(UTC) if normalized_status == "successful" else None,
            raw_response=json.dumps(payload.payload or {}, default=str),
        )
        self.db.add(payment)

        invoice.status = PaymentStatus(normalized_status)
        if normalized_status == "successful":
            invoice.paid_at = datetime.now(UTC)
            request = invoice.request
            request.status = ModuleRequestStatus.ACTIVATED
            request.paid_at = datetime.now(UTC)
            request.activated_at = datetime.now(UTC)
            for item in request.items:
                module_result = await self.db.execute(
                    select(TenantModule).where(
                        TenantModule.tenant_id == invoice.tenant_id,
                        TenantModule.module_key == item.module_key,
                    )
                )
                tenant_module = module_result.scalar_one_or_none()
                if tenant_module:
                    tenant_module.is_enabled = True
                else:
                    self.db.add(TenantModule(tenant_id=invoice.tenant_id, module_key=item.module_key, is_enabled=True))
            self.db.add(
                SubscriptionHistory(
                    tenant_id=invoice.tenant_id,
                    changed_by_user_id=None,
                    event_type="module_upgrade_activated",
                    notes=f"Activated modules from invoice {invoice.invoice_number}",
                )
            )
        elif normalized_status == "failed":
            invoice.request.status = ModuleRequestStatus.REJECTED
        elif normalized_status == "cancelled":
            invoice.request.status = ModuleRequestStatus.CANCELLED
        else:
            invoice.request.status = ModuleRequestStatus.PENDING_PAYMENT

        await self.db.commit()
