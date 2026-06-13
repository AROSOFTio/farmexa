"""
Default SaaS catalog for modules, plans, and pricing.
"""

DEFAULT_MODULES = [
    {"key": "dashboard", "name": "Dashboard", "category": "dashboard", "description": "Overview, tasks, and alerts", "is_core": True},
    {"key": "farm_profile", "name": "Farm Profile", "category": "farm_setup", "description": "Tenant farm profile and settings", "is_core": True},
    {"key": "houses", "name": "Houses / Pens", "category": "farm_setup", "description": "Farm housing and pen structure", "is_core": True},
    {"key": "breeds", "name": "Breeds", "category": "farm_setup", "description": "Bird breed master data", "is_core": False},
    {"key": "suppliers", "name": "Suppliers", "category": "farm_setup", "description": "Suppliers and procurement contacts", "is_core": False},
    {"key": "customers", "name": "Customers", "category": "sales", "description": "Customer directory and balances", "is_core": False},
    {"key": "batches", "name": "Batches / Flocks", "category": "batches", "description": "Batch registration and monitoring", "is_core": True},
    {"key": "batch_performance", "name": "Batch Performance", "category": "batches", "description": "Batch KPIs and performance analysis", "is_core": False},
    {"key": "egg_production", "name": "Egg Collection", "category": "daily_operations", "description": "Daily egg collection and rate tracking", "is_core": True},
    {"key": "feed_consumption", "name": "Feed Usage", "category": "daily_operations", "description": "Feed consumption and usage logs", "is_core": True},
    {"key": "mortality", "name": "Mortality", "category": "daily_operations", "description": "Mortality records and reasons", "is_core": True},
    {"key": "vaccination", "name": "Vaccination", "category": "daily_operations", "description": "Vaccination schedule and logs", "is_core": False},
    {"key": "medication", "name": "Medication", "category": "daily_operations", "description": "Medication records", "is_core": False},
    {"key": "growth_tracking", "name": "Growth / Weight Checks", "category": "daily_operations", "description": "Weight checks and growth trends", "is_core": False},
    {"key": "health_observations", "name": "Health Observations", "category": "daily_operations", "description": "Health notes and welfare issues", "is_core": False},
    {"key": "feed_stock", "name": "Feed Stock", "category": "inventory", "description": "Feed inventory", "is_core": True},
    {"key": "feed_purchases", "name": "Feed Purchases", "category": "feed", "description": "Feed procurement and receiving", "is_core": False},
    {"key": "feed_suppliers", "name": "Feed Suppliers", "category": "feed", "description": "Feed supplier tracking", "is_core": False},
    {"key": "feed_wastage", "name": "Feed Wastage", "category": "feed", "description": "Feed loss and wastage tracking", "is_core": False},
    {"key": "inventory_items", "name": "Inventory Items", "category": "inventory", "description": "General stock records", "is_core": False},
    {"key": "inventory_movements", "name": "Stock Movements", "category": "inventory", "description": "Stock movements and transfers", "is_core": False},
    {"key": "medicine_supplies", "name": "Medicine Stock", "category": "inventory", "description": "Medicine and supplies stock", "is_core": False},
    {"key": "egg_stock", "name": "Egg Stock", "category": "inventory", "description": "Egg inventory", "is_core": False},
    {"key": "meat_stock", "name": "Meat Stock", "category": "inventory", "description": "Processed meat inventory", "is_core": False},
    {"key": "packaging_stock", "name": "Packaging Stock", "category": "inventory", "description": "Packaging inventory", "is_core": False},
    {"key": "byproduct_stock", "name": "Byproduct Stock", "category": "inventory", "description": "Byproduct stock", "is_core": False},
    {"key": "low_stock_alerts", "name": "Low Stock Alerts", "category": "inventory", "description": "Inventory alerting", "is_core": False},
    {"key": "slaughter_planning", "name": "Slaughter Planning", "category": "slaughter", "description": "Processing schedules and preparation", "is_core": False},
    {"key": "slaughter_records", "name": "Slaughter Records", "category": "slaughter", "description": "Slaughter transactions and yields", "is_core": False},
    {"key": "slaughter_outputs", "name": "Slaughter Outputs", "category": "slaughter", "description": "Processed output inventory", "is_core": False},
    {"key": "slaughter_cut_parts", "name": "Cut Parts", "category": "slaughter", "description": "Detailed cut part capture", "is_core": False},
    {"key": "slaughter_byproducts", "name": "Byproducts", "category": "slaughter", "description": "Byproduct capture and disposition", "is_core": False},
    {"key": "yield_analysis", "name": "Yield Analysis", "category": "slaughter", "description": "Yield and processing loss reporting", "is_core": False},
    {"key": "sales_orders", "name": "Orders", "category": "sales", "description": "Sales orders", "is_core": False},
    {"key": "invoices", "name": "Invoices", "category": "sales", "description": "Invoicing", "is_core": False},
    {"key": "payments", "name": "Payments", "category": "sales", "description": "Payment collection", "is_core": False},
    {"key": "balances", "name": "Balances", "category": "sales", "description": "Customer balances", "is_core": False},
    {"key": "expenses", "name": "Expenses", "category": "finance", "description": "Expense tracking", "is_core": False},
    {"key": "income", "name": "Income", "category": "finance", "description": "Income tracking", "is_core": False},
    {"key": "batch_costing", "name": "Batch Costing", "category": "finance", "description": "Batch cost allocation", "is_core": False},
    {"key": "profit_loss", "name": "Profit & Loss", "category": "finance", "description": "Profit and loss reporting", "is_core": False},
    {"key": "cash_flow", "name": "Cash Flow", "category": "finance", "description": "Cash flow reporting", "is_core": False},
    {"key": "accounting", "name": "Accounting", "category": "finance", "description": "Chart of accounts and journals", "is_core": False},
    {"key": "compliance_documents", "name": "Compliance Documents", "category": "compliance", "description": "Licences, permits, and tax documents", "is_core": False},
    {"key": "compliance_alerts", "name": "Compliance Alerts", "category": "compliance", "description": "Expiry and renewal alerts", "is_core": False},
    {"key": "reports", "name": "Reports", "category": "reports", "description": "Operational and management reports", "is_core": True},
    {"key": "users", "name": "Users", "category": "administration", "description": "User administration", "is_core": True},
    {"key": "settings", "name": "Settings", "category": "administration", "description": "Tenant settings", "is_core": True},
    {"key": "hr", "name": "HR & Payroll", "category": "hr", "description": "Employees, leave, attendance, and payroll", "is_core": False},
]

