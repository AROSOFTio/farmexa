from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.auth.service import get_current_user
from app.models.user import User
from app.modules.farm.schemas import (
    PoultryHouseCreate, PoultryHouseUpdate, PoultryHouseOut,
    BatchCreate, BatchUpdate, BatchOut,
    MortalityLogCreate, MortalityLogOut,
    VaccinationLogCreate, VaccinationLogUpdate, VaccinationLogOut,
    GrowthLogCreate, GrowthLogOut
)
from app.modules.farm.service import FarmService

router = APIRouter(prefix="/farm", tags=["Farm Management"])

# ── Poultry Houses ───────────────────────────────────────────
@router.get("/houses", response_model=list[PoultryHouseOut])
async def list_houses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.get_houses()

@router.get("/houses/{house_id}", response_model=PoultryHouseOut)
async def get_house(
    house_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.get_house(house_id)

@router.post("/houses", response_model=PoultryHouseOut, status_code=status.HTTP_201_CREATED)
async def create_house(
    data: PoultryHouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.create_house(data)

@router.put("/houses/{house_id}", response_model=PoultryHouseOut)
async def update_house(
    house_id: int,
    data: PoultryHouseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.update_house(house_id, data)

# ── Batches ──────────────────────────────────────────────────
@router.get("/batches", response_model=list[BatchOut])
async def list_batches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.get_batches()

@router.get("/batches/{batch_id}", response_model=BatchOut)
async def get_batch(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.get_batch(batch_id)

@router.post("/batches", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
async def create_batch(
    data: BatchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.create_batch(data)

@router.put("/batches/{batch_id}", response_model=BatchOut)
async def update_batch(
    batch_id: int,
    data: BatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.update_batch(batch_id, data)

# ── Mortality ────────────────────────────────────────────────
@router.get("/batches/{batch_id}/mortality", response_model=list[MortalityLogOut])
async def list_mortality(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.get_mortality_logs(batch_id)

@router.post("/batches/{batch_id}/mortality", response_model=MortalityLogOut, status_code=status.HTTP_201_CREATED)
async def create_mortality(
    batch_id: int,
    data: MortalityLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data.batch_id = batch_id
    service = FarmService(db)
    return await service.create_mortality_log(data)

# ── Vaccination ──────────────────────────────────────────────
@router.get("/batches/{batch_id}/vaccinations", response_model=list[VaccinationLogOut])
async def list_vaccinations(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.get_vaccination_logs(batch_id)

@router.post("/batches/{batch_id}/vaccinations", response_model=VaccinationLogOut, status_code=status.HTTP_201_CREATED)
async def create_vaccination(
    batch_id: int,
    data: VaccinationLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data.batch_id = batch_id
    service = FarmService(db)
    return await service.create_vaccination_log(data)

@router.put("/vaccinations/{log_id}", response_model=VaccinationLogOut)
async def update_vaccination(
    log_id: int,
    data: VaccinationLogUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.update_vaccination_log(log_id, data)

# ── Growth ───────────────────────────────────────────────────
@router.get("/batches/{batch_id}/growth", response_model=list[GrowthLogOut])
async def list_growth(
    batch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FarmService(db)
    return await service.get_growth_logs(batch_id)

@router.post("/batches/{batch_id}/growth", response_model=GrowthLogOut, status_code=status.HTTP_201_CREATED)
async def create_growth(
    batch_id: int,
    data: GrowthLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data.batch_id = batch_id
    service = FarmService(db)
    return await service.create_growth_log(data)
