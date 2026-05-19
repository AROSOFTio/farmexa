"""
Add stock_item_id to batches for inventory linkage.
This enables batches to be tracked in the central inventory system.
"""

from alembic import op
import sqlalchemy as sa


revision = "015_batch_stock_linkage"
down_revision = "014_affiliate_marketing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add stock_item_id column to batches table
    op.add_column(
        "batches",
        sa.Column(
            "stock_item_id",
            sa.Integer(),
            sa.ForeignKey("stock_items.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    
    # Create index on stock_item_id
    op.create_index("ix_batches_stock_item_id", "batches", ["stock_item_id"])


def downgrade() -> None:
    # Remove index and column
    op.drop_index("ix_batches_stock_item_id", table_name="batches")
    op.drop_column("batches", "stock_item_id")
