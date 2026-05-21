from datetime import date
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.finance_coa import Account, JournalEntry, JournalLine
from app.services.accounting_service import AccountingService

from . import schemas


class AccountingModuleService:
    """Service module for accounting operations."""
    
    def __init__(self, db: Session):
        self.db = db
        self.accounting = AccountingService(db)
    
    def get_chart_of_accounts(self, skip: int = 0, limit: int = 100) -> List[Account]:
        """Get all chart of accounts."""
        return (
            self.db.query(Account)
            .options(joinedload(Account.parent))
            .order_by(Account.account_code)
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_chart_of_account(self, account_id: int) -> Account:
        """Get a single chart of account by ID."""
        account = (
            self.db.query(Account)
            .options(joinedload(Account.parent), joinedload(Account.sub_accounts))
            .filter(Account.id == account_id)
            .first()
        )
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chart of account not found")
        return account
    
    def create_chart_of_account(self, account: schemas.AccountCreate) -> Account:
        """Create a new chart of account."""
        # Check if account code already exists
        existing = self.db.query(Account).filter(Account.account_code == account.account_code).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Account code already exists")
        
        # Validate parent account exists if provided
        if account.parent_account_id:
            parent = self.db.query(Account).filter(Account.id == account.parent_account_id).first()
            if not parent:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent account not found")
        
        db_account = Account(**account.model_dump())
        self.db.add(db_account)
        self.db.commit()
        self.db.refresh(db_account)
        return db_account
    
    def update_chart_of_account(self, account_id: int, account: schemas.AccountUpdate) -> Account:
        """Update an existing chart of account."""
        db_account = self.db.query(Account).filter(Account.id == account_id).first()
        if not db_account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chart of account not found")
        
        update_data = account.model_dump(exclude_unset=True, exclude_none=True)
        
        # Validate parent account exists if provided
        if "parent_account_id" in update_data and update_data["parent_account_id"]:
            parent = self.db.query(Account).filter(Account.id == update_data["parent_account_id"]).first()
            if not parent:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent account not found")
        
        for key, value in update_data.items():
            setattr(db_account, key, value)
        
        self.db.commit()
        self.db.refresh(db_account)
        return db_account
    
    def get_journal_entries(self, skip: int = 0, limit: int = 100) -> List[JournalEntry]:
        """Get all journal entries."""
        return (
            self.db.query(JournalEntry)
            .options(joinedload(JournalEntry.lines).joinedload(JournalLine.account))
            .order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_journal_entry(self, entry_id: int) -> JournalEntry:
        """Get a single journal entry by ID."""
        entry = (
            self.db.query(JournalEntry)
            .options(joinedload(JournalEntry.lines).joinedload(JournalLine.account))
            .filter(JournalEntry.id == entry_id)
            .first()
        )
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
        return entry
    
    def create_journal_entry(self, entry: schemas.JournalEntryCreate, created_by_user_id: Optional[int] = None) -> JournalEntry:
        """Create a new journal entry."""
        db_entry = self.accounting.create_journal_entry(
            entry_date=entry.entry_date,
            reference_type=entry.source_module,
            reference_id=None,  
            description=entry.description,
            notes=None,
            created_by_user_id=created_by_user_id,
        )
        
        for line in entry.lines:
            account = self.db.query(Account).filter(Account.id == line.account_id).first()
            if not account:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Account with ID {line.account_id} not found")
            
            self.accounting.add_journal_line(
                journal_entry=db_entry,
                account_code=account.account_code,
                debit=line.debit,
                credit=line.credit,
                memo=line.memo,
            )
        
        self.db.commit()
        self.db.refresh(db_entry)
        return db_entry
    
    def post_journal_entry(self, entry_id: int, posted_by_user_id: int) -> JournalEntry:
        """Post a journal entry to the ledger."""
        entry = self.db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
        if not entry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Journal entry not found")
        
        return self.accounting.post_journal_entry(entry, posted_by_user_id)


accounting_service = AccountingModuleService
