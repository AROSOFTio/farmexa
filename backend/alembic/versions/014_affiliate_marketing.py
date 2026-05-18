"""
Add affiliate marketing tables.
"""

from alembic import op
import sqlalchemy as sa


revision = "014_affiliate_marketing"
down_revision = "013_supplier_profile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "affiliates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("country", sa.String(length=100), nullable=True),
        sa.Column("organization", sa.String(length=180), nullable=True),
        sa.Column("website_url", sa.String(length=300), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="pending", nullable=False),
        sa.Column("referral_code", sa.String(length=40), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_affiliates_email", "affiliates", ["email"], unique=True)
    op.create_index("ix_affiliates_referral_code", "affiliates", ["referral_code"], unique=True)
    op.create_index("ix_affiliates_status", "affiliates", ["status"])

    op.create_table(
        "affiliate_commission_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_code", sa.String(length=50), nullable=False),
        sa.Column("commission_percent", sa.Numeric(5, 2), server_default="20", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("recurring", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("effective_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("plan_code", name="uq_affiliate_commission_plan"),
    )
    op.create_index("ix_affiliate_commission_rules_plan_code", "affiliate_commission_rules", ["plan_code"])

    op.create_table(
        "affiliate_referrals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("affiliate_id", sa.Integer(), sa.ForeignKey("affiliates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referral_code", sa.String(length=40), nullable=False),
        sa.Column("referred_email", sa.String(length=200), nullable=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("landing_url", sa.String(length=500), nullable=True),
        sa.Column("ip_address", sa.String(length=80), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("affiliate_id", "tenant_id", name="uq_affiliate_referral_tenant"),
    )
    op.create_index("ix_affiliate_referrals_affiliate_id", "affiliate_referrals", ["affiliate_id"])
    op.create_index("ix_affiliate_referrals_referral_code", "affiliate_referrals", ["referral_code"])
    op.create_index("ix_affiliate_referrals_tenant_id", "affiliate_referrals", ["tenant_id"])

    op.create_table(
        "affiliate_commissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("affiliate_id", sa.Integer(), sa.ForeignKey("affiliates.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_code", sa.String(length=50), nullable=False),
        sa.Column("subscription_amount", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("currency", sa.String(length=10), server_default="UGX", nullable=False),
        sa.Column("commission_percent_snapshot", sa.Numeric(5, 2), nullable=False),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="pending", nullable=False),
        sa.Column("payment_reference", sa.String(length=120), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("affiliate_id", "tenant_id", "plan_code", name="uq_affiliate_commission_tenant_plan"),
    )
    op.create_index("ix_affiliate_commissions_affiliate_id", "affiliate_commissions", ["affiliate_id"])
    op.create_index("ix_affiliate_commissions_tenant_id", "affiliate_commissions", ["tenant_id"])
    op.create_index("ix_affiliate_commissions_plan_code", "affiliate_commissions", ["plan_code"])
    op.create_index("ix_affiliate_commissions_status", "affiliate_commissions", ["status"])

    op.create_table(
        "affiliate_activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("affiliate_id", sa.Integer(), sa.ForeignKey("affiliates.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_affiliate_activity_logs_action", "affiliate_activity_logs", ["action"])


def downgrade() -> None:
    op.drop_index("ix_affiliate_activity_logs_action", table_name="affiliate_activity_logs")
    op.drop_table("affiliate_activity_logs")
    op.drop_index("ix_affiliate_commissions_status", table_name="affiliate_commissions")
    op.drop_index("ix_affiliate_commissions_plan_code", table_name="affiliate_commissions")
    op.drop_index("ix_affiliate_commissions_tenant_id", table_name="affiliate_commissions")
    op.drop_index("ix_affiliate_commissions_affiliate_id", table_name="affiliate_commissions")
    op.drop_table("affiliate_commissions")
    op.drop_index("ix_affiliate_referrals_tenant_id", table_name="affiliate_referrals")
    op.drop_index("ix_affiliate_referrals_referral_code", table_name="affiliate_referrals")
    op.drop_index("ix_affiliate_referrals_affiliate_id", table_name="affiliate_referrals")
    op.drop_table("affiliate_referrals")
    op.drop_index("ix_affiliate_commission_rules_plan_code", table_name="affiliate_commission_rules")
    op.drop_table("affiliate_commission_rules")
    op.drop_index("ix_affiliates_status", table_name="affiliates")
    op.drop_index("ix_affiliates_referral_code", table_name="affiliates")
    op.drop_index("ix_affiliates_email", table_name="affiliates")
    op.drop_table("affiliates")
