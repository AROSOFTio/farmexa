from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.inventory import StockCategory, MovementType

class StockItemBase(BaseModel):
    name: str
    sku: Optional[str] = None
    category: StockCategory
    unit_of_measure: str
    reorder_level: float = 0.0
    unit_price: float = 0.0
    description: Optional[str] = None
    is_active: bool = True

class StockItemCreate(StockItemBase):
    initial_quantity: float = 0.0
    initial_unit_cost: float = 0.0

class StockItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[StockCategory] = None
    unit_of_measure: Optional[str] = None
    reorder_level: Optional[float] = None
    unit_price: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class StockItemOut(StockItemBase):
    id: int
    current_quantity: float
    average_cost: float
    created_at: datetime

    class Config:
        from_attributes = True

class StockMovementBase(BaseModel):
    item_id: int
    movement_type: MovementType
    quantity: float
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    unit_cost: Optional[float] = None
    notes: Optional[str] = None

class StockMovementCreate(StockMovementBase):
    pass

class StockMovementOut(StockMovementBase):
    id: int
    previous_quantity: float
    new_quantity: float
    created_at: datetime

    class Config:
        from_attributes = True
