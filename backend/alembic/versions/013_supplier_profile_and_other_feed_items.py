"""
Expand supplier profiles for procurement.
"""

from alembic import op
import sqlalchemy as sa


revision = "013_supplier_profile"
down_revision = "012_cloudflare_dns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("suppliers", sa.Column("supplier_type", sa.String(length=80), nullable=True))
    op.add_column("suppliers", sa.Column("products_supplied", sa.Text(), nullable=True))
    op.add_column("suppliers", sa.Column("supplier_officer", sa.String(length=100), nullable=True))
    op.add_column("suppliers", sa.Column("alternate_phone", sa.String(length=50), nullable=True))
    op.add_column("suppliers", sa.Column("tax_id", sa.String(length=80), nullable=True))
    op.add_column("suppliers", sa.Column("payment_terms", sa.String(length=120), nullable=True))
    op.add_column("suppliers", sa.Column("lead_time_days", sa.Integer(), nullable=True))
    op.add_column("suppliers", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("suppliers", sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False))


def downgrade() -> None:
    op.drop_column("suppliers", "is_active")
    op.drop_column("suppliers", "notes")
    op.drop_column("suppliers", "lead_time_days")
    op.drop_column("suppliers", "payment_terms")
    op.drop_column("suppliers", "tax_id")
    op.drop_column("suppliers", "alternate_phone")
    op.drop_column("suppliers", "supplier_officer")
    op.drop_column("suppliers", "products_supplied")
    op.drop_column("suppliers", "supplier_type")
