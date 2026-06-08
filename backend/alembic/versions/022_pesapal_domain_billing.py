"""Add Pesapal billing and custom domain requests.

Revision ID: 022
Revises: 021
Create Date: 2026-06-08

"""
from alembic import op
import sqlalchemy as sa


revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    domain_request_status = sa.Enum(
        "pending_payment",
        "paid",
        "pending_dns",
        "dns_verified",
        "ssl_pending",
        "active",
        "rejected",
        "failed",
        "cancelled",
        name="domainrequeststatus",
    )
    domain_request_status.create(op.get_bind(), checkfirst=True)

    op.add_column("system_settings", sa.Column("pesapal_consumer_key", sa.String(length=255), nullable=True))
    op.add_column("system_settings", sa.Column("pesapal_consumer_secret", sa.Text(), nullable=True))
    op.add_column("system_settings", sa.Column("pesapal_environment", sa.String(length=20), nullable=False, server_default="production"))
    op.add_column("system_settings", sa.Column("pesapal_ipn_id", sa.String(length=120), nullable=True))
    op.add_column("system_settings", sa.Column("pesapal_ipn_url", sa.String(length=500), nullable=True))
    op.add_column("system_settings", sa.Column("custom_domain_annual_price", sa.Float(), nullable=False, server_default="25"))
    op.add_column("system_settings", sa.Column("custom_domain_currency", sa.String(length=10), nullable=False, server_default="USD"))

    op.create_table(
        "tenant_domain_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("domain_id", sa.Integer(), sa.ForeignKey("tenant_domains.id", ondelete="SET NULL"), nullable=True),
        sa.Column("host", sa.String(length=255), nullable=False),
        sa.Column("normalized_host", sa.String(length=255), nullable=False),
        sa.Column("status", domain_request_status, nullable=False),
        sa.Column("price_amount", sa.Numeric(12, 2), nullable=False, server_default="25"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("billing_period", sa.String(length=20), nullable=False, server_default="annual"),
        sa.Column("verification_token", sa.String(length=120), nullable=True),
        sa.Column("dns_record_type", sa.String(length=20), nullable=True),
        sa.Column("dns_record_name", sa.String(length=255), nullable=True),
        sa.Column("dns_record_value", sa.String(length=255), nullable=True),
        sa.Column("wants_primary", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("admin_notes", sa.Text(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("normalized_host", name="uq_tenant_domain_request_normalized_host"),
    )
    op.create_index("ix_tenant_domain_requests_tenant_id", "tenant_domain_requests", ["tenant_id"])
    op.create_index("ix_tenant_domain_requests_host", "tenant_domain_requests", ["host"])
    op.create_index("ix_tenant_domain_requests_normalized_host", "tenant_domain_requests", ["normalized_host"], unique=True)
    op.create_index("ix_tenant_domain_requests_status", "tenant_domain_requests", ["status"])

    op.create_table(
        "tenant_domain_request_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("request_id", sa.Integer(), sa.ForeignKey("tenant_domain_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sender_role", sa.String(length=40), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("email_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tenant_domain_request_messages_request_id", "tenant_domain_request_messages", ["request_id"])
    op.create_index("ix_tenant_domain_request_messages_tenant_id", "tenant_domain_request_messages", ["tenant_id"])

    op.add_column("billing_invoices", sa.Column("domain_request_id", sa.Integer(), nullable=True))
    op.add_column("billing_invoices", sa.Column("invoice_type", sa.String(length=40), nullable=False, server_default="module_upgrade"))
    op.create_index("ix_billing_invoices_domain_request_id", "billing_invoices", ["domain_request_id"], unique=True)
    op.create_foreign_key(
        "fk_billing_invoices_domain_request_id",
        "billing_invoices",
        "tenant_domain_requests",
        ["domain_request_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.alter_column("billing_invoices", "request_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column("billing_invoices", "request_id", existing_type=sa.Integer(), nullable=False)
    op.drop_constraint("fk_billing_invoices_domain_request_id", "billing_invoices", type_="foreignkey")
    op.drop_index("ix_billing_invoices_domain_request_id", table_name="billing_invoices")
    op.drop_column("billing_invoices", "invoice_type")
    op.drop_column("billing_invoices", "domain_request_id")

    op.drop_index("ix_tenant_domain_request_messages_tenant_id", table_name="tenant_domain_request_messages")
    op.drop_index("ix_tenant_domain_request_messages_request_id", table_name="tenant_domain_request_messages")
    op.drop_table("tenant_domain_request_messages")
    op.drop_index("ix_tenant_domain_requests_status", table_name="tenant_domain_requests")
    op.drop_index("ix_tenant_domain_requests_normalized_host", table_name="tenant_domain_requests")
    op.drop_index("ix_tenant_domain_requests_host", table_name="tenant_domain_requests")
    op.drop_index("ix_tenant_domain_requests_tenant_id", table_name="tenant_domain_requests")
    op.drop_table("tenant_domain_requests")
    sa.Enum(name="domainrequeststatus").drop(op.get_bind(), checkfirst=True)

    op.drop_column("system_settings", "custom_domain_currency")
    op.drop_column("system_settings", "custom_domain_annual_price")
    op.drop_column("system_settings", "pesapal_ipn_url")
    op.drop_column("system_settings", "pesapal_ipn_id")
    op.drop_column("system_settings", "pesapal_environment")
    op.drop_column("system_settings", "pesapal_consumer_secret")
    op.drop_column("system_settings", "pesapal_consumer_key")
