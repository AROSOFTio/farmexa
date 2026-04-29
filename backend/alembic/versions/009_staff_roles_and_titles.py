"""
Add user job titles for tenant staff administration.
"""

from alembic import op
import sqlalchemy as sa


revision = "009_staff_roles"
down_revision = "008_tenant_ops_db"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("job_title", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "job_title")
