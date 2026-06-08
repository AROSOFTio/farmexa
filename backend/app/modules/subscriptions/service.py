from __future__ import annotations

import json
import uuid
import secrets
import socket
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.tenant import (
    BillingCycle,
    BillingInvoice,
    BillingPayment,
    DomainRequestStatus,
    ModulePrice,
    ModuleRequestStatus,
    PaymentCallbackLog,
    PaymentStatus,
    PlatformModule,
    SubscriptionHistory,
    Tenant,
    TenantDomain,
    TenantDomainRequest,
    TenantDomainRequestMessage,
    TenantModule,
    TenantModuleRequest,
    TenantModuleRequestItem,
    DomainStatus,
    DomainType,
)
from app.models.settings import SystemSettings
from app.models.user import User
from app.services.email_service import branded_email_html, log_and_send_email
from app.services.pesapal_service import PesapalService, PesapalStatusResult
from app.utils.audit import write_audit_log
from app.utils.domains import normalize_host, tenant_domain_suffix, verify_domain_points_to_target

from .schemas import CustomDomainRequestCreate, ModuleUpgradeRequestCreate, PaymentCallbackIn


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
                selectinload(Tenant.domain_requests)
                .selectinload(TenantDomainRequest.invoice),
                selectinload(Tenant.domain_requests)
                .selectinload(TenantDomainRequest.messages),
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

    async def _get_system_settings(self) -> SystemSettings:
        result = await self.db.execute(select(SystemSettings).order_by(SystemSettings.id).limit(1))
        settings_row = result.scalar_one_or_none()
        if settings_row:
            return settings_row
        settings_row = SystemSettings(
            platform_domain=settings.PRIMARY_PLATFORM_DOMAIN,
            tenant_domain_suffix=tenant_domain_suffix(),
            sender_email=settings.SMTP_FROM_EMAIL or "farmexa@arosoftlabs.com",
            sender_name=settings.SMTP_FROM_NAME,
            support_email=settings.SMTP_FROM_EMAIL or "farmexa@arosoftlabs.com",
            cloudflare_api_token=settings.CLOUDFLARE_API_TOKEN,
            cloudflare_zone_id=settings.CLOUDFLARE_ZONE_ID,
            tenant_domain_target_ip=settings.TENANT_DNS_TARGET_VALUE or settings.TENANT_DOMAIN_TARGET_IP,
            enable_cloudflare_dns_automation=settings.ENABLE_CLOUDFLARE_DNS_AUTOMATION,
            enable_automatic_ssl_provisioning=settings.ENABLE_AUTOMATIC_SSL_PROVISIONING,
            pesapal_consumer_key=settings.PESAPAL_CONSUMER_KEY,
            pesapal_consumer_secret=settings.PESAPAL_CONSUMER_SECRET,
            pesapal_environment=settings.PESAPAL_ENVIRONMENT,
            pesapal_ipn_id=settings.PESAPAL_IPN_ID,
            pesapal_ipn_url=settings.PESAPAL_IPN_URL,
            custom_domain_annual_price=settings.CUSTOM_DOMAIN_ANNUAL_PRICE,
            custom_domain_currency=settings.CUSTOM_DOMAIN_CURRENCY,
        )
        self.db.add(settings_row)
        await self.db.flush()
        return settings_row

    @staticmethod
    def _clean_host(host: str) -> str:
        value = host.strip().lower()
        value = value.removeprefix("https://").removeprefix("http://")
        value = value.split("/", 1)[0].strip()
        return normalize_host(value) or ""

    @staticmethod
    def _allowed_custom_domain(host: str) -> bool:
        return host.endswith(".com") or host.endswith(".org") or host.endswith(".co")

    def _dns_instruction(self, host: str, system_settings: SystemSettings) -> tuple[str, str, str]:
        platform_domain = getattr(system_settings, "platform_domain", None) or settings.PRIMARY_PLATFORM_DOMAIN
        target_ip = (
            getattr(system_settings, "tenant_domain_target_ip", None)
            or settings.TENANT_DNS_TARGET_VALUE
            or settings.TENANT_DOMAIN_TARGET_IP
        )
        if host.count(".") >= 2:
            return "CNAME", host, platform_domain
        if not target_ip:
            raise HTTPException(status_code=409, detail="A target IP is required before apex custom domains can be requested.")
        return "A", host, target_ip

    async def _ensure_domain_not_taken(self, tenant: Tenant, host: str) -> None:
        domain_conflict = await self.db.execute(
            select(TenantDomain).where(
                TenantDomain.normalized_host == host,
                TenantDomain.tenant_id != tenant.id,
            )
        )
        if domain_conflict.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="That domain is already assigned to another tenant.")

        request_conflict = await self.db.execute(
            select(TenantDomainRequest).where(
                TenantDomainRequest.normalized_host == host,
                TenantDomainRequest.tenant_id != tenant.id,
                TenantDomainRequest.status.notin_(
                    [DomainRequestStatus.REJECTED, DomainRequestStatus.CANCELLED, DomainRequestStatus.FAILED]
                ),
            )
        )
        if request_conflict.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="That domain already has an active request.")

    async def get_overview(self, user: User) -> dict:
        tenant = await self._get_tenant(user)
        system_settings = await self._get_system_settings()
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
        domain_requests = sorted(tenant.domain_requests, key=lambda item: item.created_at, reverse=True)
        return {
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "current_plan": tenant.plan,
            "billing_cycle": tenant.billing_cycle.value if hasattr(tenant.billing_cycle, "value") else str(tenant.billing_cycle),
            "enabled_modules": enabled_modules,
            "catalog": catalog,
            "requests": requests,
            "domain_requests": domain_requests,
            "custom_domain_price": getattr(system_settings, "custom_domain_annual_price", None) or settings.CUSTOM_DOMAIN_ANNUAL_PRICE,
            "custom_domain_currency": getattr(system_settings, "custom_domain_currency", None) or settings.CUSTOM_DOMAIN_CURRENCY,
            "custom_domain_allowed_tlds": [".com", ".org", ".co"],
            "platform_domain": getattr(system_settings, "platform_domain", None) or settings.PRIMARY_PLATFORM_DOMAIN,
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
            invoice_type="module_upgrade",
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

    async def create_domain_request(self, user: User, payload: CustomDomainRequestCreate) -> TenantDomainRequest:
        tenant = await self._get_tenant(user)
        host = self._clean_host(payload.host)
        if not host or "." not in host:
            raise HTTPException(status_code=422, detail="A valid custom domain is required.")
        if not self._allowed_custom_domain(host):
            raise HTTPException(status_code=422, detail="Only .com, .org, and .co domains are supported.")

        suffix = tenant_domain_suffix()
        if host == suffix or host.endswith(f".{suffix}"):
            raise HTTPException(status_code=422, detail="Use your tenant platform domain instead of requesting a platform-owned domain.")

        await self._ensure_domain_not_taken(tenant, host)
        blocking_request = next(
            (
                request
                for request in tenant.domain_requests
                if request.status in {
                    DomainRequestStatus.PENDING_PAYMENT,
                    DomainRequestStatus.PAID,
                    DomainRequestStatus.PENDING_DNS,
                    DomainRequestStatus.DNS_VERIFIED,
                    DomainRequestStatus.SSL_PENDING,
                }
            ),
            None,
        )
        if blocking_request:
            raise HTTPException(status_code=409, detail="There is already a custom domain request waiting for completion.")

        system_settings = await self._get_system_settings()
        record_type, record_name, record_value = self._dns_instruction(host, system_settings)
        amount = Decimal(str(getattr(system_settings, "custom_domain_annual_price", None) or settings.CUSTOM_DOMAIN_ANNUAL_PRICE))
        currency = getattr(system_settings, "custom_domain_currency", None) or settings.CUSTOM_DOMAIN_CURRENCY
        domain_request = TenantDomainRequest(
            tenant_id=tenant.id,
            requested_by_user_id=user.id,
            host=host,
            normalized_host=host,
            status=DomainRequestStatus.PENDING_PAYMENT,
            price_amount=amount,
            currency=currency,
            billing_period="annual",
            verification_token=f"farmexa-{secrets.token_hex(12)}",
            dns_record_type=record_type,
            dns_record_name=record_name,
            dns_record_value=record_value,
            wants_primary=payload.is_primary,
        )
        self.db.add(domain_request)
        await self.db.flush()

        invoice = BillingInvoice(
            tenant_id=tenant.id,
            domain_request_id=domain_request.id,
            invoice_type="custom_domain",
            invoice_number=f"DOM-{uuid.uuid4().hex[:10].upper()}",
            amount=amount,
            currency=currency,
            status=PaymentStatus.PENDING,
            due_date=date.today() + timedelta(days=7),
            payment_reference=f"PAY-{uuid.uuid4().hex[:10].upper()}",
            payment_url=None,
            notes=f"Annual custom domain connection for {host}",
        )
        self.db.add(invoice)
        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant.id,
                changed_by_user_id=user.id,
                event_type="custom_domain_request",
                notes=f"Pending payment for custom domain {host}",
            )
        )
        await write_audit_log(
            self.db,
            user_id=user.id,
            action="CREATE",
            entity="tenant_domain_request",
            entity_id=domain_request.id,
            meta={"tenant_id": tenant.id, "host": host, "amount": float(amount), "currency": currency},
        )
        await self.db.commit()

        refreshed = await self.db.execute(
            select(TenantDomainRequest)
            .where(TenantDomainRequest.id == domain_request.id)
            .options(selectinload(TenantDomainRequest.invoice))
        )
        return refreshed.scalar_one()

    async def start_invoice_checkout(self, user: User, invoice_id: int, request: Request) -> dict:
        tenant = await self._get_tenant(user)
        result = await self.db.execute(select(BillingInvoice).where(BillingInvoice.id == invoice_id, BillingInvoice.tenant_id == tenant.id))
        invoice = result.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found.")
        if invoice.status == PaymentStatus.SUCCESSFUL:
            raise HTTPException(status_code=409, detail="This invoice is already paid.")

        system_settings = await self._get_system_settings()
        pesapal = PesapalService(system_settings)
        ipn_url = (
            getattr(system_settings, "pesapal_ipn_url", None)
            or settings.PESAPAL_IPN_URL
            or pesapal.build_url(request, "/api/v1/subscriptions/payments/pesapal/ipn")
        )
        callback_url = settings.PESAPAL_CALLBACK_URL or pesapal.build_url(request, "/api/v1/subscriptions/payments/pesapal/callback")
        cancellation_url = settings.PESAPAL_CANCELLATION_URL or pesapal.build_url(request, "/account/billing")
        checkout = await pesapal.submit_order(
            invoice_number=invoice.invoice_number,
            amount=invoice.amount,
            currency=invoice.currency,
            description=invoice.notes or f"Farmexa invoice {invoice.invoice_number}",
            callback_url=callback_url,
            cancellation_url=cancellation_url,
            ipn_url=ipn_url,
            customer_email=tenant.email,
            customer_phone=tenant.phone,
            customer_name=tenant.contact_person or tenant.business_name or tenant.name,
        )
        invoice.payment_url = checkout.redirect_url
        invoice.payment_reference = checkout.merchant_reference
        await self.db.commit()
        return {
            "invoice_id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "redirect_url": checkout.redirect_url,
            "order_tracking_id": checkout.order_tracking_id,
            "merchant_reference": checkout.merchant_reference,
        }

    async def process_pesapal_notification(
        self,
        *,
        order_tracking_id: str,
        merchant_reference: str | None,
        source_ip: str | None,
        raw_payload: dict[str, Any],
    ) -> None:
        system_settings = await self._get_system_settings()
        status_result = await PesapalService(system_settings).get_transaction_status(order_tracking_id)
        await self._apply_payment_status(status_result, source_ip, raw_payload, merchant_reference)

    async def _apply_payment_status(
        self,
        status_result: PesapalStatusResult,
        source_ip: str | None,
        raw_payload: dict[str, Any],
        fallback_reference: str | None = None,
    ) -> None:
        invoice_number = status_result.merchant_reference or fallback_reference
        if not invoice_number:
            raise HTTPException(status_code=422, detail="Payment notification did not include an invoice reference.")

        invoice_result = await self.db.execute(
            select(BillingInvoice)
            .where(BillingInvoice.invoice_number == invoice_number)
            .options(
                selectinload(BillingInvoice.request).selectinload(TenantModuleRequest.items),
                selectinload(BillingInvoice.domain_request),
            )
        )
        invoice = invoice_result.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found.")

        normalized_status = status_result.status
        callback_log = PaymentCallbackLog(
            tenant_id=invoice.tenant_id,
            invoice_id=invoice.id,
            event_type=f"{invoice.invoice_type}_payment",
            status=PaymentStatus(normalized_status),
            source_ip=source_ip,
            payload=json.dumps({"pesapal": status_result.raw, "notification": raw_payload}, default=str),
            processed_at=datetime.now(UTC),
        )
        self.db.add(callback_log)

        payment = BillingPayment(
            tenant_id=invoice.tenant_id,
            invoice_id=invoice.id,
            amount=float(status_result.amount if status_result.amount is not None else invoice.amount),
            currency=status_result.currency or invoice.currency,
            status=PaymentStatus(normalized_status),
            provider="pesapal",
            reference=status_result.confirmation_code or status_result.order_tracking_id or invoice.payment_reference,
            paid_at=datetime.now(UTC) if normalized_status == "successful" else None,
            raw_response=json.dumps(status_result.raw, default=str),
        )
        self.db.add(payment)
        invoice.status = PaymentStatus(normalized_status)

        if normalized_status == "successful":
            invoice.paid_at = datetime.now(UTC)
            if invoice.request:
                await self._activate_module_request(invoice)
            if invoice.domain_request:
                domain_request = invoice.domain_request
                domain_request.status = DomainRequestStatus.PENDING_DNS
                domain_request.paid_at = datetime.now(UTC)
                self.db.add(
                    SubscriptionHistory(
                        tenant_id=invoice.tenant_id,
                        changed_by_user_id=None,
                        event_type="custom_domain_paid",
                        notes=f"Custom domain {domain_request.host} paid and waiting for DNS verification.",
                    )
                )
        elif normalized_status == "failed":
            if invoice.request:
                invoice.request.status = ModuleRequestStatus.REJECTED
            if invoice.domain_request:
                invoice.domain_request.status = DomainRequestStatus.FAILED
        elif normalized_status == "cancelled":
            if invoice.request:
                invoice.request.status = ModuleRequestStatus.CANCELLED
            if invoice.domain_request:
                invoice.domain_request.status = DomainRequestStatus.CANCELLED
        else:
            if invoice.request:
                invoice.request.status = ModuleRequestStatus.PENDING_PAYMENT
            if invoice.domain_request:
                invoice.domain_request.status = DomainRequestStatus.PENDING_PAYMENT

        await self.db.commit()

    async def _activate_module_request(self, invoice: BillingInvoice) -> None:
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

    async def verify_domain_request(self, request_id: int, actor: User) -> TenantDomainRequest:
        domain_request = await self._load_domain_request(request_id)
        if domain_request.status == DomainRequestStatus.PENDING_PAYMENT:
            raise HTTPException(status_code=409, detail="The custom domain request must be paid before DNS verification.")
        verification = await self._verify_requested_domain(domain_request)
        domain_request.last_error = None
        if verification.matches_target:
            domain_request.status = DomainRequestStatus.DNS_VERIFIED
        else:
            resolved = ", ".join(verification.resolved_ips) if verification.resolved_ips else "no A records"
            domain_request.status = DomainRequestStatus.FAILED
            if verification.error and any(token in verification.error.lower() for token in ["name", "resolve", "not known", "nodename"]):
                domain_request.last_error = "The requested domain does not exist in public DNS yet, or its DNS provider has not published records."
            else:
                domain_request.last_error = verification.error or (
                    f"Domain does not point to {verification.target_ip or 'the configured target IP'}. Resolved: {resolved}."
                )
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_domain_request_verify",
            entity_id=domain_request.id,
            meta={"tenant_id": domain_request.tenant_id, "host": domain_request.host, "status": domain_request.status.value},
        )
        await self.db.commit()
        return await self._load_domain_request(request_id)

    async def _verify_requested_domain(self, domain_request: TenantDomainRequest):
        if (domain_request.dns_record_type or "").upper() != "CNAME":
            return await verify_domain_points_to_target(domain_request.host)

        target = normalize_host(domain_request.dns_record_value)
        try:
            host_name, aliases, ips = socket.gethostbyname_ex(domain_request.host)
            target_ips = socket.gethostbyname_ex(target)[2] if target else []
        except Exception as exc:
            class Result:
                matches_target = False
                resolved_ips: list[str] = []
                target_ip = target
                error = str(exc)
            return Result()

        aliases_normalized = {normalize_host(item) for item in [host_name, *aliases] if item}
        matches_target = bool(target and target in aliases_normalized) or bool(set(ips) & set(target_ips))

        class Result:
            resolved_ips = sorted(set(ips))
            target_ip = target
            error = None if matches_target else f"Domain does not resolve to {target}."

        Result.matches_target = matches_target
        return Result()

    async def activate_domain_request(self, request_id: int, actor: User) -> TenantDomainRequest:
        domain_request = await self._load_domain_request(request_id)
        if domain_request.status != DomainRequestStatus.DNS_VERIFIED:
            raise HTTPException(status_code=409, detail="The domain request must be paid and DNS-verified before activation.")
        tenant_result = await self.db.execute(select(Tenant).where(Tenant.id == domain_request.tenant_id))
        tenant = tenant_result.scalar_one()
        if domain_request.wants_primary:
            await self.db.execute(
                update(TenantDomain)
                .where(TenantDomain.tenant_id == tenant.id)
                .values(is_primary=False)
            )
        existing = await self.db.execute(select(TenantDomain).where(TenantDomain.normalized_host == domain_request.normalized_host))
        domain = existing.scalar_one_or_none()
        if not domain:
            domain = TenantDomain(
                tenant_id=tenant.id,
                host=domain_request.host,
                normalized_host=domain_request.normalized_host,
                domain_type=DomainType.CUSTOM,
                is_primary=domain_request.wants_primary,
                status=DomainStatus.ACTIVE,
                verification_target=domain_request.dns_record_value,
                dns_verified_at=datetime.now(UTC),
                ssl_issued_at=datetime.now(UTC),
                activated_at=datetime.now(UTC),
            )
            self.db.add(domain)
            await self.db.flush()
        else:
            domain.tenant_id = tenant.id
            domain.status = DomainStatus.ACTIVE
            domain.domain_type = DomainType.CUSTOM
            domain.is_primary = domain_request.wants_primary
            domain.dns_verified_at = domain.dns_verified_at or datetime.now(UTC)
            domain.ssl_issued_at = domain.ssl_issued_at or datetime.now(UTC)
            domain.activated_at = datetime.now(UTC)
            domain.last_error = None

        domain_request.domain_id = domain.id
        domain_request.status = DomainRequestStatus.ACTIVE
        domain_request.approved_at = domain_request.approved_at or datetime.now(UTC)
        domain_request.activated_at = datetime.now(UTC)
        domain_request.last_error = None
        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant.id,
                changed_by_user_id=actor.id,
                event_type="custom_domain_activated",
                notes=f"Activated custom domain {domain_request.host}",
            )
        )
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_domain_request_activate",
            entity_id=domain_request.id,
            meta={"tenant_id": tenant.id, "host": domain_request.host},
        )
        await self.db.commit()
        return await self._load_domain_request(request_id)

    async def reject_domain_request(self, request_id: int, actor: User, notes: str | None = None) -> TenantDomainRequest:
        domain_request = await self._load_domain_request(request_id)
        domain_request.status = DomainRequestStatus.REJECTED
        domain_request.rejected_at = datetime.now(UTC)
        domain_request.admin_notes = notes
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_domain_request_reject",
            entity_id=domain_request.id,
            meta={"tenant_id": domain_request.tenant_id, "host": domain_request.host},
        )
        await self.db.commit()
        return await self._load_domain_request(request_id)

    async def add_domain_request_message(
        self,
        request_id: int,
        actor: User,
        message_text: str,
        *,
        admin_message: bool = False,
    ) -> TenantDomainRequest:
        domain_request = await self._load_domain_request(request_id)
        if not admin_message and domain_request.tenant_id != actor.tenant_id:
            raise HTTPException(status_code=403, detail="You cannot message this domain request.")
        clean_message = message_text.strip()
        if not clean_message:
            raise HTTPException(status_code=422, detail="Message is required.")
        message = TenantDomainRequestMessage(
            request_id=domain_request.id,
            tenant_id=domain_request.tenant_id,
            sender_user_id=actor.id,
            sender_role="admin" if admin_message else "tenant",
            message=clean_message,
        )
        self.db.add(message)
        await self.db.flush()

        if admin_message:
            system_settings = await self._get_system_settings()
            tenant = domain_request.tenant
            subject = f"Farmexa custom domain update: {domain_request.host}"
            body = (
                f"Hello {tenant.contact_person or tenant.name},\n\n"
                f"Farmexa support replied to your custom domain request for {domain_request.host}:\n\n"
                f"{clean_message}\n\n"
                "Sign in to your workspace to continue the request.\n"
            )
            html = branded_email_html(
                title="Custom domain request update",
                intro=f"We replied to your request for {domain_request.host}.",
                body_html=f"<p>{clean_message}</p>",
                system_settings=system_settings,
            )
            email_log = await log_and_send_email(
                self.db,
                tenant_id=tenant.id,
                recipient=tenant.email,
                subject=subject,
                body=body,
                html_body=html,
                email_type="Custom Domain Request",
                system_settings=system_settings,
            )
            if email_log.status == "sent":
                message.email_sent_at = datetime.now(UTC)

        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="CREATE",
            entity="tenant_domain_request_message",
            entity_id=message.id,
            meta={"tenant_id": domain_request.tenant_id, "request_id": request_id, "sender_role": message.sender_role},
        )
        await self.db.commit()
        return await self._load_domain_request(request_id)

    async def _load_domain_request(self, request_id: int) -> TenantDomainRequest:
        result = await self.db.execute(
            select(TenantDomainRequest)
            .where(TenantDomainRequest.id == request_id)
            .options(
                selectinload(TenantDomainRequest.invoice),
                selectinload(TenantDomainRequest.tenant),
                selectinload(TenantDomainRequest.messages),
            )
        )
        domain_request = result.scalar_one_or_none()
        if not domain_request:
            raise HTTPException(status_code=404, detail="Domain request not found.")
        return domain_request

    async def process_payment_callback(self, payload: PaymentCallbackIn, source_ip: str | None, callback_secret: str | None) -> None:
        expected_secret = settings.PAYMENT_CALLBACK_SECRET
        if settings.is_production and not expected_secret:
            raise HTTPException(status_code=409, detail="Manual payment callbacks are disabled until PAYMENT_CALLBACK_SECRET is configured.")
        if expected_secret and callback_secret != expected_secret:
            raise HTTPException(status_code=403, detail="Invalid payment callback secret.")

        normalized_status = payload.status.lower()
        if normalized_status not in {"pending", "successful", "failed", "cancelled"}:
            raise HTTPException(status_code=422, detail="Invalid payment callback status.")
        status_result = PesapalStatusResult(
            merchant_reference=payload.invoice_number,
            order_tracking_id=payload.reference,
            status=normalized_status,
            status_code=None,
            amount=payload.amount,
            currency=payload.currency,
            payment_method=payload.provider,
            confirmation_code=payload.reference,
            raw=payload.payload or payload.model_dump(mode="json"),
        )
        await self._apply_payment_status(status_result, source_ip, payload.model_dump(mode="json"))
