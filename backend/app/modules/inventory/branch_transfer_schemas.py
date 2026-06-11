from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict
from app.models.branch_transfer import TransferStatus
from app.schemas.money import NonNegativeQuantity


class BranchTransferItemBase(BaseModel):
    stock_item_id: int
    quantity_shipped: NonNegativeQuantity
    notes: Optional[str] = None

class BranchTransferItemCreate(BranchTransferItemBase):
    pass

class BranchTransferItemOut(BranchTransferItemBase):
    id: int
    quantity_received: Optional[NonNegativeQuantity] = None

    model_config = ConfigDict(from_attributes=True)


class BranchTransferBase(BaseModel):
    to_branch_id: int
    notes: Optional[str] = None
    vehicle_registration: Optional[str] = None
    driver_name: Optional[str] = None

class BranchTransferCreate(BranchTransferBase):
    items: List[BranchTransferItemCreate]

class BranchTransferStatusUpdate(BaseModel):
    status: TransferStatus
    received_items: Optional[List[dict]] = None  # { item_id: int, quantity_received: float }

class BranchTransferOut(BranchTransferBase):
    id: int
    tenant_id: int
    transfer_number: str
    from_branch_id: int
    status: TransferStatus
    
    initiated_by_id: Optional[int]
    dispatched_by_id: Optional[int]
    received_by_id: Optional[int]
    
    transfer_date: datetime
    dispatch_date: Optional[datetime]
    receive_date: Optional[datetime]
    
    items: List[BranchTransferItemOut] = []
    
    model_config = ConfigDict(from_attributes=True)
