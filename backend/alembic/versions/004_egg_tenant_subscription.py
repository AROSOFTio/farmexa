"""
Migration 004: Add egg_production_logs, tenants, tenant_modules, subscription_history tables.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "004_egg_tenant_subscription"
down_revision = "003_operations_modules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    tenant_status_enum = postgresql.ENUM(
        "active",
        "suspended",
        "trial",
        "expired",
        name="tenantstatus",
        create_type=False,
    )
    subscription_plan_enum = postgresql.ENUM(
        "basic",
        "standard",
        "premium",
        "custom",
        name="subscriptionplan",
        create_type=False,
    )
    billing_cycle_enum = postgresql.ENUM(
        "monthly",
        "quarterly",
        "annual",
        name="billingcycle",
        create_type=False,
    )

    # ── egg_production_logs ─────────────────────────────────────────────────
    op.create_table(
        "egg_production_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id"), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("good_eggs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cracked_eggs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("damaged_eggs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_eggs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_trays", sa.Float(), nullable=False, server_default="0"),
        sa.Column("production_rate", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_egg_production_logs_batch_id", "egg_production_logs", ["batch_id"])
    op.create_index("ix_egg_production_logs_record_date", "egg_production_logs", ["record_date"])

    # ── tenants ─────────────────────────────────────────────────────────────
    tenant_status_enum.create(op.get_bind(), checkfirst=True)
    subscription_plan_enum.create(op.get_bind(), checkfirst=True)
    billing_cycle_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "tenants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), unique=True, nullable=False),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("email", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("status", tenant_status_enum, nullable=False, server_default="trial"),
        sa.Column("plan", subscription_plan_enum, nullable=False, server_default="basic"),
        sa.Column("billing_cycle", billing_cycle_enum, nullable=False, server_default="monthly"),
        sa.Column("subscription_start", sa.Date(), nullable=True),
        sa.Column("subscription_expiry", sa.Date(), nullable=True),
        sa.Column("is_suspended", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tenants_name", "tenants", ["name"])
    op.create_index("ix_tenants_slug", "tenants", ["slug"])

    # ── tenant_modules ───────────────────────────────────────────────────────
    op.create_table(
        "tenant_modules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("module_key", sa.String(100), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tenant_modules_tenant_id", "tenant_modules", ["tenant_id"])
    op.create_index("ix_tenant_modules_module_key", "tenant_modules", ["module_key"])

    # ── subscription_history ─────────────────────────────────────────────────
    op.create_table(
        "subscription_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("changed_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("old_plan", sa.String(50), nullable=True),
        sa.Column("new_plan", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscription_history_tenant_id", "subscription_history", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("subscription_history")
    op.drop_table("tenant_modules")
    op.drop_table("tenants")
    op.drop_table("egg_production_logs")
    op.execute("DROP TYPE IF EXISTS tenantstatus")
    op.execute("DROP TYPE IF EXISTS subscriptionplan")
    op.execute("DROP TYPE IF EXISTS billingcycle")
