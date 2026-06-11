from datetime import date
from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.money import Money, NonNegativeMoney


# ── Supplier ───────────────────────────────────────────────────

class SupplierBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    supplier_type: Optional[str] = None
    products_supplied: Optional[str] = None
    contact_person: Optional[str] = None
    supplier_officer: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[str] = None
    lead_time_days: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    is_active: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    supplier_type: Optional[str] = None
    products_supplied: Optional[str] = None
    contact_person: Optional[str] = None
    supplier_officer: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    tax_id: Optional[str] = None
    payment_terms: Optional[str] = None
    lead_time_days: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None
    is_active: Optional[bool] = None

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
    feed_item_id: int = 0
    other_feed_item_name: Optional[str] = Field(default=None, max_length=150)
    other_feed_category_id: Optional[int] = None
    other_feed_unit: Optional[str] = Field(default="kg", max_length=50)
    other_reorder_threshold: float = Field(default=0.0, ge=0.0)
    quantity: float = Field(..., gt=0.0)
    unit_price: NonNegativeMoney
    total_price: NonNegativeMoney

class FeedPurchaseItemOut(BaseModel):
    id: int
    purchase_id: int
    feed_item_id: int
    quantity: float
    unit_price: Money
    total_price: Money
    model_config = {"from_attributes": True}

class FeedPurchaseBase(BaseModel):
    supplier_id: int
    purchase_date: date
    invoice_number: Optional[str] = None
    total_amount: NonNegativeMoney
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


class FeedFormulationIngredientCreate(BaseModel):
    feed_item_id: int
    percentage: float = Field(gt=0, le=100)


class FeedIngredientItemOut(BaseModel):
    id: int
    name: str
    unit: str
    current_stock: float
    reorder_threshold: float
    model_config = {"from_attributes": True}


class FeedFormulationIngredientOut(FeedFormulationIngredientCreate):
    id: int
    formulation_id: int
    feed_item: Optional[FeedIngredientItemOut] = None
    model_config = {"from_attributes": True}


class FeedFormulationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    stage: str = Field(pattern="^(Starter|Grower|Finisher)$")
    texture: str = Field(pattern="^(Mash|Pellet)$")
    output_quantity_kg: float = Field(gt=0)
    ingredients: list[FeedFormulationIngredientCreate] = Field(min_length=1)


class FeedFormulationOut(BaseModel):
    id: int
    name: str
    stage: str
    texture: str
    output_quantity_kg: float
    cost_per_kg: Money
    ingredients: list[FeedFormulationIngredientOut] = []
    model_config = {"from_attributes": True}


class FeedProductionCreate(BaseModel):
    formulation_id: int
    output_quantity_kg: float = Field(gt=0)
    notes: Optional[str] = None


class FeedProductionOut(BaseModel):
    id: int
    batch_number: str
    formulation_id: int
    output_item_id: int
    output_quantity_kg: float
    cost_per_kg: Money
    notes: Optional[str] = None
    model_config = {"from_attributes": True}
