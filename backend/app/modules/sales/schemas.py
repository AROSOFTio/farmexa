from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.sales import CustomerType, InvoiceStatus, OrderStatus, PaymentMethod


class CustomerBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    customer_type: CustomerType = CustomerType.RETAIL
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool = True


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(CustomerBase):
    id: int
    balance: float
    created_at: datetime

    class Config:
        from_attributes = True


class OrderItemBase(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)
    unit_price: float = Field(ge=0)


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemOut(OrderItemBase):
    id: int
    subtotal: float

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    customer_id: int
    status: OrderStatus = OrderStatus.PENDING
    notes: Optional[str] = None


class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = Field(min_length=1)


class OrderOut(OrderBase):
    id: int
    total_amount: float
    created_at: datetime
    customer: Optional[CustomerOut] = None
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True


class PaymentBase(BaseModel):
    amount: float = Field(gt=0)
    payment_method: PaymentMethod
    payment_date: date
    reference: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentOut(PaymentBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class InvoiceBase(BaseModel):
    order_id: Optional[int] = None
    customer_id: int
    status: InvoiceStatus = InvoiceStatus.DRAFT
    issue_date: date
    due_date: date
    total_amount: float = Field(ge=0)


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceOut(InvoiceBase):
    id: int
    invoice_number: str
    paid_amount: float
    created_at: datetime
    customer: Optional[CustomerOut] = None
    payments: List[PaymentOut] = []

    class Config:
        from_attributes = True
