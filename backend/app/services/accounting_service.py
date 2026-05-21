"""
Accounting Service with Hooks for Business Operations

This service provides a centralized accounting system that integrates with
inventory, sales, farm, and other modules to automatically record financial
transactions through journal entries.
"""

from datetime import datetime, timezone, date
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.finance_coa import Account, AccountType, JournalEntry, JournalLine, JournalEntryStatus
from app.seeds.chart_of_accounts_seed import get_account_by_code


class AccountingService:
    """
    Centralized accounting service with hooks for business operations.
    
    This service provides methods to record journal entries for various
    business operations like sales, purchases, inventory movements, etc.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def _get_account(self, account_code: str) -> Account:
        """Get an account by code, raising an error if not found."""
        account = self.db.query(Account).filter(Account.account_code == account_code).first()
        if not account:
            raise HTTPException(
                status_code=400,
                detail=f"Account with code {account_code} not found. Please ensure chart of accounts is seeded."
            )
        return account
    
    def _validate_journal_entry(self, lines: list) -> None:
        """Validate that debits equal credits in a journal entry."""
        total_debits = sum(line.debit for line in lines)
        total_credits = sum(line.credit for line in lines)
        
        if abs(total_debits - total_credits) > 0.01:  # Allow for floating point precision
            raise HTTPException(
                status_code=400,
                detail=f"Journal entry must balance. Debits: {total_debits}, Credits: {total_credits}"
            )
    
    def create_journal_entry(
        self,
        entry_date: date,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        description: Optional[str] = None,
        notes: Optional[str] = None,
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """
        Create a new journal entry.
        
        Args:
            entry_date: Date of the journal entry
            reference_type: Type of transaction (e.g., "sale", "purchase", "slaughter")
            reference_id: ID of the related transaction
            description: Description of the journal entry
            notes: Additional notes
            created_by_user_id: ID of the user creating the entry
            
        Returns:
            Created JournalEntry object
        """
        entry = JournalEntry(
            entry_number=f"JE-{uuid4().hex[:8].upper()}",
            entry_date=entry_date,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
            status=JournalEntryStatus.DRAFT,
            notes=notes,
            created_at=datetime.now(timezone.utc),
            created_by_user_id=created_by_user_id,
        )
        self.db.add(entry)
        self.db.flush()
        return entry
    
    def add_journal_line(
        self,
        journal_entry: JournalEntry,
        account_code: str,
        debit: float = 0.0,
        credit: float = 0.0,
        memo: Optional[str] = None,
    ) -> JournalLine:
        """
        Add a line to a journal entry.
        
        Args:
            journal_entry: The journal entry to add the line to
            account_code: Code of the account to debit/credit
            debit: Amount to debit
            credit: Amount to credit
            memo: Description of the line
            
        Returns:
            Created JournalLine object
        """
        account = self._get_account(account_code)
        
        line = JournalLine(
            journal_entry_id=journal_entry.id,
            account_id=account.id,
            memo=memo,
            debit=debit,
            credit=credit,
        )
        self.db.add(line)
        return line
    
    def post_journal_entry(self, journal_entry: JournalEntry, posted_by_user_id: int) -> JournalEntry:
        """
        Post a journal entry to the ledger.
        
        Args:
            journal_entry: The journal entry to post
            posted_by_user_id: ID of the user posting the entry
            
        Returns:
            Updated JournalEntry object
        """
        if journal_entry.status != JournalEntryStatus.DRAFT:
            raise HTTPException(
                status_code=400,
                detail="Only draft journal entries can be posted"
            )
        
        # Validate that the entry balances
        self._validate_journal_entry(journal_entry.lines)
        
        journal_entry.status = JournalEntryStatus.POSTED
        journal_entry.posted_at = datetime.now(timezone.utc)
        journal_entry.posted_by_user_id = posted_by_user_id
        
        self.db.commit()
        self.db.refresh(journal_entry)
        return journal_entry
    
    def record_sale(
        self,
        sale_amount: float,
        cost_of_goods_sold: float,
        entry_date: date,
        reference_id: int,
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """
        Record a sale transaction.
        
        Debit: Accounts Receivable (or Cash)
        Credit: Sales Revenue
        Debit: Cost of Goods Sold
        Credit: Inventory
        
        Args:
            sale_amount: Total sale amount
            cost_of_goods_sold: Cost of goods sold
            entry_date: Date of the sale
            reference_id: ID of the sale/order
            created_by_user_id: ID of the user creating the entry
            
        Returns:
            Posted JournalEntry object
        """
        entry = self.create_journal_entry(
            entry_date=entry_date,
            reference_type="sale",
            reference_id=reference_id,
            description=f"Sale transaction #{reference_id}",
            created_by_user_id=created_by_user_id,
        )
        
        # Debit Accounts Receivable
        self.add_journal_line(
            journal_entry=entry,
            account_code="1120",  # Accounts Receivable
            debit=sale_amount,
            memo="Sale amount",
        )
        
        # Credit Sales Revenue
        self.add_journal_line(
            journal_entry=entry,
            account_code="4100",  # Sales Revenue
            credit=sale_amount,
            memo="Sale revenue",
        )
        
        # Debit Cost of Goods Sold
        self.add_journal_line(
            journal_entry=entry,
            account_code="5100",  # Cost of Goods Sold
            debit=cost_of_goods_sold,
            memo="Cost of goods sold",
        )
        
        # Credit Inventory
        self.add_journal_line(
            journal_entry=entry,
            account_code="1130",  # Inventory
            credit=cost_of_goods_sold,
            memo="Inventory reduction",
        )
        
        return self.post_journal_entry(entry, created_by_user_id or 0)
    
    def record_purchase(
        self,
        purchase_amount: float,
        entry_date: date,
        reference_id: int,
        account_code: str,  # e.g., "5110" for Feed Cost, "5120" for Medicine Cost
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """
        Record a purchase transaction.
        
        Debit: Expense Account (e.g., Feed Cost, Medicine Cost)
        Credit: Accounts Payable (or Cash)
        
        Args:
            purchase_amount: Total purchase amount
            entry_date: Date of the purchase
            reference_id: ID of the purchase
            account_code: Code of the expense account to debit
            created_by_user_id: ID of the user creating the entry
            
        Returns:
            Posted JournalEntry object
        """
        entry = self.create_journal_entry(
            entry_date=entry_date,
            reference_type="purchase",
            reference_id=reference_id,
            description=f"Purchase transaction #{reference_id}",
            created_by_user_id=created_by_user_id,
        )
        
        # Debit Expense Account
        self.add_journal_line(
            journal_entry=entry,
            account_code=account_code,
            debit=purchase_amount,
            memo="Purchase expense",
        )
        
        # Credit Accounts Payable
        self.add_journal_line(
            journal_entry=entry,
            account_code="2110",  # Accounts Payable
            credit=purchase_amount,
            memo="Accounts payable",
        )
        
        return self.post_journal_entry(entry, created_by_user_id or 0)
    
    def record_slaughter(
        self,
        dressed_weight_value: float,
        byproduct_value: float,
        cost_of_production: float,
        entry_date: date,
        reference_id: int,
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """
        Record a slaughter transaction.
        
        Debit: Finished Goods Inventory (dressed chicken)
        Debit: Byproduct Inventory
        Credit: Live Birds Inventory
        Credit: Cost of Goods Sold (if tracking separately)
        
        Args:
            dressed_weight_value: Value of dressed chicken produced
            byproduct_value: Value of byproducts produced
            cost_of_production: Cost of production
            entry_date: Date of slaughter
            reference_id: ID of the slaughter record
            created_by_user_id: ID of the user creating the entry
            
        Returns:
            Posted JournalEntry object
        """
        entry = self.create_journal_entry(
            entry_date=entry_date,
            reference_type="slaughter",
            reference_id=reference_id,
            description=f"Slaughter transaction #{reference_id}",
            created_by_user_id=created_by_user_id,
        )
        
        # Debit Finished Goods Inventory
        self.add_journal_line(
            journal_entry=entry,
            account_code="1134",  # Finished Goods Inventory
            debit=dressed_weight_value,
            memo="Dressed chicken produced",
        )
        
        # Debit Byproduct Inventory (if value > 0)
        if byproduct_value > 0:
            self.add_journal_line(
                journal_entry=entry,
                account_code="1130",  # Inventory
                debit=byproduct_value,
                memo="Byproducts produced",
            )
        
        # Credit Live Birds Inventory
        self.add_journal_line(
            journal_entry=entry,
            account_code="1133",  # Live Birds Inventory
            credit=cost_of_production,
            memo="Live birds consumed",
        )
        
        return self.post_journal_entry(entry, created_by_user_id or 0)
    
    def record_payment_received(
        self,
        payment_amount: float,
        entry_date: date,
        reference_id: int,
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """
        Record a payment received from a customer.
        
        Debit: Cash
        Credit: Accounts Receivable
        
        Args:
            payment_amount: Amount received
            entry_date: Date of payment
            reference_id: ID of the payment
            created_by_user_id: ID of the user creating the entry
            
        Returns:
            Posted JournalEntry object
        """
        entry = self.create_journal_entry(
            entry_date=entry_date,
            reference_type="payment_received",
            reference_id=reference_id,
            description=f"Payment received #{reference_id}",
            created_by_user_id=created_by_user_id,
        )
        
        # Debit Cash
        self.add_journal_line(
            journal_entry=entry,
            account_code="1112",  # Bank Accounts
            debit=payment_amount,
            memo="Payment received",
        )
        
        # Credit Accounts Receivable
        self.add_journal_line(
            journal_entry=entry,
            account_code="1120",  # Accounts Receivable
            credit=payment_amount,
            memo="Accounts receivable reduction",
        )
        
        return self.post_journal_entry(entry, created_by_user_id or 0)
    
    def record_payment_made(
        self,
        payment_amount: float,
        entry_date: date,
        reference_id: int,
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """
        Record a payment made to a supplier.
        
        Debit: Accounts Payable
        Credit: Cash
        
        Args:
            payment_amount: Amount paid
            entry_date: Date of payment
            reference_id: ID of the payment
            created_by_user_id: ID of the user creating the entry
            
        Returns:
            Posted JournalEntry object
        """
        entry = self.create_journal_entry(
            entry_date=entry_date,
            reference_type="payment_made",
            reference_id=reference_id,
            description=f"Payment made #{reference_id}",
            created_by_user_id=created_by_user_id,
        )
        
        # Debit Accounts Payable
        self.add_journal_line(
            journal_entry=entry,
            account_code="2110",  # Accounts Payable
            debit=payment_amount,
            memo="Accounts payable reduction",
        )
        
        # Credit Cash
        self.add_journal_line(
            journal_entry=entry,
            account_code="1112",  # Bank Accounts
            credit=payment_amount,
            memo="Payment made",
        )
        
        return self.post_journal_entry(entry, created_by_user_id or 0)
