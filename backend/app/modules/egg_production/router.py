"""
Egg production API router — /api/v1/eggs endpoints.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_db
from app.modules.egg_production.schemas import (
    EggProductionCreate,
    EggProductionOut,
    EggProductionSummary,
    EggProductionUpdate,
)
from app.modules.egg_production.service import EggProductionService

router = APIRouter(prefix="/eggs", tags=["Egg Production"])


@router.get("", response_model=List[EggProductionOut])
async def list_egg_logs(
    batch_id: Optional[int] = Query(default=None),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_tenant_db),
    _=Depends(require_permission("farm:read")),
):
    return await EggProductionService(db).list_logs(batch_id, from_date, to_date)


@router.get("/summary", response_model=EggProductionSummary)
async def egg_summary(
    batch_id: Optional[int] = Query(default=None),
    from_date: Optional[date] = Query(default=None),
    to_date: Optional[date] = Query(default=None),
    db: AsyncSession = Depends(get_tenant_db),
    _=Depends(require_permission("farm:read")),
):
    return await EggProductionService(db).get_summary(batch_id, from_date, to_date)


@router.get("/{log_id}", response_model=EggProductionOut)
async def get_egg_log(
    log_id: int,
    db: AsyncSession = Depends(get_tenant_db),
    _=Depends(require_permission("farm:read")),
):
    return await EggProductionService(db).get_log(log_id)


@router.post("", response_model=EggProductionOut, status_code=status.HTTP_201_CREATED)
async def create_egg_log(
    data: EggProductionCreate,
    db: AsyncSession = Depends(get_tenant_db),
    _=Depends(require_permission("farm:write")),
):
    return await EggProductionService(db).create_log(data)


@router.put("/{log_id}", response_model=EggProductionOut)
async def update_egg_log(
    log_id: int,
    data: EggProductionUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    _=Depends(require_permission("farm:write")),
):
    return await EggProductionService(db).update_log(log_id, data)


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_egg_log(
    log_id: int,
    db: AsyncSession = Depends(get_tenant_db),
    _=Depends(require_permission("farm:write")),
):
    await EggProductionService(db).delete_log(log_id)
