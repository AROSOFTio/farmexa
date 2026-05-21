from datetime import date
from typing import Optional

from pydantic import BaseModel, Field

from app.models.farm import BatchStatus, HouseStatus, VaccinationStatus
from app.models.settings import ReferenceDataType


class PoultryHouseSectionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    section_type: str = Field(..., min_length=1, max_length=80)
    capacity: int = Field(..., gt=0)
    status: HouseStatus = HouseStatus.ACTIVE
    notes: Optional[str] = None


class PoultryHouseSectionCreate(PoultryHouseSectionBase):
    pass


class PoultryHouseSectionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    section_type: Optional[str] = Field(default=None, min_length=1, max_length=80)
    capacity: Optional[int] = Field(default=None, gt=0)
    status: Optional[HouseStatus] = None
    notes: Optional[str] = None


class PoultryHouseSectionOut(PoultryHouseSectionBase):
    id: int
    house_id: int
    occupied_capacity: int = 0
    available_capacity: int = 0

    model_config = {"from_attributes": True}


class PoultryHouseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    capacity: int = Field(..., gt=0)
    status: HouseStatus = HouseStatus.ACTIVE


class PoultryHouseCreate(PoultryHouseBase):
    sections: list[PoultryHouseSectionCreate] = Field(default_factory=list)


class PoultryHouseUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    capacity: Optional[int] = Field(default=None, gt=0)
    status: Optional[HouseStatus] = None
    sections: Optional[list[PoultryHouseSectionCreate]] = None


class PoultryHouseOut(PoultryHouseBase):
    id: int
    occupied_capacity: int = 0
    available_capacity: int = 0
    active_batch_count: int = 0
    sections: list[PoultryHouseSectionOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class BatchBase(BaseModel):
    batch_number: str = Field(..., min_length=1, max_length=50)
    house_id: int
    section_id: Optional[int] = None
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
    section_id: Optional[int] = None
    breed: Optional[str] = None
    source: Optional[str] = None
    arrival_date: Optional[date] = None
    active_quantity: Optional[int] = Field(default=None, ge=0)
    status: Optional[BatchStatus] = None


class BatchOut(BatchBase):
    id: int
    house: Optional[PoultryHouseOut] = None
    section: Optional[PoultryHouseSectionOut] = None
    stock_item_id: Optional[int] = None

    model_config = {"from_attributes": True}


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


class VaccinationLogBase(BaseModel):
    batch_id: int
    vaccine_name: str = Field(..., min_length=1, max_length=150)
    scheduled_date: date
    administered_date: Optional[date] = None
    status: VaccinationStatus = VaccinationStatus.PENDING
    notes: Optional[str] = None
    vaccine_item_id: Optional[int] = None
    dosage_per_bird: Optional[float] = Field(default=None, ge=0)
    total_dosage: Optional[float] = Field(default=None, ge=0)
    quantity_used: Optional[float] = Field(default=None, ge=0)
    unit: Optional[str] = None
    birds_vaccinated: Optional[int] = Field(default=None, ge=0)


class VaccinationLogCreate(VaccinationLogBase):
    pass


class VaccinationLogUpdate(BaseModel):
    administered_date: Optional[date] = None
    status: Optional[VaccinationStatus] = None
    notes: Optional[str] = None
    vaccine_item_id: Optional[int] = None
    dosage_per_bird: Optional[float] = Field(default=None, ge=0)
    total_dosage: Optional[float] = Field(default=None, ge=0)
    quantity_used: Optional[float] = Field(default=None, ge=0)
    unit: Optional[str] = None
    birds_vaccinated: Optional[int] = Field(default=None, ge=0)


class VaccinationLogOut(VaccinationLogBase):
    id: int
    administered_by_id: Optional[int] = None

    model_config = {"from_attributes": True}


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


class MedicationAdministrationBase(BaseModel):
    batch_id: int
    medicine_item_id: int
    treatment_date: date
    reason: Optional[str] = None
    administration_method: str = Field(..., min_length=1, max_length=50)
    dosage_per_bird: Optional[float] = Field(default=None, ge=0)
    total_quantity_used: float = Field(..., gt=0)
    unit: str = Field(default="ml", min_length=1, max_length=20)
    birds_treated: int = Field(..., gt=0)
    notes: Optional[str] = None


class MedicationAdministrationCreate(MedicationAdministrationBase):
    pass


class MedicationAdministrationUpdate(BaseModel):
    treatment_date: Optional[date] = None
    reason: Optional[str] = None
    administration_method: Optional[str] = Field(default=None, min_length=1, max_length=50)
    dosage_per_bird: Optional[float] = Field(default=None, ge=0)
    total_quantity_used: Optional[float] = Field(default=None, gt=0)
    unit: Optional[str] = Field(default=None, min_length=1, max_length=20)
    birds_treated: Optional[int] = Field(default=None, gt=0)
    notes: Optional[str] = None


class MedicationAdministrationOut(MedicationAdministrationBase):
    id: int
    administered_by_id: int
    created_at: date

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
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    sort_order: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None


class ReferenceItemOut(ReferenceItemBase):
    id: int
    code: str

    model_config = {"from_attributes": True}
