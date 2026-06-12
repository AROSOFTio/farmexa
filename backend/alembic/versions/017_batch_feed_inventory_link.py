"""
Placeholder migration to satisfy historical references to '017_batch_feed_inventory_link'.
This is a no-op migration; the real backfill exists in
`017b_backfill_batch_feed_inventory_linkage.py`.
"""

from alembic import op
import sqlalchemy as sa

revision = "017_batch_feed_inventory_link"
down_revision = "016_feed_stock_linkage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # no-op placeholder
    pass


def downgrade() -> None:
    # no-op placeholder
    pass
