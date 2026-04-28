"""
Developer Admin service for SaaS catalog, tenant onboarding, and subscription control.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Iterable

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tenant import (
    BillingCycle,
    ModulePrice,
    PlanDefinition,
    PlanModule,
    PlatformModule,
    Subscription,
    SubscriptionHistory,
    SubscriptionStatus,
    Tenant,
    TenantDomain,
    TenantModule,
    TenantStatus,
)
from app.models.user import User
from app.modules.developer_admin.schemas import (
    DomainAssignRequest,
    ModulePriceUpdate,
    ModuleToggle,
    PlanChange,
    SuspendRequest,
    TenantCreate,
    TenantUpdate,
)


class DeveloperAdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _tenant_query(self):
        return select(Tenant).options(
            selectinload(Tenant.modules),
            selectinload(Tenant.domains),
            selectinload(Tenant.subscriptions),
        )

    @staticmethod
    def _slugify(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

    async def _get_plan(self, plan_code: str) -> PlanDefinition:
        result = await self.db.execute(
            select(PlanDefinition).options(selectinload(PlanDefinition.modules)).where(PlanDefinition.code == plan_code)
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan

    async def _get_module(self, module_key: str) -> PlatformModule:
        result = await self.db.execute(select(PlatformModule).where(PlatformModule.key == module_key))
        module = result.scalar_one_or_none()
        if not module:
            raise HTTPException(status_code=404, detail=f"Module '{module_key}' not found")
        return module

    async def _get_tenant(self, tenant_id: int) -> Tenant:
        result = await self.db.execute(self._tenant_query().where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        return tenant

    async def _get_plan_module_keys(self, plan_code: str) -> list[str]:
        result = await self.db.execute(
            select(PlanModule.module_key).where(
                PlanModule.plan_code == plan_code,
                PlanModule.is_included.is_(True),
            )
        )
        return list(result.scalars().all())

    async def _sync_tenant_modules(self, tenant: Tenant, module_keys: Iterable[str], disable_missing: bool) -> None:
        module_keys = list(dict.fromkeys(module_keys))
        existing = {module.module_key: module for module in tenant.modules}
        for module_key in module_keys:
            await self._get_module(module_key)
            if module_key in existing:
                existing[module_key].is_enabled = True
            else:
                self.db.add(TenantModule(tenant_id=tenant.id, module_key=module_key, is_enabled=True))
        if disable_missing:
            keep = set(module_keys)
            for module_key, module in existing.items():
                if module_key not in keep:
                    module.is_enabled = False
        await self.db.flush()

    async def _ensure_primary_domain(self, tenant: Tenant, host: str | None) -> None:
        desired_host = host or f"{tenant.slug}.farmexa.local"
        existing = next((domain for domain in tenant.domains if domain.host == desired_host), None)
        if existing:
            existing.is_primary = True
            existing.status = "active"
        else:
            self.db.add(
                TenantDomain(
                    tenant_id=tenant.id,
                    host=desired_host,
                    is_primary=True,
                    status="active",
                )
            )
        for domain in tenant.domains:
            if domain.host != desired_host:
                domain.is_primary = False
        await self.db.flush()

    async def _create_subscription(
        self,
        tenant: Tenant,
        plan_code: str,
        billing_cycle: str,
        start_date: date | None,
        expiry_date: date | None,
        notes: str | None = None,
        status: str | None = None,
    ) -> Subscription:
        latest = self._latest_subscription(tenant)
        if latest and latest.status in {SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE}:
            latest.status = SubscriptionStatus.CANCELLED
        subscription = Subscription(
            tenant_id=tenant.id,
            plan_code=plan_code,
            billing_cycle=BillingCycle(billing_cycle),
            status=SubscriptionStatus(status or ("trial" if not expiry_date else "active")),
            start_date=start_date or date.today(),
            expiry_date=expiry_date,
            next_invoice_date=(start_date or date.today()) + timedelta(days=30),
            notes=notes,
        )
        self.db.add(subscription)
        await self.db.flush()
        return subscription

    @staticmethod
    def _latest_subscription(tenant: Tenant) -> Subscription | None:
        if not tenant.subscriptions:
            return None
        return sorted(
            tenant.subscriptions,
            key=lambda record: (record.start_date, record.created_at or datetime.min),
            reverse=True,
        )[0]

    async def list_tenants(self) -> list[Tenant]:
        result = await self.db.execute(self._tenant_query().order_by(Tenant.name))
        return list(result.scalars().all())

    async def list_plans(self) -> list[PlanDefinition]:
        result = await self.db.execute(
            select(PlanDefinition).options(selectinload(PlanDefinition.modules)).order_by(PlanDefinition.code)
        )
        return list(result.scalars().all())

    async def list_modules(self) -> list[PlatformModule]:
        result = await self.db.execute(select(PlatformModule).order_by(PlatformModule.category, PlatformModule.name))
        return list(result.scalars().all())

    async def list_module_prices(self) -> list[ModulePrice]:
        result = await self.db.execute(select(ModulePrice).order_by(ModulePrice.module_key, ModulePrice.billing_cycle))
        return list(result.scalars().all())

    async def create_tenant(self, data: TenantCreate, actor: User) -> Tenant:
        slug = self._slugify(data.slug or data.name)
        existing = await self.db.execute(select(Tenant).where((Tenant.slug == slug) | (Tenant.name == data.name)))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A tenant with the same name or slug already exists.")

        plan = await self._get_plan(data.plan)
        tenant = Tenant(
            name=data.name,
            slug=slug,
            business_name=data.business_name or data.name,
            contact_person=data.contact_person,
            email=data.email,
            phone=data.phone,
            address=data.address,
            country=data.country,
            status=TenantStatus.TRIAL if not data.subscription_expiry else TenantStatus.ACTIVE,
            plan=data.plan,
            billing_cycle=data.billing_cycle,
            subscription_start=data.subscription_start,
            subscription_expiry=data.subscription_expiry,
            notes=data.notes,
        )
        self.db.add(tenant)
        await self.db.flush()

        module_keys = data.enabled_modules if plan.is_custom and data.enabled_modules else await self._get_plan_module_keys(plan.code)
        await self._sync_tenant_modules(tenant, module_keys, disable_missing=True)
        await self._ensure_primary_domain(tenant, data.domain)
        await self._create_subscription(
            tenant,
            plan_code=plan.code,
            billing_cycle=data.billing_cycle,
            start_date=data.subscription_start,
            expiry_date=data.subscription_expiry,
            notes=data.notes,
            status="trial" if not data.subscription_expiry else "active",
        )

        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant.id,
                changed_by_user_id=actor.id,
                event_type="created",
                new_plan=plan.code,
                notes=f"Tenant created on {plan.name}",
            )
        )
        await self.db.commit()
        return await self._get_tenant(tenant.id)

    async def update_tenant(self, tenant_id: int, data: TenantUpdate) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        updates = data.model_dump(exclude_none=True)
        if "slug" in updates:
            updates["slug"] = self._slugify(updates["slug"])
        for field, value in updates.items():
            setattr(tenant, field, value)
        await self.db.commit()
        return await self._get_tenant(tenant_id)

    async def change_plan(self, tenant_id: int, data: PlanChange, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        plan = await self._get_plan(data.plan)
        old_plan = tenant.plan.value if hasattr(tenant.plan, "value") else str(tenant.plan)

        tenant.plan = plan.code
        if data.billing_cycle:
            tenant.billing_cycle = data.billing_cycle
        if data.subscription_expiry is not None:
            tenant.subscription_expiry = data.subscription_expiry
        tenant.subscription_start = date.today()
        tenant.status = TenantStatus.ACTIVE

        module_keys = await self._get_plan_module_keys(plan.code)
        if not plan.is_custom:
            await self._sync_tenant_modules(tenant, module_keys, disable_missing=True)

        await self._create_subscription(
            tenant,
            plan_code=plan.code,
            billing_cycle=data.billing_cycle or (tenant.billing_cycle.value if hasattr(tenant.billing_cycle, "value") else str(tenant.billing_cycle)),
            start_date=date.today(),
            expiry_date=data.subscription_expiry or tenant.subscription_expiry,
            notes=data.notes,
            status="active",
        )

        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant.id,
                changed_by_user_id=actor.id,
                event_type="plan_change",
                old_plan=old_plan,
                new_plan=plan.code,
                notes=data.notes,
            )
        )
        await self.db.commit()
        return await self._get_tenant(tenant_id)

    async def toggle_module(self, tenant_id: int, data: ModuleToggle, actor: User) -> TenantModule:
        tenant = await self._get_tenant(tenant_id)
        await self._get_module(data.module_key)
        module = next((record for record in tenant.modules if record.module_key == data.module_key), None)
        if module:
            module.is_enabled = data.is_enabled
        else:
            module = TenantModule(tenant_id=tenant_id, module_key=data.module_key, is_enabled=data.is_enabled)
            self.db.add(module)
        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant_id,
                changed_by_user_id=actor.id,
                event_type="module_toggle",
                notes=f"Module '{data.module_key}' {'enabled' if data.is_enabled else 'disabled'}",
            )
        )
        await self.db.commit()
        await self.db.refresh(module)
        return module

    async def assign_domain(self, tenant_id: int, data: DomainAssignRequest, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        if data.is_primary:
            for domain in tenant.domains:
                domain.is_primary = False
        existing = next((domain for domain in tenant.domains if domain.host == data.host), None)
        if existing:
            existing.is_primary = data.is_primary
            existing.status = "active"
        else:
            self.db.add(
                TenantDomain(
                    tenant_id=tenant.id,
                    host=data.host,
                    is_primary=data.is_primary,
                    status="active",
                )
            )
        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant.id,
                changed_by_user_id=actor.id,
                event_type="domain_update",
                notes=f"Domain set to {data.host}",
            )
        )
        await self.db.commit()
        return await self._get_tenant(tenant_id)

    async def update_module_price(self, module_key: str, data: ModulePriceUpdate) -> ModulePrice:
        await self._get_module(module_key)
        result = await self.db.execute(
            select(ModulePrice).where(
                ModulePrice.module_key == module_key,
                ModulePrice.billing_cycle == data.billing_cycle,
            )
        )
        price = result.scalar_one_or_none()
        if price:
            price.price = data.price
            price.currency = data.currency
            price.notes = data.notes
        else:
            price = ModulePrice(
                module_key=module_key,
                billing_cycle=data.billing_cycle,
                price=data.price,
                currency=data.currency,
                notes=data.notes,
            )
            self.db.add(price)
        await self.db.commit()
        await self.db.refresh(price)
        return price

    async def suspend_tenant(self, tenant_id: int, data: SuspendRequest, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        tenant.is_suspended = True
        tenant.status = TenantStatus.SUSPENDED
        latest = self._latest_subscription(tenant)
        if latest:
            latest.status = SubscriptionStatus.SUSPENDED
        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant_id,
                changed_by_user_id=actor.id,
                event_type="suspend",
                notes=data.reason,
            )
        )
        await self.db.commit()
        return await self._get_tenant(tenant_id)

    async def reactivate_tenant(self, tenant_id: int, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        tenant.is_suspended = False
        tenant.status = TenantStatus.ACTIVE
        latest = self._latest_subscription(tenant)
        if latest and latest.status == SubscriptionStatus.SUSPENDED:
            latest.status = SubscriptionStatus.ACTIVE
        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant_id,
                changed_by_user_id=actor.id,
                event_type="reactivate",
                notes="Tenant reactivated",
            )
        )
        await self.db.commit()
        return await self._get_tenant(tenant_id)

    async def get_subscription_history(self, tenant_id: int) -> list[SubscriptionHistory]:
        result = await self.db.execute(
            select(SubscriptionHistory)
            .where(SubscriptionHistory.tenant_id == tenant_id)
            .order_by(SubscriptionHistory.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_billing_overview(self) -> dict:
        tenants = await self.list_tenants()
        today = date.today()
        overview_rows = []
        active_count = 0
        suspended_count = 0
        expiring_soon = 0

        for tenant in tenants:
            latest = self._latest_subscription(tenant)
            domains = [domain.host for domain in sorted(tenant.domains, key=lambda domain: not domain.is_primary)]
            status = latest.status.value if latest else ("suspended" if tenant.is_suspended else "trial")
            if tenant.is_suspended:
                suspended_count += 1
            elif status in {"active", "trial"}:
                active_count += 1
            if latest and latest.expiry_date and latest.expiry_date <= today + timedelta(days=14):
                expiring_soon += 1

            overview_rows.append(
                {
                    "tenant_id": tenant.id,
                    "tenant_name": tenant.name,
                    "plan": latest.plan_code if latest else (tenant.plan.value if hasattr(tenant.plan, "value") else str(tenant.plan)),
                    "status": status,
                    "billing_cycle": latest.billing_cycle.value if latest and hasattr(latest.billing_cycle, "value") else (tenant.billing_cycle.value if hasattr(tenant.billing_cycle, "value") else str(tenant.billing_cycle)),
                    "expiry_date": latest.expiry_date if latest else tenant.subscription_expiry,
                    "amount": latest.amount if latest else None,
                    "currency": latest.currency if latest else "UGX",
                    "domains": domains,
                }
            )

        return {
            "total_tenants": len(tenants),
            "active_tenants": active_count,
            "suspended_tenants": suspended_count,
            "expiring_soon": expiring_soon,
            "tenants": overview_rows,
        }
