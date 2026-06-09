"""
Enterprise Accounting Module Service

Wraps AccountingService and provides:
- Chart of Accounts CRUD
- Journal Entry management
- Fiscal Year management
- Opening Balance management
- Account Template management
- All reporting endpoints (ledger, trial balance, P&L, balance sheet, cashbook)
"""

from datetime import date
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.finance_coa import (
    Account, AccountTemplate, FiscalYear, JournalEntry, JournalLine, NormalBalance,
    OpeningBalance, TemplateAccount,
)
from app.services.accounting_service import AccountingService
from app.seeds.chart_of_accounts_seed import (
    apply_template_to_tenant,
    create_default_fiscal_year,
    seed_coa_template,
)

from . import schemas


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TYPE_NORMAL_BALANCE = {
    "asset": NormalBalance.DEBIT,
    "liability": NormalBalance.CREDIT,
    "equity": NormalBalance.CREDIT,
    "revenue": NormalBalance.CREDIT,
    "cost_of_sales": NormalBalance.DEBIT,
    "expense": NormalBalance.DEBIT,
}


def _enrich_journal_line(line: JournalLine) -> JournalLine:
    """Attach account_code and account_name to a JournalLine object for serialization."""
    if line.account:
        line.account_code = line.account.account_code  # type: ignore[attr-defined]
        line.account_name = line.account.name          # type: ignore[attr-defined]
    return line