MANDATORY_TENANT_MODULE_KEYS = {"dashboard", "users", "settings"}

# ---------------------------------------------------------------------------
# Packaging — modules are sold as domain packages, not one by one.
#
#   Tier packages   are bundled into the Starter / Farmer / Enterprise plans.
#   Add-on packages are bought on top of any plan (and are all included in the
#                   full trial). Add-on pricing is either a flat USD amount or a
#                   percentage of the tenant's base plan price.
# ---------------------------------------------------------------------------
PKG_FOUNDATION = ["dashboard", "users", "settings", "farm_profile", "reports"]
PKG_FLOCK_OPS = [
    "houses", "breeds", "batches", "batch_performance", "egg_production",
    "feed_consumption", "mortality", "vaccination", "medication",
    "growth_tracking", "health_observations",
]
PKG_FEED_INVENTORY = [
    "feed_stock", "feed_purchases", "feed_suppliers", "feed_wastage", "suppliers",
    "inventory_items", "inventory_movements", "medicine_supplies", "egg_stock",
    "meat_stock", "packaging_stock", "byproduct_stock", "low_stock_alerts",
]
PKG_SALES = ["customers", "sales_orders", "invoices", "payments", "balances"]
PKG_FINANCE = ["accounting", "expenses", "income", "batch_costing", "profit_loss", "cash_flow"]
PKG_SLAUGHTER = [
    "slaughter_planning", "slaughter_records", "slaughter_outputs",
    "slaughter_cut_parts", "slaughter_byproducts", "yield_analysis",
]
PKG_COMPLIANCE = ["compliance_documents", "compliance_alerts"]
PKG_HR = ["hr"]

