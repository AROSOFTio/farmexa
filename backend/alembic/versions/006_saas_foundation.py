"""
Normalize SaaS catalog, subscriptions, domains, and compliance foundation.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "006_saas_foundation"
down_revision = "005_user_tenant_scope"
branch_labels = None
depends_on = None


MODULES_TABLE = sa.table(
    "modules",
    sa.column("key", sa.String()),
    sa.column("name", sa.String()),
    sa.column("category", sa.String()),
    sa.column("description", sa.Text()),
    sa.column("is_core", sa.Boolean()),
    sa.column("is_active", sa.Boolean()),
)

PLANS_TABLE = sa.table(
    "plans",
    sa.column("code", sa.String()),
    sa.column("name", sa.String()),
    sa.column("description", sa.Text()),
    sa.column("billing_cycle", sa.String()),
    sa.column("is_custom", sa.Boolean()),
    sa.column("is_active", sa.Boolean()),
)

PLAN_MODULES_TABLE = sa.table(
    "plan_modules",
    sa.column("plan_code", sa.String()),
    sa.column("module_key", sa.String()),
    sa.column("is_included", sa.Boolean()),
)

MODULE_PRICES_TABLE = sa.table(
    "module_prices",
    sa.column("module_key", sa.String()),
    sa.column("billing_cycle", sa.String()),
    sa.column("price", sa.Numeric()),
    sa.column("currency", sa.String()),
    sa.column("notes", sa.Text()),
)


def upgrade() -> None:
    bind = op.get_bind()
    billing_cycle_enum = postgresql.ENUM(
        "monthly", "quarterly", "annual", name="billingcycle", create_type=False
    )

    domain_status_enum = postgresql.ENUM(
        "pending", "active", "disabled", name="domainstatus", create_type=False
    )
    subscription_status_enum = postgresql.ENUM(
        "trial", "active", "past_due", "expired", "suspended", "cancelled",
        name="subscriptionstatus", create_type=False
    )
    compliance_type_enum = postgresql.ENUM(
        "ura_tax_document",
        "trading_licence",
        "veterinary_permit",
        "tax_clearance",
        "farm_registration",
        "nssf_paye",
        "contract",
        "insurance",
        "inspection_report",
        "other",
        name="compliancedocumenttype",
        create_type=False,
    )
    compliance_status_enum = postgresql.ENUM(
        "active", "expiring_soon", "expired", "renewal_due", "missing",
        name="compliancedocumentstatus",
        create_type=False,
    )
    reminder_status_enum = postgresql.ENUM(
        "pending", "sent", "dismissed", name="documentreminderstatus", create_type=False
    )

    domain_status_enum.create(bind, checkfirst=True)
    subscription_status_enum.create(bind, checkfirst=True)
    compliance_type_enum.create(bind, checkfirst=True)
    compliance_status_enum.create(bind, checkfirst=True)
    reminder_status_enum.create(bind, checkfirst=True)

    op.add_column("tenants", sa.Column("business_name", sa.String(length=200), nullable=True))
    op.add_column("tenants", sa.Column("contact_person", sa.String(length=150), nullable=True))

    op.create_table(
        "modules",
        sa.Column("key", sa.String(length=100), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_core", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_modules_category", "modules", ["category"])

    op.create_table(
        "plans",
        sa.Column("code", sa.String(length=50), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("billing_cycle", billing_cycle_enum, nullable=False, server_default="monthly"),
        sa.Column("is_custom", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "plan_modules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_code", sa.String(length=50), sa.ForeignKey("plans.code", ondelete="CASCADE"), nullable=False),
        sa.Column("module_key", sa.String(length=100), sa.ForeignKey("modules.key", ondelete="CASCADE"), nullable=False),
        sa.Column("is_included", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("plan_code", "module_key", name="uq_plan_module"),
    )
    op.create_index("ix_plan_modules_plan_code", "plan_modules", ["plan_code"])
    op.create_index("ix_plan_modules_module_key", "plan_modules", ["module_key"])

    op.create_table(
        "tenant_domains",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("host", sa.String(length=255), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status", domain_status_enum, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("host", name="uq_tenant_domains_host"),
    )
    op.create_index("ix_tenant_domains_tenant_id", "tenant_domains", ["tenant_id"])
    op.create_index("ix_tenant_domains_host", "tenant_domains", ["host"])

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_code", sa.String(length=50), sa.ForeignKey("plans.code", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", subscription_status_enum, nullable=False, server_default="trial"),
        sa.Column("billing_cycle", billing_cycle_enum, nullable=False, server_default="monthly"),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("last_payment_date", sa.Date(), nullable=True),
        sa.Column("next_invoice_date", sa.Date(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="UGX"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_subscriptions_tenant_id", "subscriptions", ["tenant_id"])
    op.create_index("ix_subscriptions_plan_code", "subscriptions", ["plan_code"])

    op.create_table(
        "module_prices",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("module_key", sa.String(length=100), sa.ForeignKey("modules.key", ondelete="CASCADE"), nullable=False),
        sa.Column("billing_cycle", billing_cycle_enum, nullable=False, server_default="monthly"),
        sa.Column("price", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="UGX"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("module_key", "billing_cycle", name="uq_module_price_cycle"),
    )
    op.create_index("ix_module_prices_module_key", "module_prices", ["module_key"])

    op.create_table(
        "compliance_documents",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("document_type", compliance_type_enum, nullable=False),
        sa.Column("reference_number", sa.String(length=120), nullable=True),
        sa.Column("issuing_authority", sa.String(length=150), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("renewal_date", sa.Date(), nullable=True),
        sa.Column("responsible_person", sa.String(length=150), nullable=True),
        sa.Column("file_url", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", compliance_status_enum, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_compliance_documents_tenant_id", "compliance_documents", ["tenant_id"])
    op.create_index("ix_compliance_documents_status", "compliance_documents", ["status"])

    op.create_table(
        "document_reminders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("compliance_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_type", sa.String(length=30), nullable=False),
        sa.Column("scheduled_for", sa.Date(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", reminder_status_enum, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_document_reminders_tenant_id", "document_reminders", ["tenant_id"])
    op.create_index("ix_document_reminders_scheduled_for", "document_reminders", ["scheduled_for"])

    op.bulk_insert(
        MODULES_TABLE,
        [
            {"key": "dashboard", "name": "Dashboard", "category": "dashboard", "description": "Overview, tasks, and alerts", "is_core": True, "is_active": True},
            {"key": "farm_profile", "name": "Farm Profile", "category": "farm_setup", "description": "Tenant farm profile and settings", "is_core": True, "is_active": True},
            {"key": "houses", "name": "Houses / Pens", "category": "farm_setup", "description": "Farm housing and pen structure", "is_core": True, "is_active": True},
            {"key": "breeds", "name": "Breeds", "category": "farm_setup", "description": "Bird breed master data", "is_core": False, "is_active": True},
            {"key": "suppliers", "name": "Suppliers", "category": "farm_setup", "description": "Suppliers and procurement contacts", "is_core": False, "is_active": True},
            {"key": "customers", "name": "Customers", "category": "sales", "description": "Customer directory and balances", "is_core": False, "is_active": True},
            {"key": "batches", "name": "Batches / Flocks", "category": "batches", "description": "Batch registration and monitoring", "is_core": True, "is_active": True},
            {"key": "batch_performance", "name": "Batch Performance", "category": "batches", "description": "Batch KPIs and performance analysis", "is_core": False, "is_active": True},
            {"key": "egg_production", "name": "Egg Collection", "category": "daily_operations", "description": "Daily egg collection and rate tracking", "is_core": True, "is_active": True},
            {"key": "feed_consumption", "name": "Feed Usage", "category": "daily_operations", "description": "Feed consumption and usage logs", "is_core": True, "is_active": True},
            {"key": "mortality", "name": "Mortality", "category": "daily_operations", "description": "Mortality records and reasons", "is_core": True, "is_active": True},
            {"key": "vaccination", "name": "Vaccination", "category": "daily_operations", "description": "Vaccination schedule and logs", "is_core": False, "is_active": True},
            {"key": "medication", "name": "Medication", "category": "daily_operations", "description": "Medication records", "is_core": False, "is_active": True},
            {"key": "growth_tracking", "name": "Growth / Weight Checks", "category": "daily_operations", "description": "Weight checks and growth trends", "is_core": False, "is_active": True},
            {"key": "health_observations", "name": "Health Observations", "category": "daily_operations", "description": "Health notes and welfare issues", "is_core": False, "is_active": True},
            {"key": "feed_stock", "name": "Feed Stock", "category": "inventory", "description": "Feed inventory", "is_core": True, "is_active": True},
            {"key": "feed_purchases", "name": "Feed Purchases", "category": "feed", "description": "Feed procurement and receiving", "is_core": False, "is_active": True},
            {"key": "feed_suppliers", "name": "Feed Suppliers", "category": "feed", "description": "Feed supplier tracking", "is_core": False, "is_active": True},
            {"key": "feed_wastage", "name": "Feed Wastage", "category": "feed", "description": "Feed loss and wastage tracking", "is_core": False, "is_active": True},
            {"key": "inventory_items", "name": "Inventory Items", "category": "inventory", "description": "General stock records", "is_core": False, "is_active": True},
            {"key": "inventory_movements", "name": "Stock Movements", "category": "inventory", "description": "Stock movements and transfers", "is_core": False, "is_active": True},
            {"key": "medicine_supplies", "name": "Medicine Stock", "category": "inventory", "description": "Medicine and supplies stock", "is_core": False, "is_active": True},
            {"key": "egg_stock", "name": "Egg Stock", "category": "inventory", "description": "Egg inventory", "is_core": False, "is_active": True},
            {"key": "meat_stock", "name": "Meat Stock", "category": "inventory", "description": "Processed meat inventory", "is_core": False, "is_active": True},
            {"key": "packaging_stock", "name": "Packaging Stock", "category": "inventory", "description": "Packaging inventory", "is_core": False, "is_active": True},
            {"key": "byproduct_stock", "name": "Byproduct Stock", "category": "inventory", "description": "Byproduct stock", "is_core": False, "is_active": True},
            {"key": "low_stock_alerts", "name": "Low Stock Alerts", "category": "inventory", "description": "Inventory alerting", "is_core": False, "is_active": True},
            {"key": "slaughter_planning", "name": "Slaughter Planning", "category": "slaughter", "description": "Processing schedules and preparation", "is_core": False, "is_active": True},
            {"key": "slaughter_records", "name": "Slaughter Records", "category": "slaughter", "description": "Slaughter transactions and yields", "is_core": False, "is_active": True},
            {"key": "slaughter_outputs", "name": "Slaughter Outputs", "category": "slaughter", "description": "Processed output inventory", "is_core": False, "is_active": True},
            {"key": "slaughter_cut_parts", "name": "Cut Parts", "category": "slaughter", "description": "Detailed cut part capture", "is_core": False, "is_active": True},
            {"key": "slaughter_byproducts", "name": "Byproducts", "category": "slaughter", "description": "Byproduct capture and disposition", "is_core": False, "is_active": True},
            {"key": "yield_analysis", "name": "Yield Analysis", "category": "slaughter", "description": "Yield and processing loss reporting", "is_core": False, "is_active": True},
            {"key": "sales_orders", "name": "Orders", "category": "sales", "description": "Sales orders", "is_core": False, "is_active": True},
            {"key": "invoices", "name": "Invoices", "category": "sales", "description": "Invoicing", "is_core": False, "is_active": True},
            {"key": "payments", "name": "Payments", "category": "sales", "description": "Payment collection", "is_core": False, "is_active": True},
            {"key": "balances", "name": "Balances", "category": "sales", "description": "Customer balances", "is_core": False, "is_active": True},
            {"key": "expenses", "name": "Expenses", "category": "finance", "description": "Expense tracking", "is_core": False, "is_active": True},
            {"key": "income", "name": "Income", "category": "finance", "description": "Income tracking", "is_core": False, "is_active": True},
            {"key": "batch_costing", "name": "Batch Costing", "category": "finance", "description": "Batch cost allocation", "is_core": False, "is_active": True},
            {"key": "profit_loss", "name": "Profit & Loss", "category": "finance", "description": "Profit and loss reporting", "is_core": False, "is_active": True},
            {"key": "cash_flow", "name": "Cash Flow", "category": "finance", "description": "Cash flow reporting", "is_core": False, "is_active": True},
            {"key": "compliance_documents", "name": "Compliance Documents", "category": "compliance", "description": "Licences, permits, and tax documents", "is_core": False, "is_active": True},
            {"key": "compliance_alerts", "name": "Compliance Alerts", "category": "compliance", "description": "Expiry and renewal alerts", "is_core": False, "is_active": True},
            {"key": "reports", "name": "Reports", "category": "reports", "description": "Operational and management reports", "is_core": True, "is_active": True},
            {"key": "users", "name": "Users", "category": "administration", "description": "User administration", "is_core": False, "is_active": True},
            {"key": "settings", "name": "Settings", "category": "administration", "description": "Tenant settings", "is_core": False, "is_active": True},
        ],
    )

    op.bulk_insert(
        PLANS_TABLE,
        [
            {"code": "basic", "name": "Core", "description": "Core farm operation modules", "billing_cycle": "monthly", "is_custom": False, "is_active": True},
            {"code": "standard", "name": "Standard", "description": "Operational, feed, inventory, and sales modules", "billing_cycle": "monthly", "is_custom": False, "is_active": True},
            {"code": "premium", "name": "Premium", "description": "Full operational, compliance, finance, and admin suite", "billing_cycle": "monthly", "is_custom": False, "is_active": True},
            {"code": "custom", "name": "Custom", "description": "Developer-admin configured package", "billing_cycle": "monthly", "is_custom": True, "is_active": True},
        ],
    )

    for plan_code, module_keys in {
        "basic": ["dashboard", "farm_profile", "houses", "batches", "egg_production", "feed_stock", "feed_consumption", "mortality", "reports"],
        "standard": ["dashboard", "farm_profile", "houses", "batches", "egg_production", "feed_stock", "feed_consumption", "mortality", "vaccination", "medication", "growth_tracking", "feed_purchases", "feed_suppliers", "inventory_items", "inventory_movements", "customers", "sales_orders", "invoices", "payments", "slaughter_records", "slaughter_outputs", "reports"],
        "premium": ["dashboard", "farm_profile", "houses", "breeds", "suppliers", "customers", "batches", "batch_performance", "egg_production", "feed_consumption", "mortality", "vaccination", "medication", "growth_tracking", "health_observations", "feed_stock", "feed_purchases", "feed_suppliers", "feed_wastage", "inventory_items", "inventory_movements", "medicine_supplies", "egg_stock", "meat_stock", "packaging_stock", "byproduct_stock", "low_stock_alerts", "slaughter_planning", "slaughter_records", "slaughter_outputs", "slaughter_cut_parts", "slaughter_byproducts", "yield_analysis", "sales_orders", "invoices", "payments", "expenses", "income", "batch_costing", "profit_loss", "cash_flow", "compliance_documents", "compliance_alerts", "reports", "users", "settings"],
    }.items():
        op.bulk_insert(
            PLAN_MODULES_TABLE,
            [{"plan_code": plan_code, "module_key": module_key, "is_included": True} for module_key in module_keys],
        )

    op.bulk_insert(
        MODULE_PRICES_TABLE,
        [
            {"module_key": "slaughter_records", "billing_cycle": "monthly", "price": 150000, "currency": "UGX", "notes": "Advanced processing module"},
            {"module_key": "compliance_documents", "billing_cycle": "monthly", "price": 100000, "currency": "UGX", "notes": "Compliance and reminders"},
            {"module_key": "profit_loss", "billing_cycle": "monthly", "price": 120000, "currency": "UGX", "notes": "Advanced finance reporting"},
        ],
    )

    op.execute(
        """
        DELETE FROM tenant_modules
        WHERE module_key NOT IN (SELECT key FROM modules)
        """
    )

    op.execute(
        """
        DELETE FROM tenant_modules
        WHERE id IN (
            SELECT id
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY tenant_id, module_key ORDER BY id) AS row_num
                FROM tenant_modules
            ) duplicate_rows
            WHERE duplicate_rows.row_num > 1
        )
        """
    )

    op.create_foreign_key(
        "fk_tenant_modules_module_key_modules",
        "tenant_modules",
        "modules",
        ["module_key"],
        ["key"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint("uq_tenant_module", "tenant_modules", ["tenant_id", "module_key"])

    op.execute(
        """
        INSERT INTO subscriptions (tenant_id, plan_code, status, billing_cycle, start_date, expiry_date, notes)
        SELECT
            id,
            plan::text,
            CASE
                WHEN is_suspended = true THEN 'suspended'
                WHEN status::text = 'expired' THEN 'expired'
                WHEN status::text = 'trial' THEN 'trial'
                ELSE 'active'
            END::subscriptionstatus,
            billing_cycle,
            COALESCE(subscription_start, CURRENT_DATE),
            subscription_expiry,
            notes
        FROM tenants
        """
    )

    op.execute(
        """
        INSERT INTO tenant_domains (tenant_id, host, is_primary, status)
        SELECT id, slug || '.farmexa.local', true, 'pending'::domainstatus
        FROM tenants
        """
    )


def downgrade() -> None:
    op.drop_constraint("uq_tenant_module", "tenant_modules", type_="unique")
    op.drop_constraint("fk_tenant_modules_module_key_modules", "tenant_modules", type_="foreignkey")

    op.drop_index("ix_document_reminders_scheduled_for", table_name="document_reminders")
    op.drop_index("ix_document_reminders_tenant_id", table_name="document_reminders")
    op.drop_table("document_reminders")

    op.drop_index("ix_compliance_documents_status", table_name="compliance_documents")
    op.drop_index("ix_compliance_documents_tenant_id", table_name="compliance_documents")
    op.drop_table("compliance_documents")

    op.drop_index("ix_module_prices_module_key", table_name="module_prices")
    op.drop_table("module_prices")

    op.drop_index("ix_subscriptions_plan_code", table_name="subscriptions")
    op.drop_index("ix_subscriptions_tenant_id", table_name="subscriptions")
    op.drop_table("subscriptions")

    op.drop_index("ix_tenant_domains_host", table_name="tenant_domains")
    op.drop_index("ix_tenant_domains_tenant_id", table_name="tenant_domains")
    op.drop_table("tenant_domains")

    op.drop_index("ix_plan_modules_module_key", table_name="plan_modules")
    op.drop_index("ix_plan_modules_plan_code", table_name="plan_modules")
    op.drop_table("plan_modules")
    op.drop_table("plans")

    op.drop_index("ix_modules_category", table_name="modules")
    op.drop_table("modules")

    op.drop_column("tenants", "contact_person")
    op.drop_column("tenants", "business_name")

    op.execute("DROP TYPE IF EXISTS documentreminderstatus")
    op.execute("DROP TYPE IF EXISTS compliancedocumentstatus")
    op.execute("DROP TYPE IF EXISTS compliancedocumenttype")
    op.execute("DROP TYPE IF EXISTS subscriptionstatus")
    op.execute("DROP TYPE IF EXISTS domainstatus")
