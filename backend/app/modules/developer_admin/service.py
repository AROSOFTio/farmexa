"""
Developer Admin service — tenant and subscription management.
"""
from typing import List, Optional
import re

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tenant import Tenant, TenantModule, SubscriptionHistory
from app.models.user import User
from app.modules.developer_admin.schemas import (
    TenantCreate,
    TenantUpdate,
    ModuleToggle,
    PlanChange,
    SuspendRequest,
)

# Modules available per plan
PLAN_MODULES = {
    "basic": [
        "dashboard", "houses", "batches", "egg_production",
        "feed_stock", "inventory_items",
    ],
    "standard": [
        "dashboard", "houses", "batches", "egg_production",
        "mortality", "vaccination", "growth_tracking",
        "feed_stock", "feed_purchases", "feed_consumption", "feed_suppliers",
        "inventory_items", "sales_orders", "customers",
        "slaughter_records",
    ],
    "premium": [
        "dashboard", "houses", "batches", "egg_production",
        "mortality", "vaccination", "growth_tracking",
        "feed_stock", "feed_purchases", "feed_consumption", "feed_suppliers",
        "inventory_items", "inventory_movements", "medicine_supplies",
        "sales_orders", "customers", "invoices", "payments",
        "slaughter_records", "slaughter_outputs",
        "expenses", "income", "profit_loss",
        "reports", "users", "settings",
    ],
    "custom": [],  # Developer manually controls
}


class DeveloperAdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_tenant(self, tenant_id: int) -> Tenant:
        result = await self.db.execute(
            select(Tenant).options(selectinload(Tenant.modules)).where(Tenant.id == tenant_id)
        )
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        return tenant

    async def list_tenants(self) -> List[Tenant]:
        result = await self.db.execute(
            select(Tenant).options(selectinload(Tenant.modules)).order_by(Tenant.name)
        )
        return list(result.scalars().all())

    async def create_tenant(self, data: TenantCreate, actor: User) -> Tenant:
        slug = re.sub(r"[^a-z0-9]+", "-", data.name.lower()).strip("-")
        tenant = Tenant(
            name=data.name,
            slug=slug,
            email=data.email,
            phone=data.phone,
            address=data.address,
            country=data.country,
            plan=data.plan,
            billing_cycle=data.billing_cycle,
            subscription_start=data.subscription_start,
            subscription_expiry=data.subscription_expiry,
            notes=data.notes,
        )
        self.db.add(tenant)
        await self.db.flush()

        # Auto-provision modules based on plan
        for module_key in PLAN_MODULES.get(data.plan, []):
            self.db.add(TenantModule(tenant_id=tenant.id, module_key=module_key, is_enabled=True))

        # Log the creation
        self.db.add(SubscriptionHistory(
            tenant_id=tenant.id,
            changed_by_user_id=actor.id,
            event_type="created",
            new_plan=data.plan,
            notes=f"Tenant created on {data.plan} plan",
        ))
        await self.db.commit()
        await self.db.refresh(tenant)
        return tenant

    async def update_tenant(self, tenant_id: int, data: TenantUpdate) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(tenant, field, value)
        await self.db.commit()
        await self.db.refresh(tenant)
        return tenant

    async def change_plan(self, tenant_id: int, data: PlanChange, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        old_plan = tenant.plan
        tenant.plan = data.plan

        # Re-provision modules for non-custom plans
        if data.plan != "custom":
            result = await self.db.execute(
                select(TenantModule).where(TenantModule.tenant_id == tenant_id)
            )
            existing = {m.module_key: m for m in result.scalars().all()}
            new_modules = set(PLAN_MODULES.get(data.plan, []))

            for key in new_modules:
                if key in existing:
                    existing[key].is_enabled = True
                else:
                    self.db.add(TenantModule(tenant_id=tenant_id, module_key=key, is_enabled=True))

            for key, mod in existing.items():
                if key not in new_modules:
                    mod.is_enabled = False

        self.db.add(SubscriptionHistory(
            tenant_id=tenant_id,
            changed_by_user_id=actor.id,
            event_type="plan_change",
            old_plan=old_plan,
            new_plan=data.plan,
            notes=data.notes,
        ))
        await self.db.commit()
        await self.db.refresh(tenant)
        return tenant

    async def toggle_module(self, tenant_id: int, data: ModuleToggle, actor: User) -> TenantModule:
        await self._get_tenant(tenant_id)
        result = await self.db.execute(
            select(TenantModule).where(
                TenantModule.tenant_id == tenant_id,
                TenantModule.module_key == data.module_key,
            )
        )
        mod = result.scalar_one_or_none()
        if mod:
            mod.is_enabled = data.is_enabled
        else:
            mod = TenantModule(tenant_id=tenant_id, module_key=data.module_key, is_enabled=data.is_enabled)
            self.db.add(mod)
        self.db.add(SubscriptionHistory(
            tenant_id=tenant_id,
            changed_by_user_id=actor.id,
            event_type="module_toggle",
            notes=f"Module '{data.module_key}' {'enabled' if data.is_enabled else 'disabled'}",
        ))
        await self.db.commit()
        await self.db.refresh(mod)
        return mod

    async def suspend_tenant(self, tenant_id: int, data: SuspendRequest, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        tenant.is_suspended = True
        tenant.status = "suspended"
        self.db.add(SubscriptionHistory(
            tenant_id=tenant_id,
            changed_by_user_id=actor.id,
            event_type="suspend",
            notes=data.reason,
        ))
        await self.db.commit()
        await self.db.refresh(tenant)
        return tenant

    async def reactivate_tenant(self, tenant_id: int, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        tenant.is_suspended = False
        tenant.status = "active"
        self.db.add(SubscriptionHistory(
            tenant_id=tenant_id,
            changed_by_user_id=actor.id,
            event_type="reactivate",
            notes="Tenant reactivated",
        ))
        await self.db.commit()
        await self.db.refresh(tenant)
        return tenant

    async def get_subscription_history(self, tenant_id: int) -> List[SubscriptionHistory]:
        result = await self.db.execute(
            select(SubscriptionHistory)
            .where(SubscriptionHistory.tenant_id == tenant_id)
            .order_by(SubscriptionHistory.created_at.desc())
        )
        return list(result.scalars().all())
