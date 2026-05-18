"""
Add Cloudflare DNS provisioning diagnostics to tenant domains.
"""

from alembic import op
import sqlalchemy as sa


revision = "012_cloudflare_dns"
down_revision = "011_platform_trial_email"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenant_domains", sa.Column("cloudflare_record_id", sa.String(length=120), nullable=True))
    op.add_column("tenant_domains", sa.Column("cloudflare_provision_status", sa.String(length=40), nullable=True))
    op.add_column("tenant_domains", sa.Column("cloudflare_last_error", sa.Text(), nullable=True))
    op.add_column("tenant_domains", sa.Column("cloudflare_provisioned_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("tenant_domains", "cloudflare_provisioned_at")
    op.drop_column("tenant_domains", "cloudflare_last_error")
    op.drop_column("tenant_domains", "cloudflare_provision_status")
    op.drop_column("tenant_domains", "cloudflare_record_id")
