from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

from app.schemas.money import PositiveMoney

class ExpenseCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    default_account_code: Optional[str] = None

class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass

class ExpenseCategoryOut(ExpenseCategoryBase):
    id: int

    class Config:
        from_attributes = True

class ExpenseBase(BaseModel):
    category_id: int
    amount: PositiveMoney
    expense_date: date
    description: Optional[str] = None
    reference: Optional[str] = None
    batch_id: Optional[int] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseOut(ExpenseBase):
    id: int
    created_at: datetime
    category: ExpenseCategoryOut

    class Config:
        from_attributes = True

class IncomeCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    default_account_code: Optional[str] = None

class IncomeCategoryCreate(IncomeCategoryBase):
    pass

class IncomeCategoryOut(IncomeCategoryBase):
    id: int

    class Config:
        from_attributes = True

class IncomeBase(BaseModel):
    category_id: int
    amount: PositiveMoney
    income_date: date
    description: Optional[str] = None
    reference: Optional[str] = None

class IncomeCreate(IncomeBase):
    pass

class IncomeOut(IncomeBase):
    id: int
    created_at: datetime
    category: IncomeCategoryOut

    class Config:
        from_attributes = True

# ---------------------------------------------------------
# Financial Reporting Schemas
# ---------------------------------------------------------

class AccountInfo(BaseModel):
    id: int
    code: str
    name: str
    type: str
    normal_balance: str

class LedgerEntry(BaseModel):
    date: date
    entry_number: str
    description: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    debit: float
    credit: float
    balance: float

class LedgerReport(BaseModel):
    account: AccountInfo
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    opening_balance: float
    closing_balance: float
    entries: List[LedgerEntry]

class TrialBalanceRow(BaseModel):
    account_code: str
    account_name: str
    account_type: str
    total_debit: float
    total_credit: float

class TrialBalanceReport(BaseModel):
    as_of_date: Optional[date] = None
    rows: List[TrialBalanceRow]
    total_debit: float
    total_credit: float
    is_balanced: bool

class ProfitLossRow(BaseModel):
    account_code: str
    account_name: str
    amount: float

class ProfitLossReport(BaseModel):
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    revenue: List[ProfitLossRow]
    total_revenue: float
    cost_of_sales: List[ProfitLossRow]
    total_cost_of_sales: float
    gross_profit: float
    expenses: List[ProfitLossRow]
    total_expenses: float
    net_profit: float

class BalanceSheetRow(BaseModel):
    account_code: str
    account_name: str
    balance: float

class BalanceSheetReport(BaseModel):
    as_of_date: Optional[date] = None
    assets: List[BalanceSheetRow]
    total_assets: float
    liabilities: List[BalanceSheetRow]
    total_liabilities: float
    equity: List[BalanceSheetRow]
    total_equity: float
    total_liabilities_and_equity: float
    is_balanced: bool

class CashFlowRow(BaseModel):
    category: str
    amount: float

class CashFlowReport(BaseModel):
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    operating: List[CashFlowRow]
    total_operating: float
    investing: List[CashFlowRow]
    total_investing: float
    financing: List[CashFlowRow]
    total_financing: float
    net_cash_flow: float
