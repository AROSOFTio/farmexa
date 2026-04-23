"""Add inventory, slaughter, sales, finance, and settings tables.

Revision ID: 003_operations_modules
Revises: 002_farm_and_feed
Create Date: 2026-04-23 20:45:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "003_operations_modules"
down_revision = "002_farm_and_feed"
branch_labels = None
depends_on = None


stock_category = postgresql.ENUM(
    "raw_material",
    "packaging",
    "medicine",
    "finished_product",
    "other",
    name="stockcategory",
    create_type=False,
)
movement_type = postgresql.ENUM("in", "out", "adjustment", name="movementtype", create_type=False)
customer_type = postgresql.ENUM("retail", "wholesale", name="customertype", create_type=False)
order_status = postgresql.ENUM("pending", "completed", "cancelled", name="orderstatus", create_type=False)
invoice_status = postgresql.ENUM(
    "draft",
    "issued",
    "partial",
    "paid",
    "overdue",
    "cancelled",
    name="invoicestatus",
    create_type=False,
)
payment_method = postgresql.ENUM("cash", "bank_transfer", "mobile_money", "cheque", name="paymentmethod", create_type=False)
slaughter_status = postgresql.ENUM("scheduled", "in_progress", "completed", "cancelled", name="slaughterstatus", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    stock_category.create(bind, checkfirst=True)
    movement_type.create(bind, checkfirst=True)
    customer_type.create(bind, checkfirst=True)
    order_status.create(bind, checkfirst=True)
    invoice_status.create(bind, checkfirst=True)
    payment_method.create(bind, checkfirst=True)
    slaughter_status.create(bind, checkfirst=True)

    op.create_table(
        "stock_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("sku", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("category", stock_category, nullable=False),
        sa.Column("unit_of_measure", sa.String(), nullable=False),
        sa.Column("current_quantity", sa.Float(), nullable=False, server_default="0"),
        sa.Column("reorder_level", sa.Float(), nullable=False, server_default="0"),
        sa.Column("unit_price", sa.Float(), nullable=False, server_default="0"),
        sa.Column("average_cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_stock_items_name", "stock_items", ["name"])
    op.create_index("ix_stock_items_sku", "stock_items", ["sku"], unique=True)

    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("customer_type", customer_type, nullable=False, server_default="retail"),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("balance", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_customers_name", "customers", ["name"])

    op.create_table(
        "expense_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_expense_categories_name", "expense_categories", ["name"], unique=True)

    op.create_table(
        "income_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_income_categories_name", "income_categories", ["name"], unique=True)

    op.create_table(
        "product_catalog",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("sku", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("base_price", sa.Float(), nullable=False, server_default="0"),
        sa.Column("wholesale_price", sa.Float(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("ix_product_catalog_name", "product_catalog", ["name"])
    op.create_index("ix_product_catalog_sku", "product_catalog", ["sku"], unique=True)

    op.create_table(
        "system_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_system_configs_key", "system_configs", ["key"], unique=True)

    op.create_table(
        "stock_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("stock_items.id"), nullable=False),
        sa.Column("movement_type", movement_type, nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("previous_quantity", sa.Float(), nullable=False),
        sa.Column("new_quantity", sa.Float(), nullable=False),
        sa.Column("reference_type", sa.String(), nullable=True),
        sa.Column("reference_id", sa.Integer(), nullable=True),
        sa.Column("unit_cost", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_stock_movements_id", "stock_movements", ["id"])

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("status", order_status, nullable=False, server_default="pending"),
        sa.Column("total_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_orders_id", "orders", ["id"])

    op.create_table(
        "slaughter_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id"), nullable=False),
        sa.Column("slaughter_date", sa.Date(), nullable=False),
        sa.Column("status", slaughter_status, nullable=False, server_default="scheduled"),
        sa.Column("live_birds_count", sa.Integer(), nullable=False),
        sa.Column("total_live_weight", sa.Float(), nullable=False),
        sa.Column("total_dressed_weight", sa.Float(), nullable=True),
        sa.Column("yield_percentage", sa.Float(), nullable=True),
        sa.Column("waste_weight", sa.Float(), nullable=False, server_default="0"),
        sa.Column("condemned_birds_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_slaughter_records_id", "slaughter_records", ["id"])

    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("expense_categories.id"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("expense_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("reference", sa.String(), nullable=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_expenses_id", "expenses", ["id"])

    op.create_table(
        "incomes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("income_categories.id"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("income_date", sa.Date(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("reference", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_incomes_id", "incomes", ["id"])

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("stock_items.id"), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit_price", sa.Float(), nullable=False),
        sa.Column("subtotal", sa.Float(), nullable=False),
    )
    op.create_index("ix_order_items_id", "order_items", ["id"])

    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("invoice_number", sa.String(), nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("status", invoice_status, nullable=False, server_default="draft"),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("total_amount", sa.Float(), nullable=False),
        sa.Column("paid_amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("invoice_number"),
    )
    op.create_index("ix_invoices_id", "invoices", ["id"])
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"], unique=True)

    op.create_table(
        "slaughter_outputs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slaughter_record_id", sa.Integer(), sa.ForeignKey("slaughter_records.id"), nullable=False),
        sa.Column("stock_item_id", sa.Integer(), sa.ForeignKey("stock_items.id"), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit_cost", sa.Float(), nullable=True),
        sa.Column("total_cost", sa.Float(), nullable=True),
    )
    op.create_index("ix_slaughter_outputs_id", "slaughter_outputs", ["id"])

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("payment_method", payment_method, nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("reference", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_payments_id", "payments", ["id"])


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("slaughter_outputs")
    op.drop_index("ix_invoices_invoice_number", table_name="invoices")
    op.drop_index("ix_invoices_id", table_name="invoices")
    op.drop_table("invoices")
    op.drop_index("ix_order_items_id", table_name="order_items")
    op.drop_table("order_items")
    op.drop_index("ix_incomes_id", table_name="incomes")
    op.drop_table("incomes")
    op.drop_index("ix_expenses_id", table_name="expenses")
    op.drop_table("expenses")
    op.drop_index("ix_slaughter_records_id", table_name="slaughter_records")
    op.drop_table("slaughter_records")
    op.drop_index("ix_orders_id", table_name="orders")
    op.drop_table("orders")
    op.drop_index("ix_stock_movements_id", table_name="stock_movements")
    op.drop_table("stock_movements")
    op.drop_index("ix_system_configs_key", table_name="system_configs")
    op.drop_table("system_configs")
    op.drop_index("ix_product_catalog_sku", table_name="product_catalog")
    op.drop_index("ix_product_catalog_name", table_name="product_catalog")
    op.drop_table("product_catalog")
    op.drop_index("ix_income_categories_name", table_name="income_categories")
    op.drop_table("income_categories")
    op.drop_index("ix_expense_categories_name", table_name="expense_categories")
    op.drop_table("expense_categories")
    op.drop_index("ix_customers_name", table_name="customers")
    op.drop_table("customers")
    op.drop_index("ix_stock_items_sku", table_name="stock_items")
    op.drop_index("ix_stock_items_name", table_name="stock_items")
    op.drop_table("stock_items")

    bind = op.get_bind()
    slaughter_status.drop(bind, checkfirst=True)
    payment_method.drop(bind, checkfirst=True)
    invoice_status.drop(bind, checkfirst=True)
    order_status.drop(bind, checkfirst=True)
    customer_type.drop(bind, checkfirst=True)
    movement_type.drop(bind, checkfirst=True)
    stock_category.drop(bind, checkfirst=True)
