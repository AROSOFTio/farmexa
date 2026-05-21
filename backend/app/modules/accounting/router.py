from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.modules.accounting import schemas, service

router = APIRouter(prefix="/accounting", tags=["Accounting"])


@router.get("/chart-of-accounts", response_model=List[schemas.AccountOut])
def list_chart_of_accounts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("accounting:read")),
):
    return service.accounting_service(db).get_chart_of_accounts(skip, limit)


@router.get("/chart-of-accounts/{account_id}", response_model=schemas.AccountOut)
def get_chart_of_account(
    account_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("accounting:read")),
):
    return service.accounting_service(db).get_chart_of_account(account_id)


@router.post("/chart-of-accounts", response_model=schemas.AccountOut)
def create_chart_of_account(
    account: schemas.AccountCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("accounting:write")),
):
    return service.accounting_service(db).create_chart_of_account(account)


@router.patch("/chart-of-accounts/{account_id}", response_model=schemas.AccountOut)
def update_chart_of_account(
    account_id: int,
    account: schemas.AccountUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("accounting:write")),
):
    return service.accounting_service(db).update_chart_of_account(account_id, account)


@router.get("/journal-entries", response_model=List[schemas.JournalEntryOut])
def list_journal_entries(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("accounting:read")),
):
    return service.accounting_service(db).get_journal_entries(skip, limit)


@router.get("/journal-entries/{entry_id}", response_model=schemas.JournalEntryOut)
def get_journal_entry(
    entry_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("accounting:read")),
):
    return service.accounting_service(db).get_journal_entry(entry_id)


@router.post("/journal-entries", response_model=schemas.JournalEntryOut)
def create_journal_entry(
    entry: schemas.JournalEntryCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("accounting:write")),
):
    return service.accounting_service(db).create_journal_entry(entry, current_user.id)


@router.post("/journal-entries/{entry_id}/post", response_model=schemas.JournalEntryOut)
def post_journal_entry(
    entry_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("accounting:write")),
):
    return service.accounting_service(db).post_journal_entry(entry_id, current_user.id)
