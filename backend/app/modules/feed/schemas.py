from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


# ── Supplier ───────────────────────────────────────────────────

class SupplierBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class SupplierOut(SupplierBase):
    id: int
    model_config = {"from_attributes": True}


# ── Feed Category ──────────────────────────────────────────────

class FeedCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

class FeedCategoryCreate(FeedCategoryBase):
    pass

class FeedCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None

class FeedCategoryOut(FeedCategoryBase):
    id: int
    model_config = {"from_attributes": True}


# ── Feed Item ──────────────────────────────────────────────────

class FeedItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    category_id: int
    unit: str = Field(default="kg", max_length=50)
    reorder_threshold: float = Field(default=0.0, ge=0.0)

class FeedItemCreate(FeedItemBase):
    pass

class FeedItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    category_id: Optional[int] = None
    unit: Optional[str] = None
    reorder_threshold: Optional[float] = Field(None, ge=0.0)

class FeedItemOut(FeedItemBase):
    id: int
    current_stock: float
    category: Optional[FeedCategoryOut] = None
    model_config = {"from_attributes": True}


# ── Feed Purchase ──────────────────────────────────────────────

class FeedPurchaseItemCreate(BaseModel):
    feed_item_id: int
    quantity: float = Field(..., gt=0.0)
    unit_price: float = Field(..., ge=0.0)
    total_price: float = Field(..., ge=0.0)

class FeedPurchaseItemOut(FeedPurchaseItemCreate):
    id: int
    purchase_id: int
    model_config = {"from_attributes": True}

class FeedPurchaseBase(BaseModel):
    supplier_id: int
    purchase_date: date
    invoice_number: Optional[str] = None
    total_amount: float = Field(..., ge=0.0)
    notes: Optional[str] = None

class FeedPurchaseCreate(FeedPurchaseBase):
    items: list[FeedPurchaseItemCreate] = Field(..., min_length=1)

class FeedPurchaseOut(FeedPurchaseBase):
    id: int
    supplier: Optional[SupplierOut] = None
    items: list[FeedPurchaseItemOut] = []
    model_config = {"from_attributes": True}


# ── Feed Consumption ───────────────────────────────────────────

class FeedConsumptionBase(BaseModel):
    batch_id: int
    feed_item_id: int
    record_date: date
    quantity: float = Field(..., gt=0.0)
    notes: Optional[str] = None

class FeedConsumptionCreate(FeedConsumptionBase):
    pass

class FeedConsumptionOut(FeedConsumptionBase):
    id: int
    model_config = {"from_attributes": True}