class AccountingModuleService:
    """High-level accounting module service."""

    def __init__(self, db: Session, tenant_id: Optional[int] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.engine = AccountingService(db, tenant_id=tenant_id)

    # ------------------------------------------------------------------
    # Chart of Accounts
    # ------------------------------------------------------------------

    def get_chart_of_accounts(
        self,
        skip: int = 0,
        limit: int = 500,
        include_inactive: bool = False,
        account_type: Optional[str] = None,
    ) -> List[Account]:
        q = (
            self.db.query(Account)
            .filter(Account.tenant_id == self.tenant_id)
            .options(joinedload(Account.parent))
            .order_by(Account.account_code)
        )
        if not include_inactive:
            q = q.filter(Account.is_active.is_(True))
        if account_type:
            q = q.filter(Account.account_type == account_type)
        return q.offset(skip).limit(limit).all()

    def get_chart_of_account(self, account_id: int) -> Account:
        account = (
            self.db.query(Account)
            .options(joinedload(Account.parent), joinedload(Account.sub_accounts))
            .filter(Account.id == account_id, Account.tenant_id == self.tenant_id)
            .first()
        )
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return account

    def create_account(self, data: schemas.AccountCreate) -> Account:
        # Validate uniqueness per tenant
        existing = (
            self.db.query(Account)
            .filter(Account.account_code == data.account_code, Account.tenant_id == self.tenant_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Account code '{data.account_code}' already exists for this tenant.",
            )
        if data.parent_account_id:
            parent = self.db.query(Account).filter(Account.id == data.parent_account_id).first()
            if not parent:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent account not found")

        normal_balance = data.normal_balance or _TYPE_NORMAL_BALANCE.get(data.account_type, NormalBalance.DEBIT)
        account = Account(
            tenant_id=self.tenant_id,
            account_code=data.account_code,
            name=data.name,
            account_type=data.account_type,
            normal_balance=normal_balance,
            parent_account_id=data.parent_account_id,
            description=data.description,
            is_active=data.is_active,
            allow_manual_entries=data.allow_manual_entries,
            is_system=False,
        )
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account

    def update_account(self, account_id: int, data: schemas.AccountUpdate) -> Account:
        account = self.get_chart_of_account(account_id)
        if account.is_system and data.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System accounts cannot be deactivated. Create a custom account instead.",
            )
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        for key, value in update_data.items():
            setattr(account, key, value)
        self.db.commit()
        self.db.refresh(account)
        return account

    def delete_account(self, account_id: int) -> None:
        account = self.get_chart_of_account(account_id)
        if account.is_system:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System accounts cannot be deleted. Use 'is_active=false' to disable them.",
            )
        # Check for any journal lines using this account
        has_lines = self.db.query(JournalLine).filter(JournalLine.account_id == account_id).first()
        if has_lines:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete account with existing journal entries. Deactivate it instead.",
            )
        self.db.delete(account)
        self.db.commit()

    # ------------------------------------------------------------------
    # Journal Entries
    # ------------------------------------------------------------------

    def get_journal_entries(
        self,
        skip: int = 0,
        limit: int = 100,
        status_filter: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[JournalEntry]:
        q = (
            self.db.query(JournalEntry)
            .options(joinedload(JournalEntry.lines).joinedload(JournalLine.account))
            .filter(JournalEntry.tenant_id == self.tenant_id)
            .order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
        )
        if status_filter:
            q = q.filter(JournalEntry.status == status_filter)
        if from_date:
            q = q.filter(JournalEntry.entry_date >= from_date)
        if to_date:
            q = q.filter(JournalEntry.entry_date <= to_date)
        entries = q.offset(skip).limit(limit).all()
        for entry in entries:
            for line in entry.lines:
                _enrich_journal_line(line)
        return entries

    def get_journal_entry(self, entry_id: int) -> JournalEntry:
        entry = (
            self.db.query(JournalEntry)
            .options(joinedload(JournalEntry.lines).joinedload(JournalLine.account))
            .filter(JournalEntry.id == entry_id, JournalEntry.tenant_id == self.tenant_id)
            .first()
        )
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
        for line in entry.lines:
            _enrich_journal_line(line)
        return entry

    def create_journal_entry(
        self,
        data: schemas.JournalEntryCreate,
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        entry = self.engine.create_journal_entry(
            entry_date=data.entry_date,
            description=data.description,
            source_module=data.source_module,
            source_reference=data.source_reference,
            notes=data.notes,
            created_by_user_id=created_by_user_id,
        )
        for line_data in data.lines:
            account = self.db.query(Account).filter(Account.id == line_data.account_id).first()
            if not account:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Account ID {line_data.account_id} not found",
                )
            self.engine.add_journal_line(
                journal_entry=entry,
                account_code=account.account_code,
                debit=line_data.debit,
                credit=line_data.credit,
                memo=line_data.memo,
            )
        self.db.flush()
        self.db.commit()
        self.db.refresh(entry)
        entry = self.get_journal_entry(entry.id)
        return entry

    def post_journal_entry(self, entry_id: int, posted_by_user_id: int) -> JournalEntry:
        entry = self.db.query(JournalEntry).filter(
            JournalEntry.id == entry_id, JournalEntry.tenant_id == self.tenant_id
        ).first()
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
        result = self.engine.post_journal_entry(entry, posted_by_user_id)
        return self.get_journal_entry(result.id)

    # ------------------------------------------------------------------
    # Fiscal Years
    # ------------------------------------------------------------------

    def get_fiscal_years(self) -> List[FiscalYear]:
        return (
            self.db.query(FiscalYear)
            .filter(FiscalYear.tenant_id == self.tenant_id)
            .order_by(FiscalYear.start_date.desc())
            .all()
        )

    def create_fiscal_year(self, data: schemas.FiscalYearCreate) -> FiscalYear:
        if data.end_date <= data.start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date must be after start date.",
            )
        fy = FiscalYear(
            tenant_id=self.tenant_id,
            name=data.name,
            start_date=data.start_date,
            end_date=data.end_date,
        )
        self.db.add(fy)
        self.db.commit()
        self.db.refresh(fy)
        return fy

    def update_fiscal_year(self, fy_id: int, data: schemas.FiscalYearUpdate) -> FiscalYear:
        fy = self.db.query(FiscalYear).filter(
            FiscalYear.id == fy_id, FiscalYear.tenant_id == self.tenant_id
        ).first()
        if not fy:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fiscal year not found")
        for key, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
            setattr(fy, key, value)
        self.db.commit()
        self.db.refresh(fy)
        return fy

    # ------------------------------------------------------------------
    # Opening Balances
    # ------------------------------------------------------------------

    def get_opening_balances(self) -> List[OpeningBalance]:
        obs = (
            self.db.query(OpeningBalance)
            .options(joinedload(OpeningBalance.account))
            .filter(OpeningBalance.tenant_id == self.tenant_id)
            .all()
        )
        for ob in obs:
            if ob.account:
                ob.account_code = ob.account.account_code  # type: ignore[attr-defined]
                ob.account_name = ob.account.name          # type: ignore[attr-defined]
        return obs

    def set_opening_balances(self, data: schemas.OpeningBalanceBatchCreate) -> List[OpeningBalance]:
        """Upsert opening balances for a list of accounts."""
        results = []
        for entry in data.entries:
            existing = (
                self.db.query(OpeningBalance)
                .filter(
                    OpeningBalance.account_id == entry.account_id,
                    OpeningBalance.tenant_id == self.tenant_id,
                    OpeningBalance.fiscal_year_id == data.fiscal_year_id,
                )
                .first()
            )
            if existing:
                existing.opening_debit = entry.opening_debit
                existing.opening_credit = entry.opening_credit
                existing.opening_date = entry.opening_date
                existing.notes = entry.notes
                results.append(existing)
            else:
                ob = OpeningBalance(
                    tenant_id=self.tenant_id,
                    account_id=entry.account_id,
                    fiscal_year_id=data.fiscal_year_id,
                    opening_debit=entry.opening_debit,
                    opening_credit=entry.opening_credit,
                    opening_date=entry.opening_date,
                    notes=entry.notes,
                )
                self.db.add(ob)
                results.append(ob)
        self.db.commit()
        return self.get_opening_balances()

    # ------------------------------------------------------------------
    # Templates
    # ------------------------------------------------------------------

    def get_templates(self) -> List[AccountTemplate]:
        templates = (
            self.db.query(AccountTemplate)
            .options(joinedload(AccountTemplate.accounts))
            .filter(AccountTemplate.is_active.is_(True))
            .all()
        )
        for t in templates:
            t.account_count = len(t.accounts)  # type: ignore[attr-defined]
        return templates

    def apply_template(self, template_name: str) -> dict:
        """Apply a COA template to the current tenant."""
        if self.tenant_id is None:
            raise HTTPException(status_code=400, detail="Cannot apply template without a tenant context.")
        # Ensure the platform template is seeded first
        seed_coa_template(self.db)
        count = apply_template_to_tenant(self.db, self.tenant_id, template_name=template_name)
        return {"message": f"Template '{template_name}' applied successfully.", "accounts_created": count}

    def initialize_tenant(self) -> dict:
        """Auto-setup for a new tenant: apply default COA + create fiscal year."""
        if self.tenant_id is None:
            raise HTTPException(status_code=400, detail="Tenant context required.")
        seed_coa_template(self.db)
        accounts_created = apply_template_to_tenant(self.db, self.tenant_id)
        fy = create_default_fiscal_year(self.db, self.tenant_id)
        return {
            "message": "Tenant accounting initialized.",
            "accounts_created": accounts_created,
            "fiscal_year": fy.name,
        }

    # ------------------------------------------------------------------
    # Reports (delegate to AccountingService)
    # ------------------------------------------------------------------

    def get_ledger(
        self, account_id: int, from_date: Optional[date] = None, to_date: Optional[date] = None
    ) -> dict:
        return self.engine.get_ledger(account_id, from_date=from_date, to_date=to_date)

    def get_cashbook(
        self, account_id: int, from_date: Optional[date] = None, to_date: Optional[date] = None
    ) -> dict:
        return self.engine.get_cashbook(account_id, from_date=from_date, to_date=to_date)

    def get_trial_balance(self, as_of_date: Optional[date] = None) -> dict:
        return self.engine.get_trial_balance(as_of_date=as_of_date)

    def get_profit_and_loss(
        self, from_date: Optional[date] = None, to_date: Optional[date] = None
    ) -> dict:
        return self.engine.get_profit_and_loss(from_date=from_date, to_date=to_date)

    def get_balance_sheet(self, as_of_date: Optional[date] = None) -> dict:
        return self.engine.get_balance_sheet(as_of_date=as_of_date)


def accounting_service(db: Session, tenant_id: Optional[int] = None) -> AccountingModuleService:
    return AccountingModuleService(db, tenant_id=tenant_id)
