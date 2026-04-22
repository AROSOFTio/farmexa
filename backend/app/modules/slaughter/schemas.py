from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.models.slaughter import SlaughterStatus

class SlaughterOutputBase(BaseModel):
    stock_item_id: int
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
    total_live_weight: float
    waste_weight: float = 0.0
    condemned_birds_count: int = 0
    notes: Optional[str] = None

class SlaughterRecordCreate(SlaughterRecordBase):
    pass

class SlaughterRecordUpdate(BaseModel):
    status: Optional[SlaughterStatus] = None
    total_dressed_weight: Optional[float] = None
    waste_weight: Optional[float] = None
    condemned_birds_count: Optional[int] = None
    notes: Optional[str] = None

class SlaughterRecordOut(SlaughterRecordBase):
    id: int
    status: SlaughterStatus
    total_dressed_weight: Optional[float] = None
    yield_percentage: Optional[float] = None
    created_at: datetime
    outputs: List[SlaughterOutputOut] = []

    class Config:
        from_attributes = True
