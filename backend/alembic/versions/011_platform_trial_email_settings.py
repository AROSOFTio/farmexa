"""
Add Farmexa platform settings, email logs, and explicit trial lifecycle state.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "011_platform_trial_email"
down_revision = "010_plan_pricing_house_sections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    subscriptionstatus = postgresql.ENUM(
        "trial",
        "active",
        "past_due",
        "expired",
        "suspended",
        "cancelled",
        name="subscriptionstatus",
        create_type=False,
    )
    subscriptionstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "system_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("system_name", sa.String(length=120), nullable=False, server_default="Farmexa"),
        sa.Column("system_logo_url", sa.String(length=500), nullable=True),
        sa.Column("system_favicon_url", sa.String(length=500), nullable=True),
        sa.Column("primary_color", sa.String(length=40), nullable=False, server_default="#d6a62e"),
        sa.Column("secondary_color", sa.String(length=40), nullable=False, server_default="#0b1018"),
        sa.Column("platform_domain", sa.String(length=255), nullable=False, server_default="farmexa.arosoft.io"),
        sa.Column("tenant_domain_suffix", sa.String(length=255), nullable=False, server_default="farmexa.arosoft.io"),
        sa.Column("sender_email", sa.String(length=255), nullable=False, server_default="farmexa@arosoft.io"),
        sa.Column("sender_name", sa.String(length=120), nullable=False, server_default="Farmexa"),
        sa.Column("support_email", sa.String(length=255), nullable=False, server_default="farmexa@arosoft.io"),
        sa.Column("company_name", sa.String(length=120), nullable=False, server_default="AROSOFT"),
        sa.Column("footer_text", sa.String(length=255), nullable=False, server_default="Powered by AROSOFT"),
        sa.Column("smtp_host", sa.String(length=255), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=False, server_default="587"),
        sa.Column("smtp_username", sa.String(length=255), nullable=True),
        sa.Column("smtp_password", sa.Text(), nullable=True),
        sa.Column("smtp_use_tls", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("cloudflare_api_token", sa.Text(), nullable=True),
        sa.Column("cloudflare_zone_id", sa.String(length=255), nullable=True),
        sa.Column("tenant_domain_target_ip", sa.String(length=100), nullable=True),
        sa.Column("enable_cloudflare_dns_automation", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("enable_automatic_ssl_provisioning", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_system_settings_id", "system_settings", ["id"])

    op.create_table(
        "email_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recipient", sa.String(length=255), nullable=False),
        sa.Column("sender", sa.String(length=255), nullable=False),
        sa.Column("email_type", sa.String(length=80), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("body_preview", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_email_logs_id", "email_logs", ["id"])
    op.create_index("ix_email_logs_tenant_id", "email_logs", ["tenant_id"])
    op.create_index("ix_email_logs_email_type", "email_logs", ["email_type"])
    op.create_index("ix_email_logs_status", "email_logs", ["status"])

    op.add_column("tenants", sa.Column("trial_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("trial_warning_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("final_warning_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("trial_expired_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("subscription_status", subscriptionstatus, nullable=False, server_default="trial"))
    op.add_column("tenants", sa.Column("is_profile_only", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("subscriptions", sa.Column("trial_days", sa.Integer(), nullable=False, server_default="0"))

    op.execute(
        """
        UPDATE tenants
        SET
            trial_started_at = COALESCE(subscription_start::timestamp with time zone, created_at),
            trial_ends_at = CASE
                WHEN subscription_expiry IS NOT NULL THEN subscription_expiry::timestamp with time zone
                ELSE NULL
            END,
            subscription_status = CASE
                WHEN status = 'expired' THEN 'expired'::subscriptionstatus
                WHEN status = 'suspended' THEN 'suspended'::subscriptionstatus
                WHEN status = 'trial' THEN 'trial'::subscriptionstatus
                ELSE 'active'::subscriptionstatus
            END,
            is_profile_only = CASE WHEN status = 'expired' THEN true ELSE false END
        """
    )
    op.execute(
        """
        UPDATE subscriptions
        SET trial_days = CASE WHEN status = 'trial' THEN 14 ELSE 0 END
        """
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "trial_days")
    op.drop_column("tenants", "is_profile_only")
    op.drop_column("tenants", "subscription_status")
    op.drop_column("tenants", "trial_expired_at")
    op.drop_column("tenants", "final_warning_sent_at")
    op.drop_column("tenants", "trial_warning_sent_at")
    op.drop_column("tenants", "trial_ends_at")
    op.drop_column("tenants", "trial_started_at")

    op.drop_index("ix_email_logs_status", table_name="email_logs")
    op.drop_index("ix_email_logs_email_type", table_name="email_logs")
    op.drop_index("ix_email_logs_tenant_id", table_name="email_logs")
    op.drop_index("ix_email_logs_id", table_name="email_logs")
    op.drop_table("email_logs")
    op.drop_index("ix_system_settings_id", table_name="system_settings")
    op.drop_table("system_settings")
