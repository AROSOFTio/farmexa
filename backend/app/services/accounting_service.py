"""
Enterprise Accounting Service

Centralized double-entry accounting engine for Farmexa ERP.

Responsibilities:
- Journal creation and validation (debit == credit enforcement)
- Tenant-scoped account lookups
- General ledger calculations (running balance per account)
- Trial balance generation (dynamic, from journal lines)
- Balance sheet generation
- Profit & Loss generation
- Cashbook view generation
- All calculations are derived from journal_entries / journal_lines — NO stored balances.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.finance_coa import (
    Account, AccountType, FiscalYear, JournalEntry, JournalEntryStatus,
    JournalLine, NormalBalance, OpeningBalance, SystemAccountMapping,
)


class AccountingService:
    """
    Core double-entry accounting engine.

    All journal operations are tenant-scoped. Balances are never stored —
    they are always computed dynamically from journal_lines.
    """

    def __init__(self, db: Session, tenant_id: Optional[int] = None):
        self.db = db
        self.tenant_id = tenant_id

    def get_mapped_account_code(self, operation_key: str, default_code: str) -> str:
        """Lookup account code from SystemAccountMapping, falling back to default_code."""
        if self.tenant_id is None:
            return default_code
        mapping = (
            self.db.query(SystemAccountMapping)
            .join(Account, SystemAccountMapping.account_id == Account.id)
            .filter(
                SystemAccountMapping.tenant_id == self.tenant_id,
                SystemAccountMapping.operation_key == operation_key
            )
            .first()
        )
        if mapping and mapping.account:
            return mapping.account.account_code
        return default_code

    # ------------------------------------------------------------------
    # Account Lookups
    # ------------------------------------------------------------------

    def _get_account(self, account_code: str) -> Account:
        """Get an account by code within the current tenant scope.
        Falls back to system-scope (tenant_id=None) accounts.
        """
        if self.tenant_id is not None:
            account = (
                self.db.query(Account)
                .filter(Account.account_code == account_code, Account.tenant_id == self.tenant_id)
                .first()
            )
            if account:
                return account
        # Fall back to system-scope
        account = (
            self.db.query(Account)
            .filter(Account.account_code == account_code, Account.tenant_id.is_(None))
            .first()
        )
        if not account:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Account code '{account_code}' not found. Please ensure the chart of accounts is set up.",
            )
        if not account.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Account '{account_code}' is inactive and cannot receive postings.",
            )
        if not account.allow_manual_entries:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Account '{account_code}' is a header account and does not accept direct entries.",
            )
        return account

    def get_all_accounts(self, include_inactive: bool = False) -> list[Account]:
        """Get all accounts for the current tenant."""
        q = self.db.query(Account).filter(Account.tenant_id == self.tenant_id)
        if not include_inactive:
            q = q.filter(Account.is_active.is_(True))
        return q.order_by(Account.account_code).all()

    # ------------------------------------------------------------------
    # Journal Entry Creation
    # ------------------------------------------------------------------

    def _validate_balance(self, lines: list[JournalLine]) -> None:
        """Enforce that total debits == total credits (double-entry rule)."""
        total_debits = round(sum(line.debit or 0 for line in lines), 2)
        total_credits = round(sum(line.credit or 0 for line in lines), 2)
        if abs(total_debits - total_credits) > 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Journal entry is unbalanced: debits={total_debits}, credits={total_credits}. "
                       "Debits must equal credits.",
            )

    def create_journal_entry(
        self,
        entry_date: date,
        description: Optional[str] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        source_module: Optional[str] = None,
        source_reference: Optional[str] = None,
        notes: Optional[str] = None,
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """Create a new DRAFT journal entry."""
        entry_number = f"JE-{uuid4().hex[:10].upper()}"
        entry = JournalEntry(
            tenant_id=self.tenant_id,
            entry_number=entry_number,
            entry_date=entry_date,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
            source_module=source_module,
            source_reference=source_reference,
            notes=notes,
            status=JournalEntryStatus.DRAFT,
            created_by_user_id=created_by_user_id,
            created_at=datetime.now(timezone.utc),
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
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> JournalLine:
        """Add a debit or credit line to a journal entry."""
        account = self._get_account(account_code)
        line = JournalLine(
            journal_entry_id=journal_entry.id,
            account_id=account.id,
            debit=round(debit, 2),
            credit=round(credit, 2),
            memo=memo,
            branch_id=branch_id,
            batch_id=batch_id,
        )
        self.db.add(line)
        return line

    def post_journal_entry(self, journal_entry: JournalEntry, posted_by_user_id: int) -> JournalEntry:
        """Validate balance and post a DRAFT journal entry."""
        if journal_entry.status != JournalEntryStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only DRAFT entries can be posted. Current status: {journal_entry.status}.",
            )
        self._validate_balance(journal_entry.lines)
        journal_entry.status = JournalEntryStatus.POSTED
        journal_entry.posted_at = datetime.now(timezone.utc)
        journal_entry.posted_by_user_id = posted_by_user_id
        self.db.commit()
        self.db.refresh(journal_entry)
        return journal_entry

    def create_and_post_journal(
        self,
        entry_date: date,
        lines: list[dict],  # [{"account_code": "1111", "debit": 100.0, "credit": 0.0, "memo": "...", "branch_id": 1, "batch_id": 2}]
        description: Optional[str] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[int] = None,
        source_module: Optional[str] = None,
        source_reference: Optional[str] = None,
        notes: Optional[str] = None,
        created_by_user_id: Optional[int] = None,
        branch_id: Optional[int] = None,
    ) -> JournalEntry:
        """Atomic: create, add lines, validate, and post a journal entry in one call."""
        entry = self.create_journal_entry(
            entry_date=entry_date,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
            source_module=source_module,
            source_reference=source_reference,
            notes=notes,
            created_by_user_id=created_by_user_id,
        )
        entry.branch_id = branch_id
        for line_data in lines:
            self.add_journal_line(
                journal_entry=entry,
                account_code=line_data["account_code"],
                debit=line_data.get("debit", 0.0),
                credit=line_data.get("credit", 0.0),
                memo=line_data.get("memo"),
                branch_id=line_data.get("branch_id"),
                batch_id=line_data.get("batch_id"),
            )
        self.db.flush()
        self._validate_balance(entry.lines)
        entry.status = JournalEntryStatus.POSTED
        entry.posted_at = datetime.now(timezone.utc)
        entry.posted_by_user_id = created_by_user_id
        self.db.commit()
        self.db.refresh(entry)
        return entry

    # ------------------------------------------------------------------
    # Balance Calculations (dynamic — computed from journal lines)
    # ------------------------------------------------------------------

    def _get_account_balance(
        self,
        account_id: int,
        as_of_date: Optional[date] = None,
        from_date: Optional[date] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> dict:
        """Compute debit/credit totals from posted journal lines for an account."""
        q = (
            self.db.query(
                func.coalesce(func.sum(JournalLine.debit), 0).label("total_debit"),
                func.coalesce(func.sum(JournalLine.credit), 0).label("total_credit"),
            )
            .join(JournalEntry, JournalLine.journal_entry_id == JournalEntry.id)
            .filter(
                JournalLine.account_id == account_id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.tenant_id == self.tenant_id,
            )
        )
        if from_date:
            q = q.filter(JournalEntry.entry_date >= from_date)
        if as_of_date:
            q = q.filter(JournalEntry.entry_date <= as_of_date)
        if branch_id:
            q = q.filter(JournalLine.branch_id == branch_id)
        if batch_id:
            q = q.filter(JournalLine.batch_id == batch_id)

        result = q.one()
        total_debit = float(result.total_debit)
        total_credit = float(result.total_credit)
        return {"total_debit": total_debit, "total_credit": total_credit}

    def _opening_balance_amounts(self, account_id: int) -> tuple[float, float]:
        """Get opening balance debit and credit for an account."""
        ob = (
            self.db.query(OpeningBalance)
            .filter(
                OpeningBalance.account_id == account_id,
                OpeningBalance.tenant_id == self.tenant_id,
            )
            .first()
        )
        if ob:
            return float(ob.opening_debit), float(ob.opening_credit)
        return 0.0, 0.0

    def get_account_net_balance(
        self, 
        account: Account, 
        as_of_date: Optional[date] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> float:
        """
        Compute the net running balance for an account per its normal balance convention:
        - DEBIT-normal accounts (assets, expenses, COGS): balance = total_debit - total_credit
        - CREDIT-normal accounts (liabilities, equity, revenue): balance = total_credit - total_debit
        Opening balances are included unless branch_id or batch_id are provided (as OBs are tenant-level).
        """
        if branch_id or batch_id:
            ob_debit, ob_credit = 0.0, 0.0
        else:
            ob_debit, ob_credit = self._opening_balance_amounts(account.id)
            
        bal = self._get_account_balance(account.id, as_of_date=as_of_date, branch_id=branch_id, batch_id=batch_id)
        total_debit = ob_debit + bal["total_debit"]
        total_credit = ob_credit + bal["total_credit"]

        if account.normal_balance == NormalBalance.DEBIT:
            return round(total_debit - total_credit, 2)
        else:
            return round(total_credit - total_debit, 2)

    # ------------------------------------------------------------------
    # General Ledger
    # ------------------------------------------------------------------

    def get_ledger(
        self,
        account_id: int,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> dict:
        """
        General ledger for a specific account with running balance.
        Returns account info + list of journal lines in date order.
        """
        account = (
            self.db.query(Account)
            .filter(Account.id == account_id, Account.tenant_id == self.tenant_id)
            .first()
        )
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        q = (
            self.db.query(JournalLine)
            .join(JournalEntry)
            .filter(
                JournalLine.account_id == account_id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.tenant_id == self.tenant_id,
            )
            .options(joinedload(JournalLine.journal_entry))
            .order_by(JournalEntry.entry_date, JournalEntry.id)
        )
        if from_date:
            q = q.filter(JournalEntry.entry_date >= from_date)
        if to_date:
            q = q.filter(JournalEntry.entry_date <= to_date)
        if branch_id:
            q = q.filter(JournalLine.branch_id == branch_id)
        if batch_id:
            q = q.filter(JournalLine.batch_id == batch_id)

        lines = q.all()

        # Opening balance as of from_date
        if branch_id or batch_id:
            ob_debit, ob_credit = 0.0, 0.0
        else:
            ob_debit, ob_credit = self._opening_balance_amounts(account.id)

        if from_date:
            prior = self._get_account_balance(account.id, as_of_date=from_date, branch_id=branch_id, batch_id=batch_id)
            opening_debit = ob_debit + prior["total_debit"]
            opening_credit = ob_credit + prior["total_credit"]
        else:
            opening_debit, opening_credit = ob_debit, ob_credit

        if account.normal_balance == NormalBalance.DEBIT:
            running_balance = round(opening_debit - opening_credit, 2)
        else:
            running_balance = round(opening_credit - opening_debit, 2)

        entries_out = []
        for line in lines:
            je = line.journal_entry
            if account.normal_balance == NormalBalance.DEBIT:
                running_balance = round(running_balance + (line.debit or 0) - (line.credit or 0), 2)
            else:
                running_balance = round(running_balance + (line.credit or 0) - (line.debit or 0), 2)
            entries_out.append({
                "date": je.entry_date.isoformat(),
                "entry_number": je.entry_number,
                "description": je.description or line.memo,
                "reference_type": je.reference_type,
                "reference_id": je.reference_id,
                "debit": line.debit or 0,
                "credit": line.credit or 0,
                "balance": running_balance,
            })

        return {
            "account": {
                "id": account.id,
                "code": account.account_code,
                "name": account.name,
                "type": account.account_type,
                "normal_balance": account.normal_balance,
            },
            "from_date": from_date.isoformat() if from_date else None,
            "to_date": to_date.isoformat() if to_date else None,
            "opening_balance": running_balance - sum(
                (l.debit or 0) - (l.credit or 0) if account.normal_balance == NormalBalance.DEBIT
                else (l.credit or 0) - (l.debit or 0)
                for l in lines
            ),
            "closing_balance": running_balance,
            "entries": entries_out,
        }

    # ------------------------------------------------------------------
    # Trial Balance
    # ------------------------------------------------------------------

    def get_trial_balance(self, as_of_date: Optional[date] = None, branch_id: Optional[int] = None) -> dict:
        """
        Compute a trial balance for all active accounts of the tenant.
        Returns accounts with debit/credit totals; total debits must equal total credits.
        """
        accounts = (
            self.db.query(Account)
            .filter(Account.tenant_id == self.tenant_id, Account.is_active.is_(True))
            .order_by(Account.account_code)
            .all()
        )

        rows = []
        total_debit = 0.0
        total_credit = 0.0

        for account in accounts:
            if branch_id:
                ob_dr, ob_cr = 0.0, 0.0
            else:
                ob_dr, ob_cr = self._opening_balance_amounts(account.id)
            
            bal = self._get_account_balance(account.id, as_of_date=as_of_date, branch_id=branch_id)
            dr = round(ob_dr + bal["total_debit"], 2)
            cr = round(ob_cr + bal["total_credit"], 2)
            if dr == 0 and cr == 0:
                continue
            rows.append({
                "account_code": account.account_code,
                "account_name": account.name,
                "account_type": account.account_type,
                "total_debit": dr,
                "total_credit": cr,
            })
            total_debit = round(total_debit + dr, 2)
            total_credit = round(total_credit + cr, 2)

        return {
            "as_of_date": as_of_date.isoformat() if as_of_date else None,
            "rows": rows,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "is_balanced": abs(total_debit - total_credit) < 0.02,
        }

    # ------------------------------------------------------------------
    # Profit & Loss
    # ------------------------------------------------------------------

    def get_profit_and_loss(
        self, 
        from_date: Optional[date] = None, 
        to_date: Optional[date] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> dict:
        """
        Dynamic P&L: Revenue - Cost of Sales - Expenses = Net Profit.
        """
        revenue_types = {AccountType.REVENUE}
        cos_types = {AccountType.COST_OF_SALES}
        expense_types = {AccountType.EXPENSE}

        accounts = (
            self.db.query(Account)
            .filter(
                Account.tenant_id == self.tenant_id,
                Account.is_active.is_(True),
                Account.account_type.in_([AccountType.REVENUE, AccountType.COST_OF_SALES, AccountType.EXPENSE]),
            )
            .order_by(Account.account_code)
            .all()
        )

        revenue_rows, cos_rows, expense_rows = [], [], []
        total_revenue = total_cos = total_expenses = 0.0

        for account in accounts:
            bal = self._get_account_balance(account.id, from_date=from_date, as_of_date=to_date, branch_id=branch_id, batch_id=batch_id)
            net = round(bal["total_credit"] - bal["total_debit"], 2) if account.account_type == AccountType.REVENUE \
                else round(bal["total_debit"] - bal["total_credit"], 2)
            if net == 0:
                continue

            row = {"account_code": account.account_code, "account_name": account.name, "amount": net}
            if account.account_type == AccountType.REVENUE:
                revenue_rows.append(row)
                total_revenue = round(total_revenue + net, 2)
            elif account.account_type == AccountType.COST_OF_SALES:
                cos_rows.append(row)
                total_cos = round(total_cos + net, 2)
            else:
                expense_rows.append(row)
                total_expenses = round(total_expenses + net, 2)

        gross_profit = round(total_revenue - total_cos, 2)
        net_profit = round(gross_profit - total_expenses, 2)

        return {
            "from_date": from_date.isoformat() if from_date else None,
            "to_date": to_date.isoformat() if to_date else None,
            "revenue": revenue_rows,
            "total_revenue": total_revenue,
            "cost_of_sales": cos_rows,
            "total_cost_of_sales": total_cos,
            "gross_profit": gross_profit,
            "expenses": expense_rows,
            "total_expenses": total_expenses,
            "net_profit": net_profit,
        }

    # ------------------------------------------------------------------
    # Balance Sheet
    # ------------------------------------------------------------------

    def get_balance_sheet(self, as_of_date: Optional[date] = None, branch_id: Optional[int] = None) -> dict:
        """
        Balance sheet: Assets = Liabilities + Equity.
        """
        balance_accounts = (
            self.db.query(Account)
            .filter(
                Account.tenant_id == self.tenant_id,
                Account.is_active.is_(True),
                Account.account_type.in_([AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY]),
            )
            .order_by(Account.account_code)
            .all()
        )

        asset_rows, liability_rows, equity_rows = [], [], []
        total_assets = total_liabilities = total_equity = 0.0

        for account in balance_accounts:
            net = self.get_account_net_balance(account, as_of_date=as_of_date, branch_id=branch_id)
            if net == 0:
                continue
            row = {"account_code": account.account_code, "account_name": account.name, "balance": net}
            if account.account_type == AccountType.ASSET:
                asset_rows.append(row)
                total_assets = round(total_assets + net, 2)
            elif account.account_type == AccountType.LIABILITY:
                liability_rows.append(row)
                total_liabilities = round(total_liabilities + net, 2)
            else:
                equity_rows.append(row)
                total_equity = round(total_equity + net, 2)

        return {
            "as_of_date": as_of_date.isoformat() if as_of_date else None,
            "assets": asset_rows,
            "total_assets": total_assets,
            "liabilities": liability_rows,
            "total_liabilities": total_liabilities,
            "equity": equity_rows,
            "total_equity": total_equity,
            "total_liabilities_and_equity": round(total_liabilities + total_equity, 2),
            "is_balanced": abs(total_assets - (total_liabilities + total_equity)) < 0.02,
        }

    # ------------------------------------------------------------------
    # Cashbook
    # ------------------------------------------------------------------

    def get_cashbook(
        self,
        account_id: int,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        branch_id: Optional[int] = None,
    ) -> dict:
        """
        Cashbook view for a cash/bank/mobile money account.
        Alias of get_ledger with friendlier labels.
        """
        return self.get_ledger(account_id, from_date=from_date, to_date=to_date, branch_id=branch_id)

    def get_cash_accounts(self) -> list[Account]:
        """
        Identify cash, bank, mobile money, and petty cash accounts using heuristics.
        Assets that have 'cash', 'bank', 'mpesa', 'm-pesa', 'wallet', 'petty' in name,
        or account code starting with '111' or '110'.
        """
        accounts = self.db.query(Account).filter(
            Account.tenant_id == self.tenant_id,
            Account.is_active.is_(True),
            Account.account_type == AccountType.ASSET
        ).all()
        
        cash_accounts = []
        for account in accounts:
            name_lower = account.name.lower()
            code = account.account_code
            if (
                code.startswith("111") or code.startswith("110") or
                "cash" in name_lower or "bank" in name_lower or
                "mpesa" in name_lower or "m-pesa" in name_lower or
                "wallet" in name_lower
            ):
                cash_accounts.append(account)
        return cash_accounts

    # ------------------------------------------------------------------
    # Cash Flow Statement
    # ------------------------------------------------------------------

    def get_cash_flow(
        self,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        branch_id: Optional[int] = None,
    ) -> dict:
        """
        Derive a cash flow statement by analyzing journal entries that hit cash accounts.
        Classifies cash movements into Operating, Investing, and Financing activities.
        """
        cash_accounts = self.get_cash_accounts()
        cash_account_ids = {a.id for a in cash_accounts}
        
        if not cash_account_ids:
            return {
                "from_date": from_date.isoformat() if from_date else None,
                "to_date": to_date.isoformat() if to_date else None,
                "operating": [], "total_operating": 0.0,
                "investing": [], "total_investing": 0.0,
                "financing": [], "total_financing": 0.0,
                "net_cash_flow": 0.0,
            }

        # Find all posted journal entries that touch any cash account
        q = (
            self.db.query(JournalEntry)
            .join(JournalLine, JournalLine.journal_entry_id == JournalEntry.id)
            .filter(
                JournalLine.account_id.in_(cash_account_ids),
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.tenant_id == self.tenant_id,
            )
        )
        if from_date:
            q = q.filter(JournalEntry.entry_date >= from_date)
        if to_date:
            q = q.filter(JournalEntry.entry_date <= to_date)
        if branch_id:
            q = q.filter(JournalLine.branch_id == branch_id)
            
        entries = q.options(joinedload(JournalEntry.lines).joinedload(JournalLine.account)).all()

        operating_flows = {}
        investing_flows = {}
        financing_flows = {}
        
        total_operating = 0.0
        total_investing = 0.0
        total_financing = 0.0

        for entry in entries:
            # Check if this entry applies to the branch (if branch filtered, only consider lines for this branch)
            # Find the net cash change in this entry for the branch
            net_cash_change = 0.0
            offset_lines = []
            
            for line in entry.lines:
                if branch_id and line.branch_id != branch_id:
                    continue
                if line.account_id in cash_account_ids:
                    # Cash account line: debit = cash in (+), credit = cash out (-)
                    net_cash_change += (line.debit or 0.0) - (line.credit or 0.0)
                else:
                    # Offsetting line
                    offset_lines.append(line)
                    
            if abs(net_cash_change) < 0.01:
                continue
                
            # Classify based on the primary offset account
            # If multiple offsets, we pick the first one or split proportionally. 
            # For simplicity, if there's an offset account, we use its type to classify the whole net_cash_change.
            if not offset_lines:
                continue
                
            # Heuristic: Find the offset account that carries the most weight, or just use the first non-cash line
            primary_offset = sorted(offset_lines, key=lambda l: max(l.debit or 0, l.credit or 0), reverse=True)[0]
            offset_acct = primary_offset.account
            
            # Classification rules
            is_investing = offset_acct.account_type == AccountType.ASSET and "equipment" in offset_acct.name.lower() or "property" in offset_acct.name.lower()
            is_financing = offset_acct.account_type == AccountType.EQUITY or (offset_acct.account_type == AccountType.LIABILITY and ("loan" in offset_acct.name.lower() or "capital" in offset_acct.name.lower()))
            
            category = "Operating"
            if is_investing:
                category = "Investing"
                target_dict = investing_flows
                total_investing += net_cash_change
            elif is_financing:
                category = "Financing"
                target_dict = financing_flows
                total_financing += net_cash_change
            else:
                target_dict = operating_flows
                total_operating += net_cash_change
                
            # Group by offset account name or a broader category
            group_key = f"Cash from {offset_acct.name}" if net_cash_change > 0 else f"Cash paid for {offset_acct.name}"
            target_dict[group_key] = target_dict.get(group_key, 0.0) + net_cash_change

        # Format output
        def format_flows(flow_dict):
            return [{"category": k, "amount": round(v, 2)} for k, v in flow_dict.items() if round(v, 2) != 0]

        return {
            "from_date": from_date.isoformat() if from_date else None,
            "to_date": to_date.isoformat() if to_date else None,
            "operating": format_flows(operating_flows),
            "total_operating": round(total_operating, 2),
            "investing": format_flows(investing_flows),
            "total_investing": round(total_investing, 2),
            "financing": format_flows(financing_flows),
            "total_financing": round(total_financing, 2),
            "net_cash_flow": round(total_operating + total_investing + total_financing, 2),
        }

    # ------------------------------------------------------------------
    # Business Operation Hooks (called by PostingEngine)
    # ------------------------------------------------------------------

    def record_sale(
        self,
        sale_amount: float,
        cost_of_goods_sold: float,
        entry_date: date,
        reference_id: int,
        is_cash: bool = True,
        created_by_user_id: Optional[int] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> JournalEntry:
        """Record a sale: Dr Cash/AR, Cr Sales; Dr COGS, Cr Inventory."""
        receivable_code = self.get_mapped_account_code("cash" if is_cash else "ar", "1111" if is_cash else "1120")
        sales_code = self.get_mapped_account_code("sales_revenue", "4110")
        cogs_code = self.get_mapped_account_code("cogs", "5000")
        inv_code = self.get_mapped_account_code("finished_goods", "1134")
        
        return self.create_and_post_journal(
            entry_date=entry_date,
            description=f"Sale #{reference_id}",
            reference_type="sale",
            reference_id=reference_id,
            source_module="sales",
            created_by_user_id=created_by_user_id,
            branch_id=branch_id,
            lines=[
                {"account_code": receivable_code,  "debit": sale_amount,        "memo": "Sale proceeds", "branch_id": branch_id, "batch_id": batch_id},
                {"account_code": sales_code,       "credit": sale_amount,       "memo": "Sales revenue", "branch_id": branch_id, "batch_id": batch_id},
                {"account_code": cogs_code,        "debit": cost_of_goods_sold, "memo": "Cost of goods sold", "branch_id": branch_id, "batch_id": batch_id},
                {"account_code": inv_code,         "credit": cost_of_goods_sold,"memo": "Inventory reduction", "branch_id": branch_id, "batch_id": batch_id},
            ],
        )

    def record_feed_purchase(
        self,
        amount: float,
        entry_date: date,
        reference_id: int,
        is_cash: bool = True,
        created_by_user_id: Optional[int] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> JournalEntry:
        """Feed purchase: Dr Feed Inventory, Cr Cash/AP."""
        payable_code = self.get_mapped_account_code("cash" if is_cash else "ap", "1111" if is_cash else "2110")
        feed_inv_code = self.get_mapped_account_code("feed_inventory", "1131")
        return self.create_and_post_journal(
            entry_date=entry_date,
            description=f"Feed purchase #{reference_id}",
            reference_type="feed_purchase",
            reference_id=reference_id,
            source_module="feed",
            created_by_user_id=created_by_user_id,
            branch_id=branch_id,
            lines=[
                {"account_code": feed_inv_code, "debit": amount,  "memo": "Feed stock received", "branch_id": branch_id, "batch_id": batch_id},
                {"account_code": payable_code, "credit": amount, "memo": "Feed supplier payment", "branch_id": branch_id, "batch_id": batch_id},
            ],
        )

    def record_feed_consumption(
        self,
        amount: float,
        entry_date: date,
        reference_id: int,
        created_by_user_id: Optional[int] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> JournalEntry:
        """Feed usage: Dr Feed Cost, Cr Feed Inventory."""
        feed_cost_code = self.get_mapped_account_code("feed_cost", "5110")
        feed_inv_code = self.get_mapped_account_code("feed_inventory", "1131")
        return self.create_and_post_journal(
            entry_date=entry_date,
            description=f"Feed consumption #{reference_id}",
            reference_type="feed_consumption",
            reference_id=reference_id,
            source_module="feed",
            created_by_user_id=created_by_user_id,
            branch_id=branch_id,
            lines=[
                {"account_code": feed_cost_code, "debit": amount,  "memo": "Feed consumed by flock", "branch_id": branch_id, "batch_id": batch_id},
                {"account_code": feed_inv_code,  "credit": amount, "memo": "Feed inventory reduction", "branch_id": branch_id, "batch_id": batch_id},
            ],
        )
        
    def record_egg_sales(
        self,
        revenue: float,
        entry_date: date,
        reference_id: int,
        is_cash: bool = True,
        created_by_user_id: Optional[int] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> JournalEntry:
        """Egg Sales: Dr Cash/AR, Cr Egg Sales."""
        receivable_code = self.get_mapped_account_code("cash" if is_cash else "ar", "1111" if is_cash else "1120")
        sales_code = self.get_mapped_account_code("egg_sales", "4130")

        return self.create_and_post_journal(
            entry_date=entry_date,
            description=f"Egg Sales #{reference_id}",
            reference_type="egg_sale",
            reference_id=reference_id,
            source_module="sales",
            created_by_user_id=created_by_user_id,
            branch_id=branch_id,
            lines=[
                {"account_code": receivable_code, "debit": revenue, "memo": "Egg sales revenue", "branch_id": branch_id, "batch_id": batch_id},
                {"account_code": sales_code, "credit": revenue, "memo": "Egg sales revenue", "branch_id": branch_id, "batch_id": batch_id},
            ],
        )

    def record_bird_mortality(
        self,
        amount: float,
        entry_date: date,
        reference_id: int,
        created_by_user_id: Optional[int] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> JournalEntry:
        """Bird Mortality: Dr Mortality Loss, Cr Live Bird Inventory."""
        loss_code = self.get_mapped_account_code("mortality_loss", "5400")
        inv_code = self.get_mapped_account_code("live_bird_inventory", "1133")

        return self.create_and_post_journal(
            entry_date=entry_date,
            description=f"Bird mortality #{reference_id}",
            reference_type="mortality",
            reference_id=reference_id,
            source_module="flock",
            created_by_user_id=created_by_user_id,
            branch_id=branch_id,
            lines=[
                {"account_code": loss_code, "debit": amount, "memo": "Mortality write-off", "branch_id": branch_id, "batch_id": batch_id},
                {"account_code": inv_code, "credit": amount, "memo": "Live bird inventory reduction", "branch_id": branch_id, "batch_id": batch_id},
            ],
        )

    def record_medication_usage(
        self,
        amount: float,
        entry_date: date,
        reference_id: int,
        created_by_user_id: Optional[int] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> JournalEntry:
        """Medication usage: Dr Medication Expense, Cr Medication Inventory."""
        expense_code = self.get_mapped_account_code("medication_expense", "5200")
        inv_code = self.get_mapped_account_code("medication_inventory", "1132")

        return self.create_and_post_journal(
            entry_date=entry_date,
            description=f"Medication usage #{reference_id}",
            reference_type="medication",
            reference_id=reference_id,
            source_module="flock",
            created_by_user_id=created_by_user_id,
            branch_id=branch_id,
            lines=[
                {"account_code": expense_code, "debit": amount, "memo": "Medication cost", "branch_id": branch_id, "batch_id": batch_id},
                {"account_code": inv_code, "credit": amount, "memo": "Medication inventory reduction", "branch_id": branch_id, "batch_id": batch_id},
            ],
        )

    def record_slaughter(
        self,
        dressed_weight_value: float,
        byproduct_value: float,
        cost_of_production: float,
        entry_date: date,
        reference_id: int,
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """Slaughter: Dr Finished Goods + Byproduct, Cr Live Birds Inventory."""
        total_output = round(dressed_weight_value + byproduct_value, 2)
        lines = [
            {"account_code": "1134", "debit": dressed_weight_value, "memo": "Dressed chicken produced"},
            {"account_code": "1133", "credit": cost_of_production,  "memo": "Live birds consumed in slaughter"},
        ]
        if byproduct_value > 0:
            lines.append({"account_code": "1139", "debit": byproduct_value, "memo": "Byproducts produced"})
        # Adjust for any slaughter gain/loss
        diff = round(total_output - cost_of_production, 2)
        if diff > 0:
            lines.append({"account_code": "4200", "credit": diff, "memo": "Slaughter gain"})
        elif diff < 0:
            lines.append({"account_code": "5400", "debit": abs(diff), "memo": "Slaughter processing loss"})

        return self.create_and_post_journal(
            entry_date=entry_date,
            description=f"Slaughter #{reference_id}",
            reference_type="slaughter",
            reference_id=reference_id,
            source_module="slaughter",
            created_by_user_id=created_by_user_id,
            lines=lines,
        )

    def record_expense(
        self,
        amount: float,
        expense_account_code: str,
        entry_date: date,
        reference_id: int,
        is_cash: bool = True,
        created_by_user_id: Optional[int] = None,
        description: Optional[str] = None,
        branch_id: Optional[int] = None,
        batch_id: Optional[int] = None,
    ) -> JournalEntry:
        """Expense: Dr Expense Account, Cr Cash/AP."""
        payable_code = "1111" if is_cash else "2110"
        return self.create_and_post_journal(
            entry_date=entry_date,
            description=description or f"Expense #{reference_id}",
            reference_type="expense",
            reference_id=reference_id,
            source_module="finance",
            created_by_user_id=created_by_user_id,
            branch_id=branch_id,
            lines=[
                {"account_code": expense_account_code, "debit": amount,  "memo": "Expense recorded", "branch_id": branch_id, "batch_id": batch_id},
                {"account_code": payable_code,          "credit": amount, "memo": "Cash/Payable", "branch_id": branch_id, "batch_id": batch_id},
            ],
        )

    def record_payment_received(
        self,
        payment_amount: float,
        entry_date: date,
        reference_id: int,
        bank_account_code: str = "1112",
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """Customer payment: Dr Bank, Cr AR."""
        return self.create_and_post_journal(
            entry_date=entry_date,
            description=f"Payment received #{reference_id}",
            reference_type="payment_received",
            reference_id=reference_id,
            source_module="sales",
            created_by_user_id=created_by_user_id,
            lines=[
                {"account_code": bank_account_code, "debit": payment_amount,  "memo": "Payment from customer"},
                {"account_code": "1120",             "credit": payment_amount, "memo": "AR cleared"},
            ],
        )

    def record_payment_made(
        self,
        payment_amount: float,
        entry_date: date,
        reference_id: int,
        bank_account_code: str = "1112",
        created_by_user_id: Optional[int] = None,
    ) -> JournalEntry:
        """Supplier payment: Dr AP, Cr Bank."""
        return self.create_and_post_journal(
            entry_date=entry_date,
            description=f"Payment to supplier #{reference_id}",
            reference_type="payment_made",
            reference_id=reference_id,
            source_module="finance",
            created_by_user_id=created_by_user_id,
            lines=[
                {"account_code": "2110",             "debit": payment_amount,  "memo": "AP cleared"},
                {"account_code": bank_account_code,  "credit": payment_amount, "memo": "Payment to supplier"},
            ],
        )
