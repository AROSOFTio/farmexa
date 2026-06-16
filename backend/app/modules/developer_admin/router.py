"""
Developer Admin API router.
"""

from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.modules.developer_admin.schemas import (
    ActivityLogOut,
    BillingOverviewOut,
    DeveloperAdminOverviewOut,
    DeveloperAdminSettingsOut,
    DeveloperAdminSettingsUpdate,
    DomainAssignRequest,
    ModulePriceOut,
    ModulePriceUpdate,
    ModuleToggle,
    PlanChange,
    PlanCreate,
    PlanOut,
    PlanStatusUpdate,
    PlanUpdate,
    PlatformModuleOut,
    SaaSCatalogOut,
    SubscriptionHistoryOut,
    SuspendRequest,
    TenantActivityOut,
    TenantCreate,
    TenantModuleOut,
    TenantOut,
    TenantUpdate,
)
from app.modules.developer_admin.service import DeveloperAdminService

router = APIRouter(prefix="/dev-admin", tags=["Developer Admin"])


@router.get("/overview", response_model=DeveloperAdminOverviewOut)
async def get_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).get_overview()


@router.get("/activity", response_model=List[ActivityLogOut])
async def get_activity_logs(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).get_activity_logs()


@router.get("/settings", response_model=DeveloperAdminSettingsOut)
async def get_settings_summary(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).get_settings_summary()


@router.put("/settings", response_model=DeveloperAdminSettingsOut)
async def update_settings(
    data: DeveloperAdminSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).update_settings(data, current_user)


@router.get("/tenants", response_model=List[TenantOut])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).list_tenants()


@router.post("/tenants", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    data: TenantCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).create_tenant(data, current_user)


@router.get("/tenants/{tenant_id}", response_model=TenantOut)
async def get_tenant(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).get_tenant(tenant_id)


@router.put("/tenants/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: int,
    data: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).update_tenant(tenant_id, data, current_user)


@router.post("/tenants/{tenant_id}/plan", response_model=TenantOut)
async def change_plan(
    tenant_id: int,
    data: PlanChange,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).change_plan(tenant_id, data, current_user)


@router.post("/tenants/{tenant_id}/modules", response_model=TenantModuleOut)
async def toggle_module(
    tenant_id: int,
    data: ModuleToggle,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).toggle_module(tenant_id, data, current_user)


@router.post("/tenants/{tenant_id}/domains", response_model=TenantOut)
async def assign_domain(
    tenant_id: int,
    data: DomainAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).assign_domain(tenant_id, data, current_user)


@router.delete("/tenants/{tenant_id}/domains/{domain_id}", response_model=TenantOut)
async def delete_domain(
    tenant_id: int,
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).delete_domain(tenant_id, domain_id, current_user)


@router.post("/tenants/{tenant_id}/domains/{domain_id}/verify", response_model=TenantOut)
async def verify_domain(
    tenant_id: int,
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).verify_domain(tenant_id, domain_id, current_user)


@router.post("/tenants/{tenant_id}/domains/{domain_id}/ssl", response_model=TenantOut)
async def provision_domain_ssl(
    tenant_id: int,
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).provision_domain_ssl(tenant_id, domain_id, current_user)


@router.post("/tenants/{tenant_id}/domains/{domain_id}/activate", response_model=TenantOut)
async def activate_domain(
    tenant_id: int,
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).activate_domain(tenant_id, domain_id, current_user)


@router.post("/tenants/{tenant_id}/domains/{domain_id}/disable", response_model=TenantOut)
async def disable_domain(
    tenant_id: int,
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).disable_domain(tenant_id, domain_id, current_user)


@router.post("/tenants/{tenant_id}/domains/{domain_id}/retry", response_model=TenantOut)
async def retry_domain_setup(
    tenant_id: int,
    domain_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).retry_domain_setup(tenant_id, domain_id, current_user)


@router.get("/tenants/{tenant_id}/insights")
async def get_tenant_insights(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).get_tenant_insights(tenant_id)


@router.get("/tenants/{tenant_id}/activity", response_model=TenantActivityOut)
async def get_tenant_activity(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).get_tenant_activity(tenant_id)


@router.delete("/tenants/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    await DeveloperAdminService(db).delete_tenant(tenant_id, current_user)


@router.post("/tenants/{tenant_id}/suspend", response_model=TenantOut)
async def suspend_tenant(
    tenant_id: int,
    data: SuspendRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).suspend_tenant(tenant_id, data, current_user)


@router.post("/tenants/{tenant_id}/reactivate", response_model=TenantOut)
async def reactivate_tenant(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).reactivate_tenant(tenant_id, current_user)


@router.get("/tenants/{tenant_id}/history", response_model=List[SubscriptionHistoryOut])
async def get_history(
    tenant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).get_subscription_history(tenant_id)


@router.get("/catalog", response_model=SaaSCatalogOut)
async def get_catalog(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    service = DeveloperAdminService(db)
    return {
        "modules": await service.list_modules(),
        "plans": await service.list_plans(),
        "module_prices": await service.list_module_prices(),
    }


@router.get("/plans", response_model=List[PlanOut])
async def list_plans(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).list_plans()


@router.get("/plans/{plan_code}", response_model=PlanOut)
async def get_plan(
    plan_code: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).get_plan(plan_code)


@router.post("/plans", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    data: PlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).create_plan(data, current_user)


@router.put("/plans/{plan_code}", response_model=PlanOut)
async def update_plan(
    plan_code: str,
    data: PlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).update_plan(plan_code, data, current_user)


@router.post("/plans/{plan_code}/status", response_model=PlanOut)
async def update_plan_status(
    plan_code: str,
    data: PlanStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).update_plan_status(plan_code, data, current_user)


@router.get("/modules", response_model=List[PlatformModuleOut])
async def list_modules(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).list_modules()


@router.get("/billing", response_model=BillingOverviewOut)
async def billing_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await DeveloperAdminService(db).get_billing_overview()


@router.put("/modules/{module_key}/price", response_model=ModulePriceOut)
async def update_module_price(
    module_key: str,
    data: ModulePriceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).update_module_price(module_key, data)
