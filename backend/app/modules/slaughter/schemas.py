from pydantic import BaseModel
from typing import Literal, Optional, List
from datetime import date, datetime
from app.models.slaughter import SlaughterStatus

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
    quantity: float
    unit_cost: Optional[float] = None

class SlaughterOutputCreate(SlaughterOutputBase):
    pass

class SlaughterOutputOut(SlaughterOutputBase):
    id: int
    total_cost: Optional[float] = None

    class Config:
        from_attributes = True

class SlaughterRecordBase(BaseModel):
    batch_id: int
    slaughter_date: date
    live_birds_count: int
    mortality_birds_count: int = 0
    total_live_weight: float
    waste_weight: float = 0.0
    condemned_birds_count: int = 0
    blood_weight: float = 0.0
    feathers_weight: float = 0.0
    offal_weight: float = 0.0
    head_weight: float = 0.0
    feet_weight: float = 0.0
    reusable_byproducts_weight: float = 0.0
    waste_disposal_notes: Optional[str] = None
    quality_inspection_status: str = "pending"
    cold_room_location: Optional[str] = None
    notes: Optional[str] = None

class SlaughterRecordCreate(SlaughterRecordBase):
    pass

class SlaughterRecordUpdate(BaseModel):
    status: Optional[SlaughterStatus] = None
    total_dressed_weight: Optional[float] = None
    waste_weight: Optional[float] = None
    mortality_birds_count: Optional[int] = None
    condemned_birds_count: Optional[int] = None
    blood_weight: Optional[float] = None
    feathers_weight: Optional[float] = None
    offal_weight: Optional[float] = None
    head_weight: Optional[float] = None
    feet_weight: Optional[float] = None
    reusable_byproducts_weight: Optional[float] = None
    waste_disposal_notes: Optional[str] = None
    quality_inspection_status: Optional[str] = None
    cold_room_location: Optional[str] = None
    approval_status: Optional[str] = None
    notes: Optional[str] = None

class SlaughterRecordOut(SlaughterRecordBase):
    id: int
    status: SlaughterStatus
    average_live_weight: Optional[float] = None
    total_dressed_weight: Optional[float] = None
    average_dressed_weight: Optional[float] = None
    yield_percentage: Optional[float] = None
    loss_percentage: Optional[float] = None
    quality_inspection_status: str
    cold_room_location: Optional[str] = None
    approval_status: str
    approved_at: Optional[datetime] = None
    inventory_posted_at: Optional[datetime] = None
    created_at: datetime
    outputs: List[SlaughterOutputOut] = []

    class Config:
        from_attributes = True
