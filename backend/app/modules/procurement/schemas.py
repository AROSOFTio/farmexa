"""Pydantic schemas for the procurement module."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.procurement import POStatus, SupplierInvoiceStatus, SupplierPaymentMethod
from app.schemas.money import Money, NonNegativeMoney, NonNegativeQuantity, PositiveMoney, PositiveQuantity


# ---------------------------------------------------------------------------
# Purchase Order Items
# ---------------------------------------------------------------------------

class POItemBase(BaseModel):
    stock_item_id: Optional[int] = None
    description: str = Field(min_length=1, max_length=255)
    quantity_ordered: PositiveQuantity
    unit_of_measure: Optional[str] = Field(default=None, max_length=50)
    unit_price: NonNegativeMoney = Field(default=0)


class POItemCreate(POItemBase):
    pass


class POItemOut(POItemBase):
    id: int
    po_id: int
    total_price: Money
    quantity_received: NonNegativeQuantity

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Purchase Orders
# ---------------------------------------------------------------------------

class PurchaseOrderBase(BaseModel):
    supplier_id: int
    branch_id: Optional[int] = None
    order_date: date
    expected_delivery_date: Optional[date] = None
    delivery_address: Optional[str] = None
    delivery_branch_id: Optional[int] = None
    tax_amount: NonNegativeMoney = Field(default=0)
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[POItemCreate] = Field(min_length=1)


class PurchaseOrderUpdate(BaseModel):
    supplier_id: Optional[int] = None
    branch_id: Optional[int] = None
    order_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    delivery_address: Optional[str] = None
    delivery_branch_id: Optional[int] = None
    tax_amount: Optional[NonNegativeMoney] = None
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    items: Optional[List[POItemCreate]] = None


class SupplierBrief(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseOrderOut(PurchaseOrderBase):
    id: int
    tenant_id: int
    po_number: str
    status: POStatus
    subtotal: Money
    total_amount: Money
    approved_by_id: Optional[int] = None
    created_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    supplier: Optional[SupplierBrief] = None
    items: List[POItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class ReceiveItemIn(BaseModel):
    item_id: int
    qty_received: PositiveQuantity
    branch_id: Optional[int] = None


class ReceiveGoodsRequest(BaseModel):
    received_items: List[ReceiveItemIn] = Field(min_length=1)


# ---------------------------------------------------------------------------
# Supplier Invoices
# ---------------------------------------------------------------------------

class SupplierInvoiceBase(BaseModel):
    supplier_id: int
    branch_id: Optional[int] = None
    po_id: Optional[int] = None
    invoice_number: str = Field(min_length=1, max_length=100)
    invoice_date: date
    due_date: Optional[date] = None
    subtotal: NonNegativeMoney = Field(default=0)
    tax_amount: NonNegativeMoney = Field(default=0)
    total_amount: PositiveMoney
    notes: Optional[str] = None


class SupplierInvoiceCreate(SupplierInvoiceBase):
    pass


class SupplierInvoiceOut(SupplierInvoiceBase):
    id: int
    tenant_id: int
    amount_paid: Money
    status: SupplierInvoiceStatus
    journal_entry_id: Optional[int] = None
    created_at: Optional[datetime] = None
    supplier: Optional[SupplierBrief] = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Supplier Payments
# ---------------------------------------------------------------------------

class SupplierPaymentCreate(BaseModel):
    payment_date: date
    amount: PositiveMoney
    payment_method: SupplierPaymentMethod = SupplierPaymentMethod.CASH
    reference: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None


class SupplierPaymentOut(SupplierPaymentCreate):
    id: int
    tenant_id: int
    supplier_invoice_id: int
    journal_entry_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
