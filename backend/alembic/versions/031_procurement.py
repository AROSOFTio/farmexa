"""
Procurement module: purchase orders, PO items, supplier invoices, supplier payments.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "031_procurement"
down_revision = "030_hr_payroll"
branch_labels = None
depends_on = None


po_status = postgresql.ENUM(
    "draft", "submitted", "approved", "partially_received", "fully_received",
    "cancelled", "closed",
    name="postatus", create_type=False,
)
supplier_invoice_status = postgresql.ENUM(
    "draft", "approved", "partial", "paid", "overdue", "cancelled",
    name="supplierinvoicestatus", create_type=False,
)
supplier_payment_method = postgresql.ENUM(
    "cash", "bank_transfer", "mobile_money", "cheque",
    name="supplierpaymentmethod", create_type=False,
)


def upgrade() -> None:
    po_status.create(op.get_bind(), checkfirst=True)
    supplier_invoice_status.create(op.get_bind(), checkfirst=True)
    supplier_payment_method.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("po_number", sa.String(length=50), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("status", po_status, nullable=False),
        sa.Column("order_date", sa.Date(), nullable=False),
        sa.Column("expected_delivery_date", sa.Date(), nullable=True),
        sa.Column("delivery_address", sa.Text(), nullable=True),
        sa.Column("delivery_branch_id", sa.Integer(), nullable=True),
        sa.Column("subtotal", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("tax_amount", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("terms_and_conditions", sa.Text(), nullable=True),
        sa.Column("approved_by_id", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["delivery_branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("po_number", "tenant_id", name="uq_po_number_tenant"),
    )
    op.create_index(op.f("ix_purchase_orders_id"), "purchase_orders", ["id"])
    op.create_index(op.f("ix_purchase_orders_tenant_id"), "purchase_orders", ["tenant_id"])
    op.create_index(op.f("ix_purchase_orders_branch_id"), "purchase_orders", ["branch_id"])
    op.create_index(op.f("ix_purchase_orders_po_number"), "purchase_orders", ["po_number"])
    op.create_index(op.f("ix_purchase_orders_supplier_id"), "purchase_orders", ["supplier_id"])
    op.create_index(op.f("ix_purchase_orders_status"), "purchase_orders", ["status"])

    op.create_table(
        "purchase_order_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("po_id", sa.Integer(), nullable=False),
        sa.Column("stock_item_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("quantity_ordered", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column("unit_of_measure", sa.String(length=50), nullable=True),
        sa.Column("unit_price", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("total_price", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("quantity_received", sa.Numeric(precision=14, scale=4), nullable=False),
        sa.ForeignKeyConstraint(["po_id"], ["purchase_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["stock_item_id"], ["stock_items.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_purchase_order_items_id"), "purchase_order_items", ["id"])
    op.create_index(op.f("ix_purchase_order_items_po_id"), "purchase_order_items", ["po_id"])

    op.create_table(
        "supplier_invoices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("po_id", sa.Integer(), nullable=True),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("invoice_number", sa.String(length=100), nullable=False),
        sa.Column("invoice_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("subtotal", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("tax_amount", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("amount_paid", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("status", supplier_invoice_status, nullable=False),
        sa.Column("journal_entry_id", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["po_id"], ["purchase_orders.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_number", "supplier_id", "tenant_id", name="uq_supplier_invoice_number"),
    )
    op.create_index(op.f("ix_supplier_invoices_id"), "supplier_invoices", ["id"])
    op.create_index(op.f("ix_supplier_invoices_tenant_id"), "supplier_invoices", ["tenant_id"])
    op.create_index(op.f("ix_supplier_invoices_branch_id"), "supplier_invoices", ["branch_id"])
    op.create_index(op.f("ix_supplier_invoices_po_id"), "supplier_invoices", ["po_id"])
    op.create_index(op.f("ix_supplier_invoices_supplier_id"), "supplier_invoices", ["supplier_id"])
    op.create_index(op.f("ix_supplier_invoices_status"), "supplier_invoices", ["status"])
    op.create_index(op.f("ix_supplier_invoices_invoice_number"), "supplier_invoices", ["invoice_number"])

    op.create_table(
        "supplier_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("supplier_invoice_id", sa.Integer(), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("payment_method", supplier_payment_method, nullable=False),
        sa.Column("reference", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("journal_entry_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supplier_invoice_id"], ["supplier_invoices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_supplier_payments_id"), "supplier_payments", ["id"])
    op.create_index(op.f("ix_supplier_payments_tenant_id"), "supplier_payments", ["tenant_id"])
    op.create_index(op.f("ix_supplier_payments_supplier_invoice_id"), "supplier_payments", ["supplier_invoice_id"])


def downgrade() -> None:
    op.drop_table("supplier_payments")
    op.drop_table("supplier_invoices")
    op.drop_table("purchase_order_items")
    op.drop_table("purchase_orders")
    supplier_payment_method.drop(op.get_bind(), checkfirst=True)
    supplier_invoice_status.drop(op.get_bind(), checkfirst=True)
    po_status.drop(op.get_bind(), checkfirst=True)
