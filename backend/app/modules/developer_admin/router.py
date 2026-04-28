"""
Developer Admin API router — restricted to developer_admin role only.
"""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission, get_db, get_current_user
from app.modules.developer_admin.schemas import (
    ModuleToggle,
    PlanChange,
    SuspendRequest,
    SubscriptionHistoryOut,
    TenantCreate,
    TenantModuleOut,
    TenantOut,
    TenantUpdate,
)
from app.modules.developer_admin.service import DeveloperAdminService

router = APIRouter(prefix="/dev-admin", tags=["Developer Admin"])


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
    return await DeveloperAdminService(db)._get_tenant(tenant_id)


@router.put("/tenants/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: int,
    data: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await DeveloperAdminService(db).update_tenant(tenant_id, data)


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
