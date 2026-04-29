"""
Track dedicated tenant operational database provisioning state.
"""

from alembic import op
import sqlalchemy as sa


revision = "008_tenant_ops_db"
down_revision = "007_saas_domain_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("operational_db_name", sa.String(length=120), nullable=True))
    op.add_column(
        "tenants",
        sa.Column("operational_db_status", sa.String(length=30), nullable=False, server_default="pending"),
    )
    op.add_column("tenants", sa.Column("operational_db_ready_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("operational_db_last_error", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_tenants_operational_db_name", "tenants", ["operational_db_name"])


def downgrade() -> None:
    op.drop_constraint("uq_tenants_operational_db_name", "tenants", type_="unique")
    op.drop_column("tenants", "operational_db_last_error")
    op.drop_column("tenants", "operational_db_ready_at")
    op.drop_column("tenants", "operational_db_status")
    op.drop_column("tenants", "operational_db_name")
