"""
Supplier tentative item price list.
"""

from alembic import op
import sqlalchemy as sa


revision = "032_supplier_item_prices"
down_revision = "031_procurement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "supplier_item_prices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("stock_item_id", sa.Integer(), nullable=True),
        sa.Column("item_name", sa.String(length=150), nullable=False),
        sa.Column("unit_of_measure", sa.String(length=50), nullable=True),
        sa.Column("unit_price", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["stock_item_id"], ["stock_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_supplier_item_prices_supplier_id"), "supplier_item_prices", ["supplier_id"])
    op.create_index(op.f("ix_supplier_item_prices_stock_item_id"), "supplier_item_prices", ["stock_item_id"])


def downgrade() -> None:
    op.drop_table("supplier_item_prices")
