"""
Add slaughter_records.chick_cost_override.

Per-bird chick cost override for a slaughter run; when NULL the batch's
chick_cost is used in the production cost analysis.
"""

from alembic import op
import sqlalchemy as sa


revision = "027_slaughter_chick_cost"
down_revision = "5aff6d31f520"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "slaughter_records",
        sa.Column("chick_cost_override", sa.Numeric(precision=18, scale=4), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("slaughter_records", "chick_cost_override")
