from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_db
from app.models.settings import ReferenceDataType
from app.modules.farm.schemas import (
    BatchCreate,
    BatchOut,
    BatchUpdate,
    GrowthLogCreate,
    GrowthLogOut,
    MortalityLogCreate,
    MortalityLogOut,
    ReferenceItemCreate,
    ReferenceItemOut,
    ReferenceItemUpdate,
    PoultryHouseCreate,
    PoultryHouseOut,
    PoultryHouseUpdate,
    VaccinationLogCreate,
    VaccinationLogOut,
    VaccinationLogUpdate,
)
from app.modules.farm.service import FarmService

router = APIRouter(prefix="/farm", tags=["Farm Management"])


@router.get("/reference-items", response_model=list[ReferenceItemOut])
async def list_reference_items(
    reference_type: ReferenceDataType | None = None,
    active_only: bool = False,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:read")),
):
    return await FarmService(db).list_reference_items(reference_type=reference_type, active_only=active_only)


@router.post("/reference-items", response_model=ReferenceItemOut, status_code=status.HTTP_201_CREATED)
async def create_reference_item(
    data: ReferenceItemCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    return await FarmService(db).create_reference_item(data)


@router.put("/reference-items/{item_id}", response_model=ReferenceItemOut)
async def update_reference_item(
    item_id: int,
    data: ReferenceItemUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    return await FarmService(db).update_reference_item(item_id, data)


@router.get("/houses", response_model=list[PoultryHouseOut])
async def list_houses(
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:read")),
):
    return await FarmService(db).get_houses()


@router.get("/houses/{house_id}", response_model=PoultryHouseOut)
async def get_house(
    house_id: int,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:read")),
):
    return await FarmService(db).get_house(house_id)


@router.post("/houses", response_model=PoultryHouseOut, status_code=status.HTTP_201_CREATED)
async def create_house(
    data: PoultryHouseCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    return await FarmService(db).create_house(data)


@router.put("/houses/{house_id}", response_model=PoultryHouseOut)
async def update_house(
    house_id: int,
    data: PoultryHouseUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    return await FarmService(db).update_house(house_id, data)


@router.get("/batches", response_model=list[BatchOut])
async def list_batches(
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:read")),
):
    return await FarmService(db).get_batches()


@router.get("/batches/{batch_id}", response_model=BatchOut)
async def get_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:read")),
):
    return await FarmService(db).get_batch(batch_id)


@router.post("/batches", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
async def create_batch(
    data: BatchCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    return await FarmService(db).create_batch(data)


@router.put("/batches/{batch_id}", response_model=BatchOut)
async def update_batch(
    batch_id: int,
    data: BatchUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    return await FarmService(db).update_batch(batch_id, data)


@router.get("/batches/{batch_id}/mortality", response_model=list[MortalityLogOut])
async def list_mortality(
    batch_id: int,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:read")),
):
    return await FarmService(db).get_mortality_logs(batch_id)


@router.post("/batches/{batch_id}/mortality", response_model=MortalityLogOut, status_code=status.HTTP_201_CREATED)
async def create_mortality(
    batch_id: int,
    data: MortalityLogCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    data.batch_id = batch_id
    return await FarmService(db).create_mortality_log(data)


@router.get("/batches/{batch_id}/vaccinations", response_model=list[VaccinationLogOut])
async def list_vaccinations(
    batch_id: int,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:read")),
):
    return await FarmService(db).get_vaccination_logs(batch_id)


@router.post("/batches/{batch_id}/vaccinations", response_model=VaccinationLogOut, status_code=status.HTTP_201_CREATED)
async def create_vaccination(
    batch_id: int,
    data: VaccinationLogCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    data.batch_id = batch_id
    return await FarmService(db).create_vaccination_log(data)


@router.put("/vaccinations/{log_id}", response_model=VaccinationLogOut)
async def update_vaccination(
    log_id: int,
    data: VaccinationLogUpdate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    return await FarmService(db).update_vaccination_log(log_id, data)


@router.get("/batches/{batch_id}/growth", response_model=list[GrowthLogOut])
async def list_growth(
    batch_id: int,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:read")),
):
    return await FarmService(db).get_growth_logs(batch_id)


@router.post("/batches/{batch_id}/growth", response_model=GrowthLogOut, status_code=status.HTTP_201_CREATED)
async def create_growth(
    batch_id: int,
    data: GrowthLogCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("farm:write")),
):
    data.batch_id = batch_id
    return await FarmService(db).create_growth_log(data)
