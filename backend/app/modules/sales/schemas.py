from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.sales import CustomerType, DeliveryStatus, InvoiceStatus, OrderStatus, PaymentMethod
from app.schemas.money import Money, NonNegativeMoney, PositiveMoney, PositiveQuantity


class CustomerBase(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    customer_type: CustomerType = CustomerType.RETAIL
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    credit_limit: NonNegativeMoney = Field(default=0)
    payment_terms_days: int = Field(default=30, ge=0)
    tax_id: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class CustomerCreate(CustomerBase):
    pass


class CustomerOut(CustomerBase):
    id: int
    balance: Money
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    customer_type: Optional[CustomerType] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    credit_limit: Optional[NonNegativeMoney] = None
    payment_terms_days: Optional[int] = Field(default=None, ge=0)
    tax_id: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class OrderItemBase(BaseModel):
    product_id: int
    quantity: PositiveQuantity
    unit_price: NonNegativeMoney
    batch_id: Optional[int] = None


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemOut(OrderItemBase):
    id: int
    subtotal: Money

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    customer_id: int
    status: OrderStatus = OrderStatus.PENDING
    notes: Optional[str] = None
    batch_id: Optional[int] = None


class OrderCreate(OrderBase):
    items: List[OrderItemCreate] = Field(min_length=1)


class OrderOut(OrderBase):
    id: int
    total_amount: Money
    created_at: datetime
    customer: Optional[CustomerOut] = None
    items: List[OrderItemOut] = []

    class Config:
        from_attributes = True


class PaymentBase(BaseModel):
    amount: PositiveMoney
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
    total_amount: NonNegativeMoney
    notes: Optional[str] = None
    batch_id: Optional[int] = None


class InvoiceCreate(InvoiceBase):
    pass


class InvoiceOut(InvoiceBase):
    id: int
    invoice_number: str
    paid_amount: Money
    pdf_generated_at: Optional[datetime] = None
    pdf_file_path: Optional[str] = None
    created_at: datetime
    customer: Optional[CustomerOut] = None
    payments: List[PaymentOut] = []

    class Config:
        from_attributes = True


class PosLineCreate(BaseModel):
    product_id: int
    quantity: PositiveQuantity
    unit_price: NonNegativeMoney
    batch_id: Optional[int] = None


class PosCheckoutCreate(BaseModel):
    customer_id: Optional[int] = None
    customer_name: str = "Walk-in Customer"
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    sale_payment_mode: Literal["full", "partial", "credit"] = "full"
    amount_paid_now: Optional[NonNegativeMoney] = None
    # cash_tendered: actual physical cash given by customer — can exceed total for change calculation
    cash_tendered: Optional[NonNegativeMoney] = None
    payment_method: Optional[PaymentMethod] = None
    payment_reference: Optional[str] = None
    credit_due_date: Optional[date] = None
    notes: Optional[str] = None
    batch_id: Optional[int] = None
    items: List[PosLineCreate] = Field(min_length=1)


class PosCheckoutOut(BaseModel):
    receipt_number: str
    order: OrderOut
    invoice: InvoiceOut
    payment: Optional[PaymentOut] = None
    balance_due: Money = Money(0)
    change_to_return: Money = Money(0)
    cash_tendered: Money = Money(0)
    email_status: Optional[str] = None


class DeliveryNoteBase(BaseModel):
    order_id: Optional[int] = None
    customer_id: int
    status: DeliveryStatus = DeliveryStatus.PENDING
    delivery_date: date
    delivery_address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class DeliveryNoteCreate(DeliveryNoteBase):
    pass


class DeliveryNoteUpdate(BaseModel):
    status: Optional[DeliveryStatus] = None
    delivery_address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class DeliveryNoteOut(DeliveryNoteBase):
    id: int
    delivery_number: str
    pdf_generated_at: Optional[datetime] = None
    pdf_file_path: Optional[str] = None
    created_at: datetime
    delivered_at: Optional[datetime] = None
    customer: Optional[CustomerOut] = None

    class Config:
        from_attributes = True
