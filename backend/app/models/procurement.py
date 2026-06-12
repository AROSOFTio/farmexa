"""
Procurement Models

Purchase order workflow: PO → goods receipt (GRN) → supplier invoice (AP) → payment.
Journal automation is handled in the procurement service.
"""

from datetime import datetime, timezone
import enum

from sqlalchemy import (
    Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.enums import db_enum


class POStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PARTIALLY_RECEIVED = "partially_received"
    FULLY_RECEIVED = "fully_received"
    CANCELLED = "cancelled"
    CLOSED = "closed"


class SupplierInvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    PARTIAL = "partial"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class SupplierPaymentMethod(str, enum.Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    MOBILE_MONEY = "mobile_money"
    CHEQUE = "cheque"


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        UniqueConstraint("po_number", "tenant_id", name="uq_po_number_tenant"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    po_number = Column(String(50), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)

    status = Column(db_enum(POStatus, name="postatus"), nullable=False, default=POStatus.DRAFT, index=True)
    order_date = Column(Date, nullable=False)
    expected_delivery_date = Column(Date, nullable=True)
    delivery_address = Column(Text, nullable=True)
    delivery_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)

    subtotal = Column(Numeric(18, 4), nullable=False, default=0)
    tax_amount = Column(Numeric(18, 4), nullable=False, default=0)
    total_amount = Column(Numeric(18, 4), nullable=False, default=0)

    notes = Column(Text, nullable=True)
    terms_and_conditions = Column(Text, nullable=True)

    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")
    delivery_branch = relationship("Branch", foreign_keys=[delivery_branch_id])


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=True)

    description = Column(String(255), nullable=False)
    quantity_ordered = Column(Numeric(14, 4), nullable=False)
    unit_of_measure = Column(String(50), nullable=True)
    unit_price = Column(Numeric(18, 4), nullable=False, default=0)
    total_price = Column(Numeric(18, 4), nullable=False, default=0)
    quantity_received = Column(Numeric(14, 4), nullable=False, default=0)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    stock_item = relationship("StockItem")


class SupplierInvoice(Base):
    __tablename__ = "supplier_invoices"
    __table_args__ = (
        UniqueConstraint("invoice_number", "supplier_id", "tenant_id", name="uq_supplier_invoice_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)

    invoice_number = Column(String(100), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)

    subtotal = Column(Numeric(18, 4), nullable=False, default=0)
    tax_amount = Column(Numeric(18, 4), nullable=False, default=0)
    total_amount = Column(Numeric(18, 4), nullable=False, default=0)
    amount_paid = Column(Numeric(18, 4), nullable=False, default=0)

    status = Column(
        db_enum(SupplierInvoiceStatus, name="supplierinvoicestatus"),
        nullable=False, default=SupplierInvoiceStatus.DRAFT, index=True,
    )
    journal_entry_id = Column(Integer, nullable=True)  # references journal_entries.id
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier")
    purchase_order = relationship("PurchaseOrder")
    payments = relationship("SupplierPayment", back_populates="invoice", cascade="all, delete-orphan")


class SupplierPayment(Base):
    __tablename__ = "supplier_payments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_invoice_id = Column(
        Integer, ForeignKey("supplier_invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )

    payment_date = Column(Date, nullable=False)
    amount = Column(Numeric(18, 4), nullable=False)
    payment_method = Column(
        db_enum(SupplierPaymentMethod, name="supplierpaymentmethod"),
        nullable=False, default=SupplierPaymentMethod.CASH,
    )
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    journal_entry_id = Column(Integer, nullable=True)  # references journal_entries.id
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    invoice = relationship("SupplierInvoice", back_populates="payments")
