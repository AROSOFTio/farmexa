"""Add Pesapal billing and custom domain requests.

Revision ID: 022
Revises: 021
Create Date: 2026-06-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql


revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def _column_exists(bind, table_name: str, column_name: str) -> bool:
    inspector = inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _foreign_key_exists(bind, table_name: str, fk_name: str) -> bool:
    inspector = inspect(bind)
    return any(fk["name"] == fk_name for fk in inspector.get_foreign_keys(table_name))


def _index_exists(bind, table_name: str, index_name: str) -> bool:
    inspector = inspect(bind)
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))


def _ensure_enum_type(enum_type: postgresql.ENUM, bind) -> None:
    enum_type.create(bind, checkfirst=True)


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    bind = op.get_bind()
    if not _column_exists(bind, table_name, column.name):
        op.add_column(table_name, column)


def _create_table_if_missing(table_name: str, *columns, **kwargs) -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    if inspector.has_table(table_name):
        return
    op.create_table(table_name, *columns, **kwargs)


def _create_foreign_key_if_missing(
    constraint_name: str,
    source_table: str,
    referent_table: str,
    local_cols: list[str],
    remote_cols: list[str],
    ondelete: str | None = None,
) -> None:
    bind = op.get_bind()
    if _foreign_key_exists(bind, source_table, constraint_name):
        return
    op.create_foreign_key(
        constraint_name,
        source_table,
        referent_table,
        local_cols,
        remote_cols,
        ondelete=ondelete,
    )


def _create_index_if_missing(index_name: str, table_name: str, columns: list[str], unique: bool = False) -> None:
    bind = op.get_bind()
    if _index_exists(bind, table_name, index_name):
        return
    op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    domain_request_status = postgresql.ENUM(
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
        create_type=False,
    )
    bind = op.get_bind()
    _ensure_enum_type(domain_request_status, bind)

    _add_column_if_missing("system_settings", sa.Column("pesapal_consumer_key", sa.String(length=255), nullable=True))
    _add_column_if_missing("system_settings", sa.Column("pesapal_consumer_secret", sa.Text(), nullable=True))
    _add_column_if_missing(
        "system_settings",
        sa.Column("pesapal_environment", sa.String(length=20), nullable=False, server_default="production"),
    )
    _add_column_if_missing("system_settings", sa.Column("pesapal_ipn_id", sa.String(length=120), nullable=True))
    _add_column_if_missing("system_settings", sa.Column("pesapal_ipn_url", sa.String(length=500), nullable=True))
    _add_column_if_missing(
        "system_settings",
        sa.Column("custom_domain_annual_price", sa.Float(), nullable=False, server_default="25"),
    )
    _add_column_if_missing(
        "system_settings",
        sa.Column("custom_domain_currency", sa.String(length=10), nullable=False, server_default="USD"),
    )

    _create_table_if_missing(
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
    _create_index_if_missing("ix_tenant_domain_requests_tenant_id", "tenant_domain_requests", ["tenant_id"])
    _create_index_if_missing("ix_tenant_domain_requests_host", "tenant_domain_requests", ["host"])
    _create_index_if_missing("ix_tenant_domain_requests_normalized_host", "tenant_domain_requests", ["normalized_host"], unique=True)
    _create_index_if_missing("ix_tenant_domain_requests_status", "tenant_domain_requests", ["status"])

    _create_table_if_missing(
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
    _create_index_if_missing("ix_tenant_domain_request_messages_request_id", "tenant_domain_request_messages", ["request_id"])
    _create_index_if_missing("ix_tenant_domain_request_messages_tenant_id", "tenant_domain_request_messages", ["tenant_id"])

    _add_column_if_missing("billing_invoices", sa.Column("domain_request_id", sa.Integer(), nullable=True))
    _add_column_if_missing(
        "billing_invoices",
        sa.Column("invoice_type", sa.String(length=40), nullable=False, server_default="module_upgrade"),
    )
    _create_index_if_missing("ix_billing_invoices_domain_request_id", "billing_invoices", ["domain_request_id"], unique=True)
    _create_foreign_key_if_missing(
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
    postgresql.ENUM(name="domainrequeststatus", create_type=False).drop(op.get_bind(), checkfirst=True)

    op.drop_column("system_settings", "custom_domain_currency")
    op.drop_column("system_settings", "custom_domain_annual_price")
    op.drop_column("system_settings", "pesapal_ipn_url")
    op.drop_column("system_settings", "pesapal_ipn_id")
    op.drop_column("system_settings", "pesapal_environment")
    op.drop_column("system_settings", "pesapal_consumer_secret")
    op.drop_column("system_settings", "pesapal_consumer_key")
