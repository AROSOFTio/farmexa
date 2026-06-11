"""Convert Float monetary/weight columns to Numeric for accounting precision.

SQLAlchemy `Float` maps to IEEE-754 double precision, which produces
rounding errors on monetary values (e.g. 50500 stored/retrieved as
50499.99998...). This migration converts every money column (and the
slaughter weight columns that feed cost-per-kg calculations) to
fixed-point `NUMERIC` types so all arithmetic is exact.

  - Money columns       -> NUMERIC(18, 4)
  - Quantity columns     -> NUMERIC(14, 4)
  - Weight columns (kg)  -> NUMERIC(12, 3)

Existing feed.py columns already used NUMERIC(12, 2); those are widened
to NUMERIC(18, 4) for consistency with the rest of the system.

Revision ID: 024
Revises: 741a8157bf9c
Create Date: 2026-06-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '024'
down_revision = '741a8157bf9c'
branch_labels = None
depends_on = None


# (table, column, precision, scale, nullable)
FLOAT_TO_NUMERIC = [
    ("expenses", "amount", 18, 4, False),
    ("incomes", "amount", 18, 4, False),
    ("customers", "balance", 18, 4, False),
    ("customers", "credit_limit", 18, 4, False),
    ("orders", "total_amount", 18, 4, False),
    ("order_items", "quantity", 14, 4, False),
    ("order_items", "unit_price", 18, 4, False),
    ("order_items", "subtotal", 18, 4, False),
    ("invoices", "total_amount", 18, 4, False),
    ("invoices", "paid_amount", 18, 4, False),
    ("payments", "amount", 18, 4, False),
    ("stock_items", "unit_price", 18, 4, False),
    ("stock_items", "average_cost", 18, 4, False),
    ("stock_movements", "unit_cost", 18, 4, True),
    ("goods_received_notes", "unit_cost", 18, 4, True),
    ("slaughter_records", "total_live_weight", 12, 3, False),
    ("slaughter_records", "average_live_weight", 12, 3, True),
    ("slaughter_records", "total_dressed_weight", 12, 3, True),
    ("slaughter_records", "average_dressed_weight", 12, 3, True),
    ("slaughter_records", "waste_weight", 12, 3, True),
    ("slaughter_records", "blood_weight", 12, 3, True),
    ("slaughter_records", "feathers_weight", 12, 3, True),
    ("slaughter_records", "offal_weight", 12, 3, True),
    ("slaughter_records", "head_weight", 12, 3, True),
    ("slaughter_records", "feet_weight", 12, 3, True),
    ("slaughter_records", "reusable_byproducts_weight", 12, 3, True),
    ("slaughter_outputs", "quantity", 12, 3, False),
    ("slaughter_outputs", "unit_cost", 18, 4, True),
    ("slaughter_outputs", "total_cost", 18, 4, True),
    ("slaughter_byproducts", "quantity_weight", 12, 3, False),
    ("slaughter_byproducts", "value", 18, 4, True),
    ("slaughter_byproducts", "unit_cost", 18, 4, True),
    ("slaughter_byproducts", "total_value", 18, 4, True),
    ("journal_lines", "debit", 18, 4, False),
    ("journal_lines", "credit", 18, 4, False),
    ("opening_balances", "opening_debit", 18, 4, False),
    ("opening_balances", "opening_credit", 18, 4, False),
    ("branch_transfer_items", "quantity_shipped", 14, 4, False),
    ("branch_transfer_items", "quantity_received", 14, 4, True),
]

# (table, column, old_precision, old_scale, new_precision, new_scale, nullable)
NUMERIC_RESCALE = [
    ("feed_purchases", "total_amount", 12, 2, 18, 4, False),
    ("feed_purchase_items", "unit_price", 12, 2, 18, 4, False),
    ("feed_purchase_items", "total_price", 12, 2, 18, 4, False),
    ("feed_formulations", "cost_per_kg", 12, 2, 18, 4, False),
    ("feed_production_batches", "cost_per_kg", 12, 2, 18, 4, False),
]


def upgrade() -> None:
    for table, column, precision, scale, nullable in FLOAT_TO_NUMERIC:
        op.alter_column(
            table,
            column,
            existing_type=sa.Float(),
            type_=sa.Numeric(precision, scale),
            postgresql_using=f"{column}::numeric({precision},{scale})",
            existing_nullable=nullable,
        )

    for table, column, old_p, old_s, new_p, new_s, nullable in NUMERIC_RESCALE:
        op.alter_column(
            table,
            column,
            existing_type=sa.Numeric(old_p, old_s),
            type_=sa.Numeric(new_p, new_s),
            postgresql_using=f"{column}::numeric({new_p},{new_s})",
            existing_nullable=nullable,
        )


def downgrade() -> None:
    for table, column, old_p, old_s, new_p, new_s, nullable in NUMERIC_RESCALE:
        op.alter_column(
            table,
            column,
            existing_type=sa.Numeric(new_p, new_s),
            type_=sa.Numeric(old_p, old_s),
            postgresql_using=f"{column}::numeric({old_p},{old_s})",
            existing_nullable=nullable,
        )

    for table, column, precision, scale, nullable in FLOAT_TO_NUMERIC:
        op.alter_column(
            table,
            column,
            existing_type=sa.Numeric(precision, scale),
            type_=sa.Float(),
            postgresql_using=f"{column}::double precision",
            existing_nullable=nullable,
        )
