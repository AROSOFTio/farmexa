"""
Enterprise Accounting API Router

Endpoints:
- Chart of Accounts (CRUD + tree)
- Journal Entries (create, list, post)
- General Ledger
- Trial Balance
- Profit & Loss
- Balance Sheet
- Cashbook
- Fiscal Years
- Opening Balances
- Account Templates
- Tenant Accounting Initialization
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.models.user import User
from app.modules.accounting import schemas, service

router = APIRouter(prefix="/accounting", tags=["Accounting"])


def _svc(
    db: Session = Depends(get_tenant_sync_db),
    current_user: User = Depends(get_current_user),
):
    """Resolve the accounting service with the current user's tenant."""
    tenant_id = getattr(current_user, "tenant_id", None)
    return service.accounting_service(db, tenant_id=tenant_id)


# ---------------------------------------------------------------------------
# Chart of Accounts
# ---------------------------------------------------------------------------

@router.get("/chart-of-accounts", response_model=List[schemas.AccountOut], summary="List accounts")
def list_accounts(
    skip: int = Query(0, ge=0),
    limit: int = Query(500, le=1000),
    include_inactive: bool = Query(False),
    account_type: Optional[str] = Query(None, description="Filter by account type"),
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_chart_of_accounts(skip=skip, limit=limit, include_inactive=include_inactive, account_type=account_type)


@router.get("/chart-of-accounts/{account_id}", response_model=schemas.AccountOut, summary="Get account")
def get_account(
    account_id: int,
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_chart_of_account(account_id)


@router.post("/chart-of-accounts", response_model=schemas.AccountOut, status_code=201, summary="Create account")
def create_account(
    data: schemas.AccountCreate,
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:write")),
):
    return svc.create_account(data)


@router.patch("/chart-of-accounts/{account_id}", response_model=schemas.AccountOut, summary="Update account")
def update_account(
    account_id: int,
    data: schemas.AccountUpdate,
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:write")),
):
    return svc.update_account(account_id, data)


@router.delete("/chart-of-accounts/{account_id}", status_code=204, summary="Delete custom account")
def delete_account(
    account_id: int,
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:write")),
):
    svc.delete_account(account_id)


# ---------------------------------------------------------------------------
# Journal Entries
# ---------------------------------------------------------------------------

@router.get("/journal-entries", response_model=List[schemas.JournalEntryOut], summary="List journal entries")
def list_journal_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    status: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_journal_entries(skip=skip, limit=limit, status_filter=status, from_date=from_date, to_date=to_date)


@router.get("/journal-entries/{entry_id}", response_model=schemas.JournalEntryOut, summary="Get journal entry")
def get_journal_entry(
    entry_id: int,
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_journal_entry(entry_id)


@router.post("/journal-entries", response_model=schemas.JournalEntryOut, status_code=201, summary="Create journal entry")
def create_journal_entry(
    data: schemas.JournalEntryCreate,
    svc=Depends(_svc),
    current_user: User = Depends(get_current_user),
    _=Depends(require_permission("accounting:write")),
):
    return svc.create_journal_entry(data, created_by_user_id=current_user.id)


@router.post(
    "/journal-entries/{entry_id}/post",
    response_model=schemas.JournalEntryOut,
    summary="Post a draft journal entry",
)
def post_journal_entry(
    entry_id: int,
    svc=Depends(_svc),
    current_user: User = Depends(get_current_user),
    _=Depends(require_permission("accounting:write")),
):
    return svc.post_journal_entry(entry_id, posted_by_user_id=current_user.id)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

@router.get("/ledger", response_model=schemas.GeneralLedgerOut, summary="General ledger for one account")
def get_ledger(
    account_id: int = Query(..., description="Account ID to view ledger for"),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_ledger(account_id, from_date=from_date, to_date=to_date)


@router.get("/cashbook", response_model=schemas.GeneralLedgerOut, summary="Cashbook view for a cash/bank account")
def get_cashbook(
    account_id: int = Query(..., description="Cash or bank account ID"),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_cashbook(account_id, from_date=from_date, to_date=to_date)


@router.get("/trial-balance", response_model=schemas.TrialBalanceOut, summary="Trial balance")
def get_trial_balance(
    as_of_date: Optional[date] = Query(None, description="Date to compute balances up to"),
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_trial_balance(as_of_date=as_of_date)


@router.get("/profit-loss", response_model=schemas.ProfitLossOut, summary="Profit & Loss statement")
def get_profit_loss(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_profit_and_loss(from_date=from_date, to_date=to_date)


@router.get("/balance-sheet", response_model=schemas.BalanceSheetOut, summary="Balance sheet")
def get_balance_sheet(
    as_of_date: Optional[date] = Query(None),
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_balance_sheet(as_of_date=as_of_date)


# ---------------------------------------------------------------------------
# Fiscal Years
# ---------------------------------------------------------------------------

@router.get("/fiscal-years", response_model=List[schemas.FiscalYearOut], summary="List fiscal years")
def list_fiscal_years(
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_fiscal_years()


@router.post("/fiscal-years", response_model=schemas.FiscalYearOut, status_code=201, summary="Create fiscal year")
def create_fiscal_year(
    data: schemas.FiscalYearCreate,
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:write")),
):
    return svc.create_fiscal_year(data)


@router.patch("/fiscal-years/{fy_id}", response_model=schemas.FiscalYearOut, summary="Update fiscal year")
def update_fiscal_year(
    fy_id: int,
    data: schemas.FiscalYearUpdate,
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:write")),
):
    return svc.update_fiscal_year(fy_id, data)


# ---------------------------------------------------------------------------
# Opening Balances
# ---------------------------------------------------------------------------

@router.get("/opening-balances", response_model=List[schemas.OpeningBalanceOut], summary="List opening balances")
def list_opening_balances(
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_opening_balances()


@router.post(
    "/opening-balances",
    response_model=List[schemas.OpeningBalanceOut],
    status_code=201,
    summary="Set opening balances (upsert)",
)
def set_opening_balances(
    data: schemas.OpeningBalanceBatchCreate,
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:write")),
):
    return svc.set_opening_balances(data)


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

@router.get("/templates", response_model=List[schemas.AccountTemplateOut], summary="List COA templates")
def list_templates(
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:read")),
):
    return svc.get_templates()


@router.post(
    "/templates/apply",
    summary="Apply a COA template to this tenant",
)
def apply_template(
    data: schemas.ApplyTemplateRequest,
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:write")),
):
    return svc.apply_template(data.template_name)


@router.post(
    "/initialize",
    summary="Initialize accounting for this tenant (auto-apply default COA + fiscal year)",
)
def initialize_tenant_accounting(
    svc=Depends(_svc),
    _=Depends(require_permission("accounting:write")),
):
    return svc.initialize_tenant()
