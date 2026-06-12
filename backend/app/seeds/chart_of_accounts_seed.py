"""
Enterprise Poultry Chart of Accounts Seed

Full enterprise COA seed for a poultry farm business including:
- Cash and cash equivalents (cash, bank, mobile money, petty cash)
- Biological assets (live broilers, layers, breeders, chicks)
- Inventory (feed, medicine, finished goods)
- Fixed assets and depreciation
- Revenue streams (broiler sales, egg sales, chick sales, manure, hatchery)
- Cost of sales (feed, medicine, chick cost, mortality, vaccination, labour)
- Operating expenses (salaries, utilities, fuel, maintenance, insurance)
- Liabilities (AP, loans, tax payable)
- Equity

All seeded accounts are marked with is_system=True.
The template system auto-applies the default poultry template on tenant setup.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.finance_coa import (
    Account, AccountTemplate, AccountType, FiscalYear, FiscalYearStatus,
    NormalBalance, TemplateAccount, SystemAccountMapping
)


# ---------------------------------------------------------------------------
# Default normal balance per account type
# ---------------------------------------------------------------------------

_TYPE_NORMAL_BALANCE = {
    AccountType.ASSET: NormalBalance.DEBIT,
    AccountType.LIABILITY: NormalBalance.CREDIT,
    AccountType.EQUITY: NormalBalance.CREDIT,
    AccountType.REVENUE: NormalBalance.CREDIT,
    AccountType.COST_OF_SALES: NormalBalance.DEBIT,
    AccountType.EXPENSE: NormalBalance.DEBIT,
}


# ---------------------------------------------------------------------------
# Enterprise Poultry Chart of Accounts
# ---------------------------------------------------------------------------

ENTERPRISE_POULTRY_COA = [
    # ========== ASSETS (1xxx) ==========
    # Header
    {"code": "1000", "name": "ASSETS", "type": AccountType.ASSET, "parent": None, "manual": False,
     "desc": "Total Assets"},

    # Current Assets
    {"code": "1100", "name": "Current Assets", "type": AccountType.ASSET, "parent": "1000", "manual": False,
     "desc": "Assets convertible to cash within one year"},

    # Cash Group
    {"code": "1110", "name": "Cash and Cash Equivalents", "type": AccountType.ASSET, "parent": "1100", "manual": False,
     "desc": "All cash holdings"},
    {"code": "1111", "name": "Cash on Hand",              "type": AccountType.ASSET, "parent": "1110",
     "desc": "Physical cash in office or till"},
    {"code": "1112", "name": "Bank Account",              "type": AccountType.ASSET, "parent": "1110",
     "desc": "Main bank account"},
    {"code": "1113", "name": "Mobile Money",              "type": AccountType.ASSET, "parent": "1110",
     "desc": "Mobile money accounts (MTN, Airtel, M-Pesa, etc.)"},
    {"code": "1114", "name": "Petty Cash",                "type": AccountType.ASSET, "parent": "1110",
     "desc": "Small cash float for minor expenses"},

    # Receivables
    {"code": "1120", "name": "Accounts Receivable",       "type": AccountType.ASSET, "parent": "1100",
     "desc": "Amounts owed by customers"},

    # Inventory
    {"code": "1130", "name": "Inventory",                 "type": AccountType.ASSET, "parent": "1100", "manual": False,
     "desc": "All stock and biological inventory"},
    {"code": "1131", "name": "Feed Inventory",            "type": AccountType.ASSET, "parent": "1130",
     "desc": "Feed stock (layers mash, broiler starter, finisher, etc.)"},
    {"code": "1132", "name": "Medicine & Vaccine Inventory", "type": AccountType.ASSET, "parent": "1130",
     "desc": "Drugs, vaccines and veterinary consumables"},
    {"code": "1133", "name": "Live Broiler Inventory",   "type": AccountType.ASSET, "parent": "1130",
     "desc": "Live broiler birds in production"},
    {"code": "1134", "name": "Finished Goods — Dressed Chicken", "type": AccountType.ASSET, "parent": "1130",
     "desc": "Processed and dressed chicken awaiting sale"},
    {"code": "1135", "name": "Live Layer Inventory",     "type": AccountType.ASSET, "parent": "1130",
     "desc": "Layer birds in production (biological asset)"},
    {"code": "1136", "name": "Breeder Stock Inventory",  "type": AccountType.ASSET, "parent": "1130",
     "desc": "Breeder birds for hatchery operations (biological asset)"},
    {"code": "1137", "name": "Day-Old Chick Inventory",  "type": AccountType.ASSET, "parent": "1130",
     "desc": "DOC stock held for transfer or sale"},
    {"code": "1138", "name": "Egg Inventory",            "type": AccountType.ASSET, "parent": "1130",
     "desc": "Eggs collected and in cold storage"},
    {"code": "1139", "name": "Byproduct Inventory",      "type": AccountType.ASSET, "parent": "1130",
     "desc": "Feathers, offal, manure and other byproducts"},

    # Goods In Transit
    {"code": "1145", "name": "Goods In Transit",         "type": AccountType.ASSET, "parent": "1130",
     "desc": "Stock value of inter-branch transfers in transit"},

    # Other Current Assets
    {"code": "1140", "name": "Prepaid Expenses",         "type": AccountType.ASSET, "parent": "1100",
     "desc": "Insurance, rent and other advance payments"},
    {"code": "1150", "name": "VAT Input Tax Recoverable", "type": AccountType.ASSET, "parent": "1100",
     "desc": "VAT paid on purchases, recoverable from tax authority"},

    # Non-current Assets
    {"code": "1200", "name": "Non-Current Assets",       "type": AccountType.ASSET, "parent": "1000", "manual": False,
     "desc": "Long-term assets"},
    {"code": "1210", "name": "Land",                     "type": AccountType.ASSET, "parent": "1200",
     "desc": "Farm land"},
    {"code": "1220", "name": "Poultry Buildings & Housing", "type": AccountType.ASSET, "parent": "1200",
     "desc": "Poultry houses, brooders, and farm structures"},
    {"code": "1221", "name": "Accum. Depreciation — Buildings", "type": AccountType.ASSET, "parent": "1220",
     "desc": "Accumulated depreciation on buildings"},
    {"code": "1230", "name": "Farm Equipment & Machinery", "type": AccountType.ASSET, "parent": "1200",
     "desc": "Feeders, drinkers, incubators, processing equipment"},
    {"code": "1231", "name": "Accum. Depreciation — Equipment", "type": AccountType.ASSET, "parent": "1230",
     "desc": "Accumulated depreciation on equipment"},
    {"code": "1240", "name": "Motor Vehicles",           "type": AccountType.ASSET, "parent": "1200",
     "desc": "Farm and delivery vehicles"},
    {"code": "1241", "name": "Accum. Depreciation — Vehicles", "type": AccountType.ASSET, "parent": "1240",
     "desc": "Accumulated depreciation on vehicles"},

    # ========== LIABILITIES (2xxx) ==========
    {"code": "2000", "name": "LIABILITIES",              "type": AccountType.LIABILITY, "parent": None, "manual": False,
     "desc": "Total Liabilities"},

    # Current Liabilities
    {"code": "2100", "name": "Current Liabilities",      "type": AccountType.LIABILITY, "parent": "2000", "manual": False,
     "desc": "Obligations due within one year"},
    {"code": "2110", "name": "Accounts Payable",         "type": AccountType.LIABILITY, "parent": "2100",
     "desc": "Amounts owed to feed, medicine, and service suppliers"},
    {"code": "2120", "name": "Accrued Expenses",         "type": AccountType.LIABILITY, "parent": "2100",
     "desc": "Incurred but not yet paid expenses"},
    {"code": "2130", "name": "VAT / Tax Payable",        "type": AccountType.LIABILITY, "parent": "2100",
     "desc": "Tax liabilities to government"},
    {"code": "2140", "name": "PAYE Payable",             "type": AccountType.LIABILITY, "parent": "2100",
     "desc": "Employee tax deducted and due to revenue authority"},
    {"code": "2150", "name": "Short-Term Loan",         "type": AccountType.LIABILITY, "parent": "2100",
     "desc": "Loans due within 12 months"},
    {"code": "2160", "name": "Customer Deposits",        "type": AccountType.LIABILITY, "parent": "2100",
     "desc": "Advance payments from customers"},
    {"code": "2170", "name": "NSSF Payable",             "type": AccountType.LIABILITY, "parent": "2100",
     "desc": "National Social Security Fund contributions payable"},
    {"code": "2180", "name": "NHIF Payable",             "type": AccountType.LIABILITY, "parent": "2100",
     "desc": "National Health Insurance Fund contributions payable"},
    {"code": "2190", "name": "Accrued Salaries Payable", "type": AccountType.LIABILITY, "parent": "2100",
     "desc": "Net salaries owed to employees at period end"},

    # Long-term Liabilities
    {"code": "2200", "name": "Long-Term Liabilities",    "type": AccountType.LIABILITY, "parent": "2000", "manual": False,
     "desc": "Debts due after one year"},
    {"code": "2210", "name": "Long-Term Bank Loan",      "type": AccountType.LIABILITY, "parent": "2200",
     "desc": "Long-term financing from banks"},
    {"code": "2220", "name": "Equipment Finance Lease",  "type": AccountType.LIABILITY, "parent": "2200",
     "desc": "Lease liabilities on farm equipment"},

    # ========== EQUITY (3xxx) ==========
    {"code": "3000", "name": "EQUITY",                   "type": AccountType.EQUITY, "parent": None, "manual": False,
     "desc": "Owners' equity"},
    {"code": "3100", "name": "Owner's Capital",          "type": AccountType.EQUITY, "parent": "3000",
     "desc": "Invested capital by owners"},
    {"code": "3200", "name": "Retained Earnings",        "type": AccountType.EQUITY, "parent": "3000",
     "desc": "Accumulated profits carried forward"},
    {"code": "3300", "name": "Current Year Earnings",    "type": AccountType.EQUITY, "parent": "3000",
     "desc": "Net profit for the current financial year"},
    {"code": "3400", "name": "Owner's Drawings",         "type": AccountType.EQUITY, "parent": "3000",
     "desc": "Withdrawals by owner"},

    # ========== REVENUE (4xxx) ==========
    {"code": "4000", "name": "REVENUE",                  "type": AccountType.REVENUE, "parent": None, "manual": False,
     "desc": "Total Revenue"},
    {"code": "4100", "name": "Poultry Sales Revenue",    "type": AccountType.REVENUE, "parent": "4000", "manual": False,
     "desc": "Revenue from poultry product sales"},
    {"code": "4110", "name": "Broiler / Dressed Chicken Sales", "type": AccountType.REVENUE, "parent": "4100",
     "desc": "Sales of live broilers and dressed chicken"},
    {"code": "4120", "name": "Live Bird Sales",          "type": AccountType.REVENUE, "parent": "4100",
     "desc": "Sales of live birds other than for slaughter"},
    {"code": "4130", "name": "Egg Sales",                "type": AccountType.REVENUE, "parent": "4100",
     "desc": "Sales of table eggs and hatching eggs"},
    {"code": "4140", "name": "Day-Old Chick (DOC) Sales", "type": AccountType.REVENUE, "parent": "4100",
     "desc": "Sales of day-old chicks to other farmers"},
    {"code": "4150", "name": "Hatchery Income",          "type": AccountType.REVENUE, "parent": "4100",
     "desc": "Revenue from contract hatching services"},
    {"code": "4160", "name": "Manure Sales",             "type": AccountType.REVENUE, "parent": "4100",
     "desc": "Revenue from poultry manure and litter"},
    {"code": "4170", "name": "Byproduct Sales",          "type": AccountType.REVENUE, "parent": "4100",
     "desc": "Feathers, offal and other slaughter byproducts sold"},
    {"code": "4200", "name": "Other Income",             "type": AccountType.REVENUE, "parent": "4000",
     "desc": "Miscellaneous and non-operating income"},
    {"code": "4210", "name": "Consultancy & Training Income", "type": AccountType.REVENUE, "parent": "4200",
     "desc": "Income from poultry consultancy or training services"},

    # ========== COST OF SALES (5xxx) ==========
    {"code": "5000", "name": "COST OF SALES",            "type": AccountType.COST_OF_SALES, "parent": None, "manual": False,
     "desc": "Direct costs of producing poultry products"},
    {"code": "5100", "name": "Feed Costs",               "type": AccountType.COST_OF_SALES, "parent": "5000",
     "desc": "Feed consumed by birds in production"},
    {"code": "5110", "name": "Broiler Feed Consumed",    "type": AccountType.COST_OF_SALES, "parent": "5100",
     "desc": "Feed cost allocated to broiler flocks"},
    {"code": "5120", "name": "Layer Feed Consumed",      "type": AccountType.COST_OF_SALES, "parent": "5100",
     "desc": "Feed cost allocated to layer flocks"},
    {"code": "5130", "name": "Breeder Feed Consumed",    "type": AccountType.COST_OF_SALES, "parent": "5100",
     "desc": "Feed cost allocated to breeder flocks"},
    {"code": "5200", "name": "Medicine & Vaccination Cost", "type": AccountType.COST_OF_SALES, "parent": "5000",
     "desc": "Veterinary drugs and vaccines consumed"},
    {"code": "5210", "name": "Vaccine Cost",             "type": AccountType.COST_OF_SALES, "parent": "5200",
     "desc": "Cost of vaccines administered"},
    {"code": "5220", "name": "Medication Cost",          "type": AccountType.COST_OF_SALES, "parent": "5200",
     "desc": "Cost of therapeutic drugs"},
    {"code": "5300", "name": "Day-Old Chick Procurement", "type": AccountType.COST_OF_SALES, "parent": "5000",
     "desc": "Cost of purchasing day-old chicks"},
    {"code": "5400", "name": "Mortality Loss",           "type": AccountType.COST_OF_SALES, "parent": "5000",
     "desc": "Write-off value of dead birds"},
    {"code": "5500", "name": "Slaughter Processing Cost", "type": AccountType.COST_OF_SALES, "parent": "5000",
     "desc": "Cost of slaughter and dressing operations"},
    {"code": "5600", "name": "Labour — Production",      "type": AccountType.COST_OF_SALES, "parent": "5000",
     "desc": "Wages of farm attendants, slaughter workers, and egg collectors"},

    # ========== EXPENSES (6xxx) ==========
    {"code": "6000", "name": "OPERATING EXPENSES",       "type": AccountType.EXPENSE, "parent": None, "manual": False,
     "desc": "Overhead and administrative expenses"},

    # Salaries & HR
    {"code": "6100", "name": "Salaries & Wages",         "type": AccountType.EXPENSE, "parent": "6000", "manual": False,
     "desc": "Employee compensation"},
    {"code": "6110", "name": "Management Salaries",      "type": AccountType.EXPENSE, "parent": "6100",
     "desc": "Salaries of managers and supervisors"},
    {"code": "6120", "name": "Support Staff Salaries",   "type": AccountType.EXPENSE, "parent": "6100",
     "desc": "Administrative and support staff wages"},
    {"code": "6130", "name": "Casual Labour",            "type": AccountType.EXPENSE, "parent": "6100",
     "desc": "Wages for temporary or casual workers"},
    {"code": "6140", "name": "NSSF Employer Contribution", "type": AccountType.EXPENSE, "parent": "6100",
     "desc": "Employer share of NSSF contributions"},
    {"code": "6150", "name": "NHIF Employer Contribution", "type": AccountType.EXPENSE, "parent": "6100",
     "desc": "Employer share of NHIF contributions"},

    # Utilities
    {"code": "6200", "name": "Utilities",                "type": AccountType.EXPENSE, "parent": "6000",
     "desc": "Electricity, water, internet"},
    {"code": "6210", "name": "Electricity",              "type": AccountType.EXPENSE, "parent": "6200",
     "desc": "Electric power costs for houses and equipment"},
    {"code": "6220", "name": "Water",                    "type": AccountType.EXPENSE, "parent": "6200",
     "desc": "Water supply costs"},
    {"code": "6230", "name": "Generator / Fuel",         "type": AccountType.EXPENSE, "parent": "6200",
     "desc": "Fuel for backup generators and farm vehicles"},

    # Maintenance
    {"code": "6300", "name": "Maintenance & Repairs",    "type": AccountType.EXPENSE, "parent": "6000",
     "desc": "Upkeep of buildings and equipment"},
    {"code": "6310", "name": "Building Maintenance",     "type": AccountType.EXPENSE, "parent": "6300",
     "desc": "Repairs to poultry houses and structures"},
    {"code": "6320", "name": "Equipment Maintenance",    "type": AccountType.EXPENSE, "parent": "6300",
     "desc": "Servicing of farm and processing machinery"},

    # Transport
    {"code": "6400", "name": "Transport & Logistics",    "type": AccountType.EXPENSE, "parent": "6000",
     "desc": "Delivery and logistics costs"},
    {"code": "6410", "name": "Vehicle Operating Cost",   "type": AccountType.EXPENSE, "parent": "6400",
     "desc": "Fuel, insurance, and maintenance of company vehicles"},
    {"code": "6420", "name": "Hired Transport",          "type": AccountType.EXPENSE, "parent": "6400",
     "desc": "Third-party transport hired for deliveries"},

    # Admin
    {"code": "6500", "name": "Administrative Expenses",  "type": AccountType.EXPENSE, "parent": "6000", "manual": False,
     "desc": "General overhead"},
    {"code": "6510", "name": "Office Supplies",          "type": AccountType.EXPENSE, "parent": "6500",
     "desc": "Stationery and consumables"},
    {"code": "6520", "name": "Professional Fees",        "type": AccountType.EXPENSE, "parent": "6500",
     "desc": "Accounting, legal, and veterinary professional fees"},
    {"code": "6530", "name": "Insurance",                "type": AccountType.EXPENSE, "parent": "6500",
     "desc": "Property, livestock, and liability insurance"},
    {"code": "6540", "name": "Rent",                     "type": AccountType.EXPENSE, "parent": "6500",
     "desc": "Land and premises rent"},
    {"code": "6550", "name": "Marketing & Advertising",  "type": AccountType.EXPENSE, "parent": "6500",
     "desc": "Sales promotion and marketing costs"},
    {"code": "6560", "name": "Bank Charges",             "type": AccountType.EXPENSE, "parent": "6500",
     "desc": "Bank fees, transaction charges"},
    {"code": "6570", "name": "Subscriptions & Licences", "type": AccountType.EXPENSE, "parent": "6500",
     "desc": "Software, trade licences, and regulatory fees"},

    # Depreciation
    {"code": "6600", "name": "Depreciation Expense",     "type": AccountType.EXPENSE, "parent": "6000",
     "desc": "Periodic depreciation of fixed assets"},
    {"code": "6610", "name": "Depreciation — Buildings",  "type": AccountType.EXPENSE, "parent": "6600",
     "desc": "Depreciation on poultry houses and structures"},
    {"code": "6620", "name": "Depreciation — Equipment",  "type": AccountType.EXPENSE, "parent": "6600",
     "desc": "Depreciation on farm and processing equipment"},
    {"code": "6630", "name": "Depreciation — Vehicles",   "type": AccountType.EXPENSE, "parent": "6600",
     "desc": "Depreciation on motor vehicles"},

    # Other Expenses
    {"code": "6700", "name": "Finance Costs",            "type": AccountType.EXPENSE, "parent": "6000",
     "desc": "Loan interest and financing charges"},
    {"code": "6710", "name": "Loan Interest Expense",    "type": AccountType.EXPENSE, "parent": "6700",
     "desc": "Interest paid on bank loans"},
    {"code": "6800", "name": "Other Expenses",           "type": AccountType.EXPENSE, "parent": "6000",
     "desc": "Miscellaneous and extraordinary expenses"},
]


# ---------------------------------------------------------------------------
# Template definition
# ---------------------------------------------------------------------------

POULTRY_ENTERPRISE_TEMPLATE_NAME = "Poultry Enterprise"


def _get_normal_balance(account_type: AccountType) -> NormalBalance:
    return _TYPE_NORMAL_BALANCE.get(account_type, NormalBalance.DEBIT)


def seed_chart_of_accounts(db: Session, tenant_id: int | None = None) -> None:
    """
    Seed enterprise poultry COA for a specific tenant (or the system scope if
    tenant_id is None).

    Safe to call multiple times — skips existing account codes for that tenant.
    """
    existing_codes = {
        code
        for (code,) in db.query(Account.account_code)
        .filter(Account.tenant_id == tenant_id)
        .all()
    }

    # Build parent map for second-pass FK linkage
    account_map: dict[str, Account] = {}

    for entry in ENTERPRISE_POULTRY_COA:
        code = entry["code"]
        if code in existing_codes:
            # Still need in map for parent resolution
            existing = (
                db.query(Account)
                .filter(Account.account_code == code, Account.tenant_id == tenant_id)
                .first()
            )
            if existing:
                account_map[code] = existing
            continue

        account = Account(
            tenant_id=tenant_id,
            account_code=code,
            name=entry["name"],
            account_type=entry["type"],
            normal_balance=_get_normal_balance(entry["type"]),
            description=entry.get("desc"),
            allow_manual_entries=entry.get("manual", True),
            is_system=True,
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(account)
        db.flush()
        account_map[code] = account

    # Second pass: set parent_account_id
    for entry in ENTERPRISE_POULTRY_COA:
        code = entry["code"]
        parent_code = entry.get("parent")
        if parent_code and code in account_map and parent_code in account_map:
            account_map[code].parent_account_id = account_map[parent_code].id

    db.commit()
    count = len([e for e in ENTERPRISE_POULTRY_COA if e["code"] not in existing_codes])
    print(f"[COA] Seeded {count} enterprise poultry accounts (tenant_id={tenant_id}).")


def seed_coa_template(db: Session) -> AccountTemplate:
    """
    Create the default 'Poultry Enterprise' COA template in the database.
    Safe to call multiple times — skips if already exists.
    """
    existing = db.query(AccountTemplate).filter(
        AccountTemplate.name == POULTRY_ENTERPRISE_TEMPLATE_NAME
    ).first()
    if existing:
        return existing

    template = AccountTemplate(
        name=POULTRY_ENTERPRISE_TEMPLATE_NAME,
        industry="poultry",
        description="Full enterprise chart of accounts for commercial poultry farms (broilers, layers, hatchery).",
        is_default=True,
        is_active=True,
    )
    db.add(template)
    db.flush()

    for entry in ENTERPRISE_POULTRY_COA:
        ta = TemplateAccount(
            template_id=template.id,
            account_code=entry["code"],
            name=entry["name"],
            parent_code=entry.get("parent"),
            account_type=entry["type"],
            normal_balance=_get_normal_balance(entry["type"]),
            description=entry.get("desc"),
            allow_manual_entries=entry.get("manual", True),
            is_system=True,
        )
        db.add(ta)

    db.commit()
    print(f"[COA Template] Created template '{POULTRY_ENTERPRISE_TEMPLATE_NAME}' with {len(ENTERPRISE_POULTRY_COA)} accounts.")
    return template


def apply_template_to_tenant(db: Session, tenant_id: int, template_name: str = POULTRY_ENTERPRISE_TEMPLATE_NAME) -> int:
    """
    Copy a COA template's accounts into a tenant's live chart of accounts.
    Skips codes that already exist for the tenant.
    Returns the count of accounts created.
    """
    template = db.query(AccountTemplate).filter(AccountTemplate.name == template_name).first()
    if not template:
        raise ValueError(f"Template '{template_name}' not found. Run seed_coa_template first.")

    existing_codes = {
        code
        for (code,) in db.query(Account.account_code)
        .filter(Account.tenant_id == tenant_id)
        .all()
    }

    # Sort entries so parents are created before children (by code length/order)
    entries = sorted(template.accounts, key=lambda t: t.account_code)
    account_map: dict[str, Account] = {}

    # Load already-existing accounts into map
    for ta in entries:
        if ta.account_code in existing_codes:
            existing = (
                db.query(Account)
                .filter(Account.account_code == ta.account_code, Account.tenant_id == tenant_id)
                .first()
            )
            if existing:
                account_map[ta.account_code] = existing

    created = 0
    for ta in entries:
        if ta.account_code in existing_codes:
            continue
        account = Account(
            tenant_id=tenant_id,
            account_code=ta.account_code,
            name=ta.name,
            account_type=ta.account_type,
            normal_balance=ta.normal_balance,
            description=ta.description,
            allow_manual_entries=ta.allow_manual_entries,
            is_system=ta.is_system,
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        db.add(account)
        db.flush()
        account_map[ta.account_code] = account
        created += 1

    # Set parent relationships
    for ta in entries:
        if ta.parent_code and ta.account_code in account_map and ta.parent_code in account_map:
            account_map[ta.account_code].parent_account_id = account_map[ta.parent_code].id

    # Create default SystemAccountMappings
    default_mappings = {
        # Cash & receivables
        "cash": "1111",
        "bank": "1112",
        "mobile_money": "1113",
        "ar": "1120",
        "ap": "2110",
        # Inventory
        "feed_inventory": "1131",
        "medicine_inventory": "1132",
        "live_bird_inventory": "1133",
        "finished_goods": "1134",
        "egg_inventory": "1138",
        "byproduct_inventory": "1139",
        "goods_in_transit": "1145",
        # Costs of sales
        "feed_cost": "5110",
        "layer_feed_cost": "5120",
        "vaccine_cost": "5210",
        "medicine_cost": "5220",
        "doc_cost": "5300",
        "mortality_loss": "5400",
        "slaughter_processing_cost": "5500",
        "slaughter_labour": "5600",
        "slaughter_overhead": "5500",
        # Revenue
        "sales_revenue": "4110",
        "egg_sales": "4130",
        "doc_sales": "4140",
        "byproduct_sales": "4170",
        "live_bird_sales": "4120",
        # Summary accounts
        "cogs": "5000",
        "slaughter_gain": "4200",
        "slaughter_loss": "5400",
        # Liabilities
        "vat_output": "2130",
        "vat_input": "1150",
        "paye_payable": "2140",
        "nssf_payable": "2170",
        "nhif_payable": "2180",
        "accrued_salaries": "2190",
        # Expenses
        "salary_expense": "6110",
        "nssf_employer": "6140",
        "nhif_employer": "6150",
        "depreciation_exp": "6600",
        # Equity
        "retained_earnings": "3200",
        "current_year_pl": "3300",
    }
    
    existing_mappings = {
        m.operation_key
        for m in db.query(SystemAccountMapping).filter(SystemAccountMapping.tenant_id == tenant_id).all()
    }
    
    for op_key, acc_code in default_mappings.items():
        if op_key not in existing_mappings and acc_code in account_map:
            mapping = SystemAccountMapping(
                tenant_id=tenant_id,
                operation_key=op_key,
                account_id=account_map[acc_code].id
            )
            db.add(mapping)

    db.commit()
    print(f"[COA] Applied template '{template_name}' to tenant {tenant_id}: {created} accounts created.")
    return created


def create_default_fiscal_year(db: Session, tenant_id: int) -> FiscalYear:
    """
    Create the current fiscal year for a tenant if one doesn't exist.
    Defaults to calendar year (Jan 1 → Dec 31 of current year).
    """
    from datetime import date
    today = date.today()
    existing = (
        db.query(FiscalYear)
        .filter(FiscalYear.tenant_id == tenant_id, FiscalYear.status == FiscalYearStatus.OPEN)
        .first()
    )
    if existing:
        return existing

    fiscal_year = FiscalYear(
        tenant_id=tenant_id,
        name=f"FY {today.year}",
        start_date=date(today.year, 1, 1),
        end_date=date(today.year, 12, 31),
        status=FiscalYearStatus.OPEN,
    )
    db.add(fiscal_year)
    db.commit()
    db.refresh(fiscal_year)
    print(f"[FiscalYear] Created '{fiscal_year.name}' for tenant {tenant_id}.")
    return fiscal_year


def get_account_by_code(db: Session, code: str, tenant_id: int | None = None) -> Account | None:
    """
    Get an account by its code. Prefers tenant-scoped accounts; falls back to
    system-scope (tenant_id=None) if not found.
    """
    if tenant_id is not None:
        account = (
            db.query(Account)
            .filter(Account.account_code == code, Account.tenant_id == tenant_id)
            .first()
        )
        if account:
            return account
    # Fallback: system-scoped account
    return db.query(Account).filter(Account.account_code == code, Account.tenant_id.is_(None)).first()
