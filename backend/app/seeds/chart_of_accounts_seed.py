"""
Seed data for standard Chart of Accounts

This module provides seed data for a standard chart of accounts suitable for
a poultry farm and processing business. The accounts follow standard accounting
principles with asset, liability, equity, revenue, and expense categories.
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.finance_coa import Account, AccountType


# Standard chart of accounts for poultry farm business
STANDARD_CHART_OF_ACCOUNTS = [
    # Assets
    {"code": "1000", "name": "ASSETS", "type": AccountType.ASSET, "parent": None, "description": "Total Assets"},
    {"code": "1100", "name": "Current Assets", "type": AccountType.ASSET, "parent": "1000", "description": "Assets that can be converted to cash within one year"},
    {"code": "1110", "name": "Cash and Cash Equivalents", "type": AccountType.ASSET, "parent": "1100", "description": "Cash on hand and in bank accounts"},
    {"code": "1111", "name": "Cash on Hand", "type": AccountType.ASSET, "parent": "1110", "description": "Physical cash"},
    {"code": "1112", "name": "Bank Accounts", "type": AccountType.ASSET, "parent": "1110", "description": "Money in bank accounts"},
    {"code": "1120", "name": "Accounts Receivable", "type": AccountType.ASSET, "parent": "1100", "description": "Money owed by customers"},
    {"code": "1130", "name": "Inventory", "type": AccountType.ASSET, "parent": "1100", "description": "Stock of goods for sale"},
    {"code": "1131", "name": "Feed Inventory", "type": AccountType.ASSET, "parent": "1130", "description": "Stock of animal feed"},
    {"code": "1132", "name": "Medicine Inventory", "type": AccountType.ASSET, "parent": "1130", "description": "Stock of medicines and vaccines"},
    {"code": "1133", "name": "Live Birds Inventory", "type": AccountType.ASSET, "parent": "1130", "description": "Live poultry stock"},
    {"code": "1134", "name": "Finished Goods Inventory", "type": AccountType.ASSET, "parent": "1130", "description": "Processed poultry products"},
    {"code": "1140", "name": "Prepaid Expenses", "type": AccountType.ASSET, "parent": "1100", "description": "Payments made in advance"},
    {"code": "1200", "name": "Fixed Assets", "type": AccountType.ASSET, "parent": "1000", "description": "Long-term tangible assets"},
    {"code": "1210", "name": "Land and Buildings", "type": AccountType.ASSET, "parent": "1200", "description": "Land and farm buildings"},
    {"code": "1220", "name": "Equipment", "type": AccountType.ASSET, "parent": "1200", "description": "Farm and processing equipment"},
    {"code": "1230", "name": "Vehicles", "type": AccountType.ASSET, "parent": "1200", "description": "Company vehicles"},
    {"code": "1240", "name": "Accumulated Depreciation", "type": AccountType.ASSET, "parent": "1200", "description": "Cumulative depreciation of fixed assets"},
    
    # Liabilities
    {"code": "2000", "name": "LIABILITIES", "type": AccountType.LIABILITY, "parent": None, "description": "Total Liabilities"},
    {"code": "2100", "name": "Current Liabilities", "type": AccountType.LIABILITY, "parent": "2000", "description": "Debts due within one year"},
    {"code": "2110", "name": "Accounts Payable", "type": AccountType.LIABILITY, "parent": "2100", "description": "Money owed to suppliers"},
    {"code": "2120", "name": "Accrued Expenses", "type": AccountType.LIABILITY, "parent": "2100", "description": "Expenses incurred but not yet paid"},
    {"code": "2130", "name": "Tax Payable", "type": AccountType.LIABILITY, "parent": "2100", "description": "Taxes owed to government"},
    {"code": "2140", "name": "Short-term Loans", "type": AccountType.LIABILITY, "parent": "2100", "description": "Loans due within one year"},
    {"code": "2200", "name": "Long-term Liabilities", "type": AccountType.LIABILITY, "parent": "2000", "description": "Debts due after one year"},
    {"code": "2210", "name": "Long-term Loans", "type": AccountType.LIABILITY, "parent": "2200", "description": "Loans due after one year"},
    
    # Equity
    {"code": "3000", "name": "EQUITY", "type": AccountType.EQUITY, "parent": None, "description": "Owner's Equity"},
    {"code": "3100", "name": "Owner's Capital", "type": AccountType.EQUITY, "parent": "3000", "description": "Owner's investment in the business"},
    {"code": "3200", "name": "Retained Earnings", "type": AccountType.EQUITY, "parent": "3000", "description": "Accumulated profits"},
    {"code": "3300", "name": "Current Year Earnings", "type": AccountType.EQUITY, "parent": "3000", "description": "Profits for the current year"},
    
    # Revenue
    {"code": "4000", "name": "REVENUE", "type": AccountType.REVENUE, "parent": None, "description": "Total Revenue"},
    {"code": "4100", "name": "Sales Revenue", "type": AccountType.REVENUE, "parent": "4000", "description": "Revenue from sales"},
    {"code": "4110", "name": "Dressed Chicken Sales", "type": AccountType.REVENUE, "parent": "4100", "description": "Sales of dressed chicken"},
    {"code": "4120", "name": "Live Bird Sales", "type": AccountType.REVENUE, "parent": "4100", "description": "Sales of live birds"},
    {"code": "4130", "name": "Byproduct Sales", "type": AccountType.REVENUE, "parent": "4100", "description": "Sales of slaughter byproducts"},
    {"code": "4200", "name": "Other Revenue", "type": AccountType.REVENUE, "parent": "4000", "description": "Miscellaneous revenue"},
    
    # Expenses
    {"code": "5000", "name": "EXPENSES", "type": AccountType.EXPENSE, "parent": None, "description": "Total Expenses"},
    {"code": "5100", "name": "Cost of Goods Sold", "type": AccountType.EXPENSE, "parent": "5000", "description": "Direct costs of producing goods"},
    {"code": "5110", "name": "Feed Cost", "type": AccountType.EXPENSE, "parent": "5100", "description": "Cost of animal feed"},
    {"code": "5120", "name": "Medicine Cost", "type": AccountType.EXPENSE, "parent": "5100", "description": "Cost of medicines and vaccines"},
    {"code": "5130", "name": "Day-old Chick Cost", "type": AccountType.EXPENSE, "parent": "5100", "description": "Cost of day-old chicks"},
    {"code": "5200", "name": "Operating Expenses", "type": AccountType.EXPENSE, "parent": "5000", "description": "Day-to-day operating costs"},
    {"code": "5210", "name": "Salaries and Wages", "type": AccountType.EXPENSE, "parent": "5200", "description": "Employee compensation"},
    {"code": "5220", "name": "Utilities", "type": AccountType.EXPENSE, "parent": "5200", "description": "Electricity, water, etc."},
    {"code": "5230", "name": "Rent", "type": AccountType.EXPENSE, "parent": "5200", "description": "Rent expenses"},
    {"code": "5240", "name": "Maintenance and Repairs", "type": AccountType.EXPENSE, "parent": "5200", "description": "Equipment and facility maintenance"},
    {"code": "5250", "name": "Transportation", "type": AccountType.EXPENSE, "parent": "5200", "description": "Transport costs"},
    {"code": "5300", "name": "Administrative Expenses", "type": AccountType.EXPENSE, "parent": "5000", "description": "General administrative costs"},
    {"code": "5310", "name": "Office Supplies", "type": AccountType.EXPENSE, "parent": "5300", "description": "Office supplies and materials"},
    {"code": "5320", "name": "Professional Fees", "type": AccountType.EXPENSE, "parent": "5300", "description": "Legal, accounting, consulting fees"},
    {"code": "5400", "name": "Depreciation Expense", "type": AccountType.EXPENSE, "parent": "5000", "description": "Depreciation of fixed assets"},
]


def seed_chart_of_accounts(db: Session) -> None:
    """
    Seed the chart of accounts with standard accounts.
    
    This function creates the standard chart of accounts for a poultry farm business.
    It first checks if accounts already exist to avoid duplicates.
    
    Args:
        db: SQLAlchemy database session
    """
    # Check if chart of accounts already has data
    existing_count = db.query(Account).count()
    if existing_count > 0:
        print(f"Chart of accounts already has {existing_count} records. Skipping seed.")
        return
    
    # Create a mapping of account codes to account objects for parent lookup
    account_map = {}
    
    # First pass: create all accounts without parent relationships
    for account_data in STANDARD_CHART_OF_ACCOUNTS:
        parent_code = account_data.pop("parent", None)
        account = Account(
            account_code=account_data["code"],
            name=account_data["name"],
            account_type=account_data["type"],
            parent_account_id=None,
            is_active=True,
            created_at=datetime.now(timezone.utc)
        )
        db.add(account)
        db.flush()
        account_map[account.account_code] = account
    
    # Second pass: set parent relationships
    for account_data in STANDARD_CHART_OF_ACCOUNTS:
        parent_code = account_data.get("parent")
        if parent_code and parent_code in account_map:
            account = account_map[account_data["code"]]
            account.parent_account_id = account_map[parent_code].id
    
    db.commit()
    print(f"Seeded {len(STANDARD_CHART_OF_ACCOUNTS)} chart of account records.")


def get_account_by_code(db: Session, code: str) -> Account | None:
    """
    Get an account by its code.
    
    Args:
        db: SQLAlchemy database session
        code: Account code to look up
        
    Returns:
        Account object or None if not found
    """
    return db.query(Account).filter(Account.account_code == code).first()
