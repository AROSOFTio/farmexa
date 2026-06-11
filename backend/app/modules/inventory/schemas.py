from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.inventory import StockCategory, MovementType, TransferStatus, TransferType, StoreLocationType, GIVStatus, GRNStatus
from app.schemas.money import Money, NonNegativeMoney

class StockItemBase(BaseModel):
    name: str
    sku: Optional[str] = None
    category: StockCategory
    unit_of_measure: str
    reorder_level: float = 0.0
    unit_price: NonNegativeMoney = Field(default=0)
    description: Optional[str] = None
    is_active: bool = True

class StockItemCreate(StockItemBase):
    initial_quantity: float = 0.0
    initial_unit_cost: NonNegativeMoney = Field(default=0)

class StockItemUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[StockCategory] = None
    unit_of_measure: Optional[str] = None
    reorder_level: Optional[float] = None
    unit_price: Optional[NonNegativeMoney] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class StockItemOut(StockItemBase):
    id: int
    current_quantity: float
    average_cost: Money
    created_at: datetime

    class Config:
        from_attributes = True

class StockMovementBase(BaseModel):
    item_id: int
    movement_type: MovementType
    quantity: float
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    unit_cost: Optional[NonNegativeMoney] = None
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


class StockTransferBase(BaseModel):
    transfer_type: TransferType = TransferType.GIV
    item_id: int
    quantity: float
    unit: str = "kg"
    from_location: str
    to_location: str
    notes: Optional[str] = None


class StockTransferCreate(StockTransferBase):
    status: TransferStatus = TransferStatus.DRAFT


class StockTransferStatusUpdate(BaseModel):
    status: TransferStatus


class StockTransferOut(StockTransferBase):
    id: int
    reference_number: str
    status: TransferStatus
    issued_at: Optional[datetime] = None
    received_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# StoreLocation schemas
class StoreLocationBase(BaseModel):
    name: str
    code: str
    type: StoreLocationType = StoreLocationType.OTHER
    description: Optional[str] = None
    is_active: bool = True


class StoreLocationCreate(StoreLocationBase):
    pass


class StoreLocationUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    type: Optional[StoreLocationType] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class StoreLocationOut(StoreLocationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Goods Issue Voucher (GIV) schemas
class GIVBase(BaseModel):
    item_id: int
    quantity: float
    unit: str = "kg"
    from_store_location_id: int
    destination: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None


class GIVCreate(GIVBase):
    pass


class GIVUpdate(BaseModel):
    item_id: Optional[int] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    from_store_location_id: Optional[int] = None
    destination: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None


class GIVStatusUpdate(BaseModel):
    status: GIVStatus


class GIVOut(GIVBase):
    id: int
    giv_number: str
    status: GIVStatus
    issued_by_id: int
    approved_by_id: Optional[int] = None
    issued_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Goods Received Note (GRN) schemas
class GRNBase(BaseModel):
    item_id: int
    quantity: float
    unit: str = "kg"
    received_into_store_location_id: int
    source_type: str = "supplier"
    supplier_reference: Optional[str] = None
    unit_cost: Optional[NonNegativeMoney] = Field(default=0)
    notes: Optional[str] = None


class GRNCreate(GRNBase):
    pass


class GRNUpdate(BaseModel):
    item_id: Optional[int] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    received_into_store_location_id: Optional[int] = None
    source_type: Optional[str] = None
    supplier_reference: Optional[str] = None
    unit_cost: Optional[NonNegativeMoney] = None
    notes: Optional[str] = None


class GRNStatusUpdate(BaseModel):
    status: GRNStatus


class GRNOut(GRNBase):
    id: int
    grn_number: str
    status: GRNStatus
    received_by_id: int
    approved_by_id: Optional[int] = None
    received_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
