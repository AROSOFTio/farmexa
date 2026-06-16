"""
Add last_login_at to users table for tenant activity monitoring.
"""

from alembic import op
import sqlalchemy as sa


revision = "033_user_last_login"
down_revision = "032_supplier_item_prices"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
