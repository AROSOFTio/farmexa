"""
Add SaaS domain lifecycle, upgrade billing ledger, and richer slaughter/compliance fields.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "007_domain_upgrades_and_slaughter_workflow"
down_revision = "006_saas_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'domainstatus' AND e.enumlabel = 'pending'
            ) THEN
                ALTER TYPE domainstatus RENAME VALUE 'pending' TO 'pending_dns';
            END IF;
        END $$;
        """
    )
    op.execute("ALTER TYPE domainstatus ADD VALUE IF NOT EXISTS 'dns_verified'")
    op.execute("ALTER TYPE domainstatus ADD VALUE IF NOT EXISTS 'ssl_pending'")
    op.execute("ALTER TYPE domainstatus ADD VALUE IF NOT EXISTS 'failed'")
    op.execute("ALTER TYPE domainstatus ADD VALUE IF NOT EXISTS 'disabled'")

    for value in ("nema_permit", "health_certificate", "food_safety_certificate"):
        op.execute(f"ALTER TYPE compliancedocumenttype ADD VALUE IF NOT EXISTS '{value}'")

    domain_type_enum = postgresql.ENUM("platform_subdomain", "custom", name="domaintype", create_type=False)
    module_request_status_enum = postgresql.ENUM(
        "pending_payment", "paid", "activated", "cancelled", "rejected",
        name="modulerequeststatus",
        create_type=False,
    )
    payment_status_enum = postgresql.ENUM(
        "pending", "successful", "failed", "cancelled", name="paymentstatus", create_type=False
    )
    quality_status_enum = postgresql.ENUM(
        "pending", "passed", "failed", "rework", name="qualityinspectionstatus", create_type=False
    )
    approval_status_enum = postgresql.ENUM(
        "pending", "approved", "rejected", name="slaughterapprovalstatus", create_type=False
    )
    billing_cycle_enum = postgresql.ENUM(
        "monthly", "quarterly", "annual", name="billingcycle", create_type=False
    )

    domain_type_enum.create(bind, checkfirst=True)
    module_request_status_enum.create(bind, checkfirst=True)
    payment_status_enum.create(bind, checkfirst=True)
    quality_status_enum.create(bind, checkfirst=True)
    approval_status_enum.create(bind, checkfirst=True)

    op.add_column("tenant_domains", sa.Column("normalized_host", sa.String(length=255), nullable=True))
    op.add_column("tenant_domains", sa.Column("domain_type", domain_type_enum, nullable=True))
    op.add_column("tenant_domains", sa.Column("verification_target", sa.String(length=255), nullable=True))
    op.add_column("tenant_domains", sa.Column("dns_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenant_domains", sa.Column("ssl_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenant_domains", sa.Column("ssl_issued_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenant_domains", sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenant_domains", sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenant_domains", sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenant_domains", sa.Column("last_error", sa.Text(), nullable=True))

    op.execute(
        """
        UPDATE tenant_domains
        SET normalized_host = regexp_replace(lower(host), '^www\\.', ''),
            domain_type = CASE
                WHEN host LIKE '%%.farmexa.local' OR host LIKE '%%.farmexa.arosoft.io' THEN 'platform_subdomain'::domaintype
                ELSE 'custom'::domaintype
            END,
            activated_at = CASE WHEN status = 'active'::domainstatus THEN NOW() ELSE NULL END
        """
    )
    op.alter_column("tenant_domains", "normalized_host", nullable=False)
    op.alter_column("tenant_domains", "domain_type", nullable=False, server_default="platform_subdomain")
    op.create_index("ix_tenant_domains_normalized_host", "tenant_domains", ["normalized_host"], unique=True)

    op.add_column("compliance_documents", sa.Column("reminder_date", sa.Date(), nullable=True))

    op.add_column("slaughter_records", sa.Column("tenant_id", sa.Integer(), nullable=True))
    op.add_column("slaughter_records", sa.Column("mortality_birds_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("slaughter_records", sa.Column("average_live_weight", sa.Float(), nullable=True))
    op.add_column("slaughter_records", sa.Column("average_dressed_weight", sa.Float(), nullable=True))
    op.add_column("slaughter_records", sa.Column("loss_percentage", sa.Float(), nullable=True))
    op.add_column("slaughter_records", sa.Column("blood_weight", sa.Float(), nullable=False, server_default="0"))
    op.add_column("slaughter_records", sa.Column("feathers_weight", sa.Float(), nullable=False, server_default="0"))
    op.add_column("slaughter_records", sa.Column("offal_weight", sa.Float(), nullable=False, server_default="0"))
    op.add_column("slaughter_records", sa.Column("head_weight", sa.Float(), nullable=False, server_default="0"))
    op.add_column("slaughter_records", sa.Column("feet_weight", sa.Float(), nullable=False, server_default="0"))
    op.add_column("slaughter_records", sa.Column("reusable_byproducts_weight", sa.Float(), nullable=False, server_default="0"))
    op.add_column("slaughter_records", sa.Column("waste_disposal_notes", sa.Text(), nullable=True))
    op.add_column(
        "slaughter_records",
        sa.Column("quality_inspection_status", quality_status_enum, nullable=False, server_default="pending"),
    )
    op.add_column("slaughter_records", sa.Column("cold_room_location", sa.String(length=120), nullable=True))
    op.add_column(
        "slaughter_records",
        sa.Column("approval_status", approval_status_enum, nullable=False, server_default="pending"),
    )
    op.add_column("slaughter_records", sa.Column("approved_by_user_id", sa.Integer(), nullable=True))
    op.add_column("slaughter_records", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("slaughter_records", sa.Column("inventory_posted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_slaughter_records_tenant_id_tenants",
        "slaughter_records",
        "tenants",
        ["tenant_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_slaughter_records_approved_by_user_id_users",
        "slaughter_records",
        "users",
        ["approved_by_user_id"],
        ["id"],
    )
    op.create_index("ix_slaughter_records_tenant_id", "slaughter_records", ["tenant_id"])

    op.add_column("slaughter_outputs", sa.Column("tenant_id", sa.Integer(), nullable=True))
    op.add_column("slaughter_outputs", sa.Column("output_type", sa.String(length=50), nullable=False, server_default="finished_product"))
    op.create_foreign_key(
        "fk_slaughter_outputs_tenant_id_tenants",
        "slaughter_outputs",
        "tenants",
        ["tenant_id"],
        ["id"],
    )
    op.create_index("ix_slaughter_outputs_tenant_id", "slaughter_outputs", ["tenant_id"])

    op.execute(
        """
        DO $$
        DECLARE first_tenant_id integer;
        DECLARE tenant_total integer;
        BEGIN
            SELECT COUNT(*) INTO tenant_total FROM tenants;
            IF tenant_total = 1 THEN
                SELECT id INTO first_tenant_id FROM tenants ORDER BY id LIMIT 1;
                UPDATE slaughter_records SET tenant_id = first_tenant_id WHERE tenant_id IS NULL;
                UPDATE slaughter_outputs AS so
                SET tenant_id = sr.tenant_id
                FROM slaughter_records AS sr
                WHERE so.slaughter_record_id = sr.id AND so.tenant_id IS NULL;
            END IF;
        END $$;
        """
    )

    op.create_table(
        "tenant_module_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("requested_by_user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", module_request_status_enum, nullable=False, server_default="pending_payment"),
        sa.Column("billing_cycle", billing_cycle_enum, nullable=False, server_default="monthly"),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="UGX"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tenant_module_requests_tenant_id", "tenant_module_requests", ["tenant_id"])
    op.create_index("ix_tenant_module_requests_status", "tenant_module_requests", ["status"])

    op.create_table(
        "tenant_module_request_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("request_id", sa.Integer(), sa.ForeignKey("tenant_module_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("module_key", sa.String(length=100), sa.ForeignKey("modules.key", ondelete="CASCADE"), nullable=False),
        sa.Column("price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="UGX"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("request_id", "module_key", name="uq_tenant_module_request_item"),
    )
    op.create_index("ix_tenant_module_request_items_request_id", "tenant_module_request_items", ["request_id"])
    op.create_index("ix_tenant_module_request_items_module_key", "tenant_module_request_items", ["module_key"])

    op.create_table(
        "billing_invoices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("request_id", sa.Integer(), sa.ForeignKey("tenant_module_requests.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("invoice_number", sa.String(length=50), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="UGX"),
        sa.Column("status", payment_status_enum, nullable=False, server_default="pending"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("payment_reference", sa.String(length=120), nullable=True),
        sa.Column("payment_url", sa.String(length=500), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("invoice_number", name="uq_billing_invoices_invoice_number"),
    )
    op.create_index("ix_billing_invoices_tenant_id", "billing_invoices", ["tenant_id"])
    op.create_index("ix_billing_invoices_status", "billing_invoices", ["status"])

    op.create_table(
        "billing_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("billing_invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="UGX"),
        sa.Column("status", payment_status_enum, nullable=False, server_default="pending"),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("reference", sa.String(length=120), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_response", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_billing_payments_tenant_id", "billing_payments", ["tenant_id"])
    op.create_index("ix_billing_payments_invoice_id", "billing_payments", ["invoice_id"])
    op.create_index("ix_billing_payments_status", "billing_payments", ["status"])

    op.create_table(
        "payment_callbacks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True),
        sa.Column("invoice_id", sa.Integer(), sa.ForeignKey("billing_invoices.id", ondelete="CASCADE"), nullable=True),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("status", payment_status_enum, nullable=False, server_default="pending"),
        sa.Column("source_ip", sa.String(length=50), nullable=True),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_payment_callbacks_tenant_id", "payment_callbacks", ["tenant_id"])
    op.create_index("ix_payment_callbacks_invoice_id", "payment_callbacks", ["invoice_id"])
    op.create_index("ix_payment_callbacks_event_type", "payment_callbacks", ["event_type"])


def downgrade() -> None:
    op.drop_index("ix_payment_callbacks_event_type", table_name="payment_callbacks")
    op.drop_index("ix_payment_callbacks_invoice_id", table_name="payment_callbacks")
    op.drop_index("ix_payment_callbacks_tenant_id", table_name="payment_callbacks")
    op.drop_table("payment_callbacks")

    op.drop_index("ix_billing_payments_status", table_name="billing_payments")
    op.drop_index("ix_billing_payments_invoice_id", table_name="billing_payments")
    op.drop_index("ix_billing_payments_tenant_id", table_name="billing_payments")
    op.drop_table("billing_payments")

    op.drop_index("ix_billing_invoices_status", table_name="billing_invoices")
    op.drop_index("ix_billing_invoices_tenant_id", table_name="billing_invoices")
    op.drop_table("billing_invoices")

    op.drop_index("ix_tenant_module_request_items_module_key", table_name="tenant_module_request_items")
    op.drop_index("ix_tenant_module_request_items_request_id", table_name="tenant_module_request_items")
    op.drop_table("tenant_module_request_items")

    op.drop_index("ix_tenant_module_requests_status", table_name="tenant_module_requests")
    op.drop_index("ix_tenant_module_requests_tenant_id", table_name="tenant_module_requests")
    op.drop_table("tenant_module_requests")

    op.drop_index("ix_slaughter_outputs_tenant_id", table_name="slaughter_outputs")
    op.drop_constraint("fk_slaughter_outputs_tenant_id_tenants", "slaughter_outputs", type_="foreignkey")
    op.drop_column("slaughter_outputs", "output_type")
    op.drop_column("slaughter_outputs", "tenant_id")

    op.drop_index("ix_slaughter_records_tenant_id", table_name="slaughter_records")
    op.drop_constraint("fk_slaughter_records_approved_by_user_id_users", "slaughter_records", type_="foreignkey")
    op.drop_constraint("fk_slaughter_records_tenant_id_tenants", "slaughter_records", type_="foreignkey")
    op.drop_column("slaughter_records", "inventory_posted_at")
    op.drop_column("slaughter_records", "approved_at")
    op.drop_column("slaughter_records", "approved_by_user_id")
    op.drop_column("slaughter_records", "approval_status")
    op.drop_column("slaughter_records", "cold_room_location")
    op.drop_column("slaughter_records", "quality_inspection_status")
    op.drop_column("slaughter_records", "waste_disposal_notes")
    op.drop_column("slaughter_records", "reusable_byproducts_weight")
    op.drop_column("slaughter_records", "feet_weight")
    op.drop_column("slaughter_records", "head_weight")
    op.drop_column("slaughter_records", "offal_weight")
    op.drop_column("slaughter_records", "feathers_weight")
    op.drop_column("slaughter_records", "blood_weight")
    op.drop_column("slaughter_records", "loss_percentage")
    op.drop_column("slaughter_records", "average_dressed_weight")
    op.drop_column("slaughter_records", "average_live_weight")
    op.drop_column("slaughter_records", "mortality_birds_count")
    op.drop_column("slaughter_records", "tenant_id")

    op.drop_column("compliance_documents", "reminder_date")

    op.drop_index("ix_tenant_domains_normalized_host", table_name="tenant_domains")
    op.drop_column("tenant_domains", "last_error")
    op.drop_column("tenant_domains", "disabled_at")
    op.drop_column("tenant_domains", "activated_at")
    op.drop_column("tenant_domains", "last_checked_at")
    op.drop_column("tenant_domains", "ssl_issued_at")
    op.drop_column("tenant_domains", "ssl_requested_at")
    op.drop_column("tenant_domains", "dns_verified_at")
    op.drop_column("tenant_domains", "verification_target")
    op.drop_column("tenant_domains", "domain_type")
    op.drop_column("tenant_domains", "normalized_host")

    op.execute("DROP TYPE IF EXISTS slaughterapprovalstatus")
    op.execute("DROP TYPE IF EXISTS qualityinspectionstatus")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS modulerequeststatus")
    op.execute("DROP TYPE IF EXISTS domaintype")
