from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.modules.finance import schemas, service
from app.services.accounting_service import AccountingService

router = APIRouter(prefix="/finance", tags=["Finance"])


@router.get("/expenses/categories", response_model=List[schemas.ExpenseCategoryOut])
def list_expense_categories(
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    return service.finance_service.get_expense_categories(db)


@router.post("/expenses/categories", response_model=schemas.ExpenseCategoryOut)
def create_expense_category(
    category: schemas.ExpenseCategoryCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:write")),
):
    return service.finance_service.create_expense_category(db, category)


@router.get("/expenses", response_model=List[schemas.ExpenseOut])
def list_expenses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    return service.finance_service.get_expenses(db, skip, limit)


@router.post("/expenses", response_model=schemas.ExpenseOut)
def create_expense(
    expense: schemas.ExpenseCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:write")),
):
    return service.finance_service.create_expense(db, expense)


@router.get("/incomes/categories", response_model=List[schemas.IncomeCategoryOut])
def list_income_categories(
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    return service.finance_service.get_income_categories(db)


@router.post("/incomes/categories", response_model=schemas.IncomeCategoryOut)
def create_income_category(
    category: schemas.IncomeCategoryCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:write")),
):
    return service.finance_service.create_income_category(db, category)


@router.get("/incomes", response_model=List[schemas.IncomeOut])
def list_incomes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    return service.finance_service.get_incomes(db, skip, limit)


@router.post("/incomes", response_model=schemas.IncomeOut)
def create_income(
    income: schemas.IncomeCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:write")),
):
    return service.finance_service.create_income(db, income)

# ---------------------------------------------------------
# Financial Reports
# ---------------------------------------------------------

@router.get("/reports/cash-accounts", response_model=List[schemas.AccountInfo])
def get_cash_accounts(
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    acct_service = AccountingService(db, tenant_id=current_user.tenant_id)
    accounts = acct_service.get_cash_accounts()
    return [{"id": a.id, "code": a.account_code, "name": a.name, "type": a.account_type.value, "normal_balance": a.normal_balance.value} for a in accounts]

@router.get("/reports/cashbook", response_model=schemas.LedgerReport)
def get_cashbook(
    account_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    acct_service = AccountingService(db, tenant_id=current_user.tenant_id)
    return acct_service.get_cashbook(account_id, from_date, to_date, branch_id)

@router.get("/reports/general-ledger", response_model=schemas.LedgerReport)
def get_general_ledger(
    account_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    acct_service = AccountingService(db, tenant_id=current_user.tenant_id)
    return acct_service.get_ledger(account_id, from_date, to_date, branch_id)

@router.get("/reports/trial-balance", response_model=schemas.TrialBalanceReport)
def get_trial_balance(
    as_of_date: Optional[date] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    acct_service = AccountingService(db, tenant_id=current_user.tenant_id)
    return acct_service.get_trial_balance(as_of_date, branch_id)

@router.get("/reports/profit-and-loss", response_model=schemas.ProfitLossReport)
def get_profit_and_loss(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    acct_service = AccountingService(db, tenant_id=current_user.tenant_id)
    return acct_service.get_profit_and_loss(from_date, to_date, branch_id)

@router.get("/reports/balance-sheet", response_model=schemas.BalanceSheetReport)
def get_balance_sheet(
    as_of_date: Optional[date] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    acct_service = AccountingService(db, tenant_id=current_user.tenant_id)
    return acct_service.get_balance_sheet(as_of_date, branch_id)

@router.get("/reports/cash-flow", response_model=schemas.CashFlowReport)
def get_cash_flow(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    branch_id: Optional[int] = None,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("finance:read")),
):
    acct_service = AccountingService(db, tenant_id=current_user.tenant_id)
    return acct_service.get_cash_flow(from_date, to_date, branch_id)