MODULE_PACKAGES = [
    {"key": "foundation", "name": "Foundation", "kind": "core", "modules": PKG_FOUNDATION,
     "description": "Dashboard, users, settings, farm profile, and reports."},
    {"key": "flock_ops", "name": "Flock & Farm Operations", "kind": "tier", "modules": PKG_FLOCK_OPS,
     "description": "Houses, batches, egg collection, feed use, mortality, vaccination, medication, growth, health."},
    {"key": "feed_inventory", "name": "Feed & Inventory", "kind": "tier", "modules": PKG_FEED_INVENTORY,
     "description": "Feed purchases & suppliers, stock, movements, medicine and product stock, low-stock alerts."},
    {"key": "sales", "name": "Sales & Customers", "kind": "tier", "modules": PKG_SALES,
     "description": "Customers, orders, invoices, payments, and balances."},
    {"key": "finance", "name": "Finance & Accounting", "kind": "tier", "modules": PKG_FINANCE,
     "description": "Accounting, expenses, income, batch costing, P&L, and cash flow."},
    # Add-ons — pricing.mode is "flat" (monthly USD) or "percent" (of base plan price).
    {"key": "slaughter", "name": "Slaughter & Processing", "kind": "addon", "modules": PKG_SLAUGHTER,
     "description": "Processing planning, records, outputs, cut parts, byproducts, and yield analysis.",
     "pricing": {"mode": "flat", "monthly": 9.0, "currency": "USD"}},
    {"key": "compliance", "name": "Compliance", "kind": "addon", "modules": PKG_COMPLIANCE,
     "description": "Compliance documents and expiry/renewal alerts.",
     "pricing": {"mode": "percent", "percent": 5}},
    {"key": "hr", "name": "HR & Payroll", "kind": "addon", "modules": PKG_HR,
     "description": "Employees, leave, attendance, and payroll.",
     "pricing": {"mode": "percent", "percent": 15}},
]

DEFAULT_PLANS = [
    {
        "code": "full_trial",
        "name": "Full Trial",
        "description": "14-day full-feature Farmexa trial with every module and add-on enabled",
        "billing_cycle": "monthly",
        "monthly_price": 0,
        "quarterly_price": 0,
        "annual_price": 0,
        "currency": "USD",
        "trial_days": 14,
        "is_custom": False,
    },
    {
        # code kept as "basic" for backward compatibility with existing tenants.
        "code": "basic",
        "name": "Starter",
        "description": "Run your flock day to day: farm operations and core feed stock.",
        "billing_cycle": "monthly",
        "monthly_price": 16,
        "quarterly_price": 48,
        "annual_price": 160,  # ~2 months free
        "currency": "USD",
        "trial_days": 14,
        "is_custom": False,
    },
    {
        "code": "standard",
        "name": "Farmer",
        "description": "Grow and trade: full feed & inventory plus sales and customers.",
        "billing_cycle": "monthly",
        "monthly_price": 20,
        "quarterly_price": 60,
        "annual_price": 200,  # ~2 months free
        "currency": "USD",
        "trial_days": 14,
        "is_custom": False,
    },
    {
        "code": "premium",
        "name": "Enterprise",
        "description": "Run the whole business: everything in Farmer plus finance & accounting.",
        "billing_cycle": "monthly",
        "monthly_price": 25,
        "quarterly_price": 75,
        "annual_price": 250,  # ~2 months free
        "currency": "USD",
        "trial_days": 14,
        "is_custom": False,
    },
    {
        "code": "custom",
        "name": "Custom",
        "description": "Developer-admin configured package",
        "billing_cycle": "monthly",
        "monthly_price": 0,
        "quarterly_price": 0,
        "annual_price": 0,
        "currency": "USD",
        "trial_days": 0,
        "is_custom": True,
    },
]

def _dedupe(keys: list[str]) -> list[str]:
    """Order-preserving de-duplication for composed package lists."""
    return list(dict.fromkeys(keys))


# Tiers are composed from packages. Each tier is the one below it plus more.
# Starter only ships the core "feed_stock" slice of Feed & Inventory.
_STARTER_MODULES = _dedupe(PKG_FOUNDATION + PKG_FLOCK_OPS + ["feed_stock"])
_FARMER_MODULES = _dedupe(_STARTER_MODULES + PKG_FEED_INVENTORY + PKG_SALES)
_ENTERPRISE_MODULES = _dedupe(_FARMER_MODULES + PKG_FINANCE)

DEFAULT_PLAN_MODULES = {
    # Trial unlocks everything, including the add-on packages.
    "full_trial": [module["key"] for module in DEFAULT_MODULES],
    "basic": _STARTER_MODULES,        # Starter
    "standard": _FARMER_MODULES,      # Farmer
    "premium": _ENTERPRISE_MODULES,   # Enterprise
    "custom": [],
}

# Flat per-module price overrides. Percentage-priced add-ons (HR, Compliance)
# are defined in MODULE_PACKAGES because their amount depends on the base plan.
# The Slaughter & Processing add-on is a flat $9/mo; we tag it on its anchor
# module so the package totals $9 regardless of how many sub-modules it carries.
DEFAULT_MODULE_PRICES = [
    {"module_key": "slaughter_records", "billing_cycle": "monthly", "price": 9, "currency": "USD", "notes": "Slaughter & Processing add-on (flat monthly)"},
]
