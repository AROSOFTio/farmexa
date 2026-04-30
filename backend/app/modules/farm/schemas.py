from datetime import date
from typing import Optional
from pydantic import BaseModel, Field

from app.models.farm import HouseStatus, BatchStatus, VaccinationStatus
from app.models.settings import ReferenceDataType


# ── Poultry House ──────────────────────────────────────────────

class PoultryHouseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    capacity: int = Field(..., gt=0)
    status: HouseStatus = HouseStatus.ACTIVE

class PoultryHouseCreate(PoultryHouseBase):
    pass

class PoultryHouseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    capacity: Optional[int] = Field(None, gt=0)
    status: Optional[HouseStatus] = None

class PoultryHouseOut(PoultryHouseBase):
    id: int
    model_config = {"from_attributes": True}


# ── Batch ──────────────────────────────────────────────────────

class BatchBase(BaseModel):
    batch_number: str = Field(..., min_length=1, max_length=50)
    house_id: int
    breed: str = Field(..., min_length=1, max_length=100)
    source: Optional[str] = None
    arrival_date: date
    initial_quantity: int = Field(..., gt=0)
    active_quantity: int = Field(..., ge=0)
    status: BatchStatus = BatchStatus.ACTIVE

class BatchCreate(BatchBase):
    pass

class BatchUpdate(BaseModel):
    house_id: Optional[int] = None
    breed: Optional[str] = None
    source: Optional[str] = None
    arrival_date: Optional[date] = None
    active_quantity: Optional[int] = Field(None, ge=0)
    status: Optional[BatchStatus] = None

class BatchOut(BatchBase):
    id: int
    house: Optional[PoultryHouseOut] = None
    model_config = {"from_attributes": True}


# ── Mortality Log ──────────────────────────────────────────────

class MortalityLogBase(BaseModel):
    batch_id: int
    record_date: date
    quantity: int = Field(..., gt=0)
    cause: Optional[str] = None
    notes: Optional[str] = None

class MortalityLogCreate(MortalityLogBase):
    pass

class MortalityLogOut(MortalityLogBase):
    id: int
    model_config = {"from_attributes": True}


# ── Vaccination Log ────────────────────────────────────────────

class VaccinationLogBase(BaseModel):
    batch_id: int
    vaccine_name: str = Field(..., min_length=1, max_length=150)
    scheduled_date: date
    administered_date: Optional[date] = None
    status: VaccinationStatus = VaccinationStatus.PENDING
    notes: Optional[str] = None

class VaccinationLogCreate(VaccinationLogBase):
    pass

class VaccinationLogUpdate(BaseModel):
    administered_date: Optional[date] = None
    status: Optional[VaccinationStatus] = None
    notes: Optional[str] = None

class VaccinationLogOut(VaccinationLogBase):
    id: int
    model_config = {"from_attributes": True}


# ── Growth Log ─────────────────────────────────────────────────

class GrowthLogBase(BaseModel):
    batch_id: int
    record_date: date
    avg_weight_grams: float = Field(..., gt=0)
    notes: Optional[str] = None

class GrowthLogCreate(GrowthLogBase):
    pass

class GrowthLogOut(GrowthLogBase):
    id: int
    model_config = {"from_attributes": True}


class ReferenceItemBase(BaseModel):
    reference_type: ReferenceDataType
    name: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = None
    sort_order: int = Field(default=0, ge=0)
    is_active: bool = True


class ReferenceItemCreate(ReferenceItemBase):
    pass


class ReferenceItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    sort_order: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ReferenceItemOut(ReferenceItemBase):
    id: int
    code: str

    model_config = {"from_attributes": True}
