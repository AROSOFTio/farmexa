"""
Add stock_item_id to feed_items for inventory consolidation.
This enables feed items to be linked to the central inventory system,
eliminating the parallel "dark inventory" of feed_items.current_stock.
"""

from alembic import op
import sqlalchemy as sa


revision = "016_feed_stock_linkage"
down_revision = "015_batch_stock_linkage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add stock_item_id column to feed_items table
    op.add_column(
        "feed_items",
        sa.Column(
            "stock_item_id",
            sa.Integer(),
            sa.ForeignKey("stock_items.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )
    
    # Create index on stock_item_id
    op.create_index("ix_feed_items_stock_item_id", "feed_items", ["stock_item_id"])


def downgrade() -> None:
    # Remove index and column
    op.drop_index("ix_feed_items_stock_item_id", table_name="feed_items")
    op.drop_column("feed_items", "stock_item_id")
