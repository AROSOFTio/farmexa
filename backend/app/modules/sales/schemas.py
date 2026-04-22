from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.models.sales import CustomerType, OrderStatus, InvoiceStatus, PaymentMethod

class CustomerBase(BaseModel):
    name: str
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
    quantity: float
    unit_price: float

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
    items: List[OrderItemCreate]

class OrderOut(OrderBase):
    id: int
    total_amount: float
    created_at: datetime
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True

class PaymentBase(BaseModel):
    amount: float
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
    total_amount: float

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceOut(InvoiceBase):
    id: int
    invoice_number: str
    paid_amount: float
    created_at: datetime
    payments: List[PaymentOut] = []

    class Config:
        from_attributes = True
