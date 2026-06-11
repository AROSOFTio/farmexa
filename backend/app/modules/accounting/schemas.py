"""
Enterprise Accounting API Schemas

Pydantic models for:
- Chart of Accounts (Account)
- Journal Entries and Lines
- Account Templates
- Fiscal Years
- Opening Balances
- Reporting outputs (Trial Balance, P&L, Balance Sheet, Ledger, Cashbook)
"""

from datetime import date, datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field

from app.models.finance_coa import AccountType, FiscalYearStatus, JournalEntryStatus, NormalBalance
from app.schemas.money import Money, NonNegativeMoney


# ---------------------------------------------------------------------------
# Account Schemas
# ---------------------------------------------------------------------------

class AccountBase(BaseModel):
    account_code: str = Field(min_length=1, max_length=50, description="Unique account code within this tenant")
    name: str = Field(min_length=1, max_length=150)
    account_type: AccountType
    normal_balance: Optional[NormalBalance] = None  # auto-derived if not provided
    parent_account_id: Optional[int] = None
    description: Optional[str] = None
    is_active: bool = True
    allow_manual_entries: bool = True


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    account_type: Optional[AccountType] = None
    normal_balance: Optional[NormalBalance] = None
    parent_account_id: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    allow_manual_entries: Optional[bool] = None


class AccountOut(AccountBase):
    id: int
    tenant_id: Optional[int] = None
    is_system: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class AccountTreeOut(AccountOut):
    """Account with sub-accounts for tree rendering."""
    sub_accounts: List["AccountTreeOut"] = []

    class Config:
        from_attributes = True


AccountTreeOut.model_rebuild()


# ---------------------------------------------------------------------------
# Journal Line Schemas
# ---------------------------------------------------------------------------

class JournalLineBase(BaseModel):
    account_id: int
    memo: Optional[str] = Field(default=None, max_length=255)
    debit: NonNegativeMoney = Field(default=0)
    credit: NonNegativeMoney = Field(default=0)
    branch_id: Optional[int] = None
    batch_id: Optional[int] = None


class JournalLineCreate(JournalLineBase):
    pass


class JournalLineOut(JournalLineBase):
    id: int
    journal_entry_id: int
    account_code: Optional[str] = None
    account_name: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Journal Entry Schemas
# ---------------------------------------------------------------------------

class JournalEntryBase(BaseModel):
    entry_date: date
    source_module: Optional[str] = None
    source_reference: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[int] = None


class JournalEntryCreate(JournalEntryBase):
    lines: List[JournalLineCreate] = Field(min_length=2, description="Must have at least 2 lines (debit + credit)")


class JournalEntryUpdate(BaseModel):
    entry_date: Optional[date] = None
    description: Optional[str] = None
    notes: Optional[str] = None


class JournalEntryOut(JournalEntryBase):
    id: int
    entry_number: str
    tenant_id: Optional[int] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    status: JournalEntryStatus
    created_by_user_id: Optional[int] = None
    posted_at: Optional[datetime] = None
    posted_by_user_id: Optional[int] = None
    created_at: datetime
    lines: List[JournalLineOut] = []

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Account Template Schemas
# ---------------------------------------------------------------------------

class TemplateAccountOut(BaseModel):
    account_code: str
    name: str
    parent_code: Optional[str] = None
    account_type: AccountType
    normal_balance: NormalBalance
    description: Optional[str] = None

    class Config:
        from_attributes = True


class AccountTemplateOut(BaseModel):
    id: int
    name: str
    industry: Optional[str] = None
    description: Optional[str] = None
    is_default: bool
    is_active: bool
    account_count: int = 0

    class Config:
        from_attributes = True


class ApplyTemplateRequest(BaseModel):
    template_name: str = Field(description="Name of the COA template to apply")


# ---------------------------------------------------------------------------
# Fiscal Year Schemas
# ---------------------------------------------------------------------------

class FiscalYearCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, description="e.g., 'FY 2025-2026'")
    start_date: date
    end_date: date


class FiscalYearUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[FiscalYearStatus] = None


class FiscalYearOut(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    name: str
    start_date: date
    end_date: date
    status: FiscalYearStatus
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Opening Balance Schemas
# ---------------------------------------------------------------------------

class OpeningBalanceEntry(BaseModel):
    account_id: int
    opening_debit: NonNegativeMoney = Field(default=0)
    opening_credit: NonNegativeMoney = Field(default=0)
    opening_date: Optional[date] = None
    notes: Optional[str] = None


class OpeningBalanceBatchCreate(BaseModel):
    fiscal_year_id: Optional[int] = None
    entries: List[OpeningBalanceEntry] = Field(min_length=1)


class OpeningBalanceOut(BaseModel):
    id: int
    account_id: int
    account_code: Optional[str] = None
    account_name: Optional[str] = None
    fiscal_year_id: Optional[int] = None
    opening_debit: Money
    opening_credit: Money
    opening_date: Optional[date] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Reporting Schemas (read-only outputs)
# ---------------------------------------------------------------------------

class TrialBalanceRow(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    total_debit: float
    total_credit: float


class TrialBalanceOut(BaseModel):
    as_of_date: Optional[str] = None
    rows: List[TrialBalanceRow]
    total_debit: float
    total_credit: float
    is_balanced: bool


class ReportRow(BaseModel):
    account_code: str
    account_name: str
    amount: float


class ProfitLossOut(BaseModel):
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    revenue: List[ReportRow]
    total_revenue: float
    cost_of_sales: List[ReportRow]
    total_cost_of_sales: float
    gross_profit: float
    expenses: List[ReportRow]
    total_expenses: float
    net_profit: float


class BalanceSheetRow(BaseModel):
    account_code: str
    account_name: str
    balance: float


class BalanceSheetOut(BaseModel):
    as_of_date: Optional[str] = None
    assets: List[BalanceSheetRow]
    total_assets: float
    liabilities: List[BalanceSheetRow]
    total_liabilities: float
    equity: List[BalanceSheetRow]
    total_equity: float
    total_liabilities_and_equity: float
    is_balanced: bool


class LedgerEntry(BaseModel):
    date: str
    entry_number: str
    description: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    debit: float
    credit: float
    balance: float


class GeneralLedgerOut(BaseModel):
    account: dict
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    opening_balance: float
    closing_balance: float
    entries: List[LedgerEntry]
