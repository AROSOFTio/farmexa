from pydantic import BaseModel, Field, computed_field
from typing import Literal, Optional, List
from datetime import date, datetime
from app.models.slaughter import SlaughterStatus
from app.schemas.money import Money, NonNegativeMoney, NonNegativeWeight, Weight

SlaughterOutputType = Literal[
    "finished_product",
    "cut_part",
    "blood",
    "feathers",
    "offal",
    "byproduct",
    "waste",
    "dressed_chicken",
    "chicken_breast",
    "chicken_thighs",
    "chicken_wings",
    "chicken_drumsticks",
    "gizzards",
    "liver",
    "neck_backs",
    "poultry_manure",
    "feet",
    "head",
]


class SlaughterOutputBase(BaseModel):
    stock_item_id: int
    output_type: SlaughterOutputType = "dressed_chicken"
    quantity: NonNegativeWeight
    unit_cost: Optional[NonNegativeMoney] = None

class SlaughterOutputCreate(SlaughterOutputBase):
    pass

class SlaughterOutputOut(SlaughterOutputBase):
    id: int
    total_cost: Optional[Money] = None

    class Config:
        from_attributes = True


class SlaughterByProductBase(BaseModel):
    stock_item_id: Optional[int] = None
    store_location_id: Optional[int] = None
    byproduct_name: str
    quantity_weight: NonNegativeWeight
    unit: str = "kg"
    value: Optional[NonNegativeMoney] = Field(default=0)
    unit_cost: Optional[NonNegativeMoney] = None
    total_value: Optional[Money] = None
    notes: Optional[str] = None


class SlaughterByProductCreate(SlaughterByProductBase):
    pass


class SlaughterByProductUpdate(BaseModel):
    stock_item_id: Optional[int] = None
    store_location_id: Optional[int] = None
    byproduct_name: Optional[str] = None
    quantity_weight: Optional[NonNegativeWeight] = None
    unit: Optional[str] = None
    value: Optional[NonNegativeMoney] = None
    unit_cost: Optional[NonNegativeMoney] = None
    total_value: Optional[Money] = None
    notes: Optional[str] = None


class SlaughterByProductOut(SlaughterByProductBase):
    id: int
    slaughter_record_id: int

    class Config:
        from_attributes = True


class SlaughterRecordBase(BaseModel):
    batch_id: int
    slaughter_date: date
    live_birds_count: int
    mortality_birds_count: int = 0
    total_live_weight: NonNegativeWeight
    waste_weight: NonNegativeWeight = Field(default=0)
    condemned_birds_count: int = 0
    blood_weight: NonNegativeWeight = Field(default=0)
    feathers_weight: NonNegativeWeight = Field(default=0)
    offal_weight: NonNegativeWeight = Field(default=0)
    head_weight: NonNegativeWeight = Field(default=0)
    feet_weight: NonNegativeWeight = Field(default=0)
    reusable_byproducts_weight: NonNegativeWeight = Field(default=0)
    waste_disposal_notes: Optional[str] = None
    quality_inspection_status: str = "pending"
    cold_room_location: Optional[str] = None
    notes: Optional[str] = None
    direct_labour_cost: Optional[NonNegativeMoney] = Field(default=0)
    overhead_cost: Optional[NonNegativeMoney] = Field(default=0)
    chick_cost_override: Optional[NonNegativeMoney] = None

class SlaughterRecordCreate(SlaughterRecordBase):
    pass

class SlaughterRecordUpdate(BaseModel):
    status: Optional[SlaughterStatus] = None
    total_dressed_weight: Optional[NonNegativeWeight] = None
    waste_weight: Optional[NonNegativeWeight] = None
    mortality_birds_count: Optional[int] = None
    condemned_birds_count: Optional[int] = None
    blood_weight: Optional[NonNegativeWeight] = None
    feathers_weight: Optional[NonNegativeWeight] = None
    offal_weight: Optional[NonNegativeWeight] = None
    head_weight: Optional[NonNegativeWeight] = None
    feet_weight: Optional[NonNegativeWeight] = None
    reusable_byproducts_weight: Optional[NonNegativeWeight] = None
    waste_disposal_notes: Optional[str] = None
    quality_inspection_status: Optional[str] = None
    cold_room_location: Optional[str] = None
    approval_status: Optional[str] = None
    notes: Optional[str] = None
    direct_labour_cost: Optional[NonNegativeMoney] = None
    overhead_cost: Optional[NonNegativeMoney] = None
    chick_cost_override: Optional[NonNegativeMoney] = None

class SlaughterRecordOut(SlaughterRecordBase):
    id: int
    status: SlaughterStatus
    average_live_weight: Optional[Weight] = None
    total_dressed_weight: Optional[Weight] = None
    average_dressed_weight: Optional[Weight] = None
    yield_percentage: Optional[float] = None
    loss_percentage: Optional[float] = None
    quality_inspection_status: str
    cold_room_location: Optional[str] = None
    approval_status: str
    approved_at: Optional[datetime] = None
    inventory_posted_at: Optional[datetime] = None
    total_production_cost: Optional[Money] = None
    cost_per_kg: Optional[Money] = None
    production_journal_id: Optional[int] = None
    created_at: datetime
    outputs: List[SlaughterOutputOut] = []
    byproducts: List[SlaughterByProductOut] = []

    @computed_field
    @property
    def inventory_posted(self) -> bool:
        return self.inventory_posted_at is not None

    @computed_field
    @property
    def workflow_state(self) -> str:
        if self.status == SlaughterStatus.COMPLETED and self.inventory_posted_at is None:
            return "completed_awaiting_output_posting"
        if self.status == SlaughterStatus.COMPLETED:
            return "completed_inventory_posted"
        return self.status.value

    class Config:
        from_attributes = True

