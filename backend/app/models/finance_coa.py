"""
Enterprise Accounting Models — Chart of Accounts, Journals, Fiscal Years, Templates.

Upgraded to support:
- Tenant-scoped accounts (account_code unique per tenant, not globally)
- Normal balance convention (debit/credit)
- System vs custom account flag
- Account templates for COA auto-generation
- Fiscal years and periods
- Opening balances for migration
- Full journal audit trail (created_by, posted_by, timestamps)
"""

from datetime import datetime, timezone
import enum
from typing import Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.enums import db_enum


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"
    COST_OF_SALES = "cost_of_sales"


class NormalBalance(str, enum.Enum):
    DEBIT = "debit"
    CREDIT = "credit"


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    CANCELLED = "cancelled"


class FiscalYearStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"
    LOCKED = "locked"


# ---------------------------------------------------------------------------
# Account (Chart of Accounts)
# ---------------------------------------------------------------------------

class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        # account_code is unique per-tenant (NULL tenant = system/platform scope)
        UniqueConstraint("account_code", "tenant_id", name="uq_account_code_tenant"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    account_code = Column(String(50), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    account_type = Column(db_enum(AccountType, name="accounttype"), nullable=False)
    normal_balance = Column(
        db_enum(NormalBalance, name="normalbalance"),
        nullable=False,
        default=NormalBalance.DEBIT,
    )
    parent_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    allow_manual_entries = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    parent = relationship("Account", remote_side=[id], backref="sub_accounts")
    journal_lines = relationship("JournalLine", back_populates="account")
    opening_balances = relationship("OpeningBalance", back_populates="account")


# ---------------------------------------------------------------------------
# Journal Entry + Lines
# ---------------------------------------------------------------------------

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    entry_number = Column(String(50), unique=True, index=True, nullable=False)
    entry_date = Column(Date, nullable=False)
    source_module = Column(String(50), nullable=True)       # sales, feed, slaughter, etc.
    source_reference = Column(String(100), nullable=True)   # INV-0001, GRN-0001, etc.
    reference_type = Column(String(50), nullable=True)      # sale, purchase, slaughter, expense
    reference_id = Column(Integer, nullable=True)           # FK to originating record
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(
        db_enum(JournalEntryStatus, name="journalentrystatus"),
        nullable=False,
        default=JournalEntryStatus.DRAFT,
    )
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    posted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    lines = relationship("JournalLine", back_populates="journal_entry", cascade="all, delete-orphan")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    posted_by = relationship("User", foreign_keys=[posted_by_user_id])


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    debit = Column(Float, nullable=False, default=0.0)
    credit = Column(Float, nullable=False, default=0.0)
    memo = Column(String(255), nullable=True)

    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account", back_populates="journal_lines")


# ---------------------------------------------------------------------------
# Account Templates (COA auto-generation)
# ---------------------------------------------------------------------------

class AccountTemplate(Base):
    """A named COA template (e.g., 'Poultry Starter', 'Layer Farm') used to
    auto-generate a tenant's chart of accounts at signup or via the setup wizard."""

    __tablename__ = "account_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    industry = Column(String(100), nullable=True)           # poultry, hatchery, mixed
    description = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    accounts = relationship("TemplateAccount", back_populates="template", cascade="all, delete-orphan")


class TemplateAccount(Base):
    """A single account definition inside a COA template."""

    __tablename__ = "template_accounts"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("account_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    account_code = Column(String(50), nullable=False)
    name = Column(String(150), nullable=False)
    parent_code = Column(String(50), nullable=True)         # references account_code of parent in same template
    account_type = Column(db_enum(AccountType, name="accounttype"), nullable=False)
    normal_balance = Column(db_enum(NormalBalance, name="normalbalance"), nullable=False, default=NormalBalance.DEBIT)
    description = Column(Text, nullable=True)
    allow_manual_entries = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=True, nullable=False)

    template = relationship("AccountTemplate", back_populates="accounts")


# ---------------------------------------------------------------------------
# Fiscal Years
# ---------------------------------------------------------------------------

class FiscalYear(Base):
    """Represents a financial reporting period for a tenant."""

    __tablename__ = "fiscal_years"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(100), nullable=False)              # e.g., "FY 2025-2026"
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(
        db_enum(FiscalYearStatus, name="fiscalyearstatus"),
        nullable=False,
        default=FiscalYearStatus.OPEN,
    )
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    opening_balances = relationship("OpeningBalance", back_populates="fiscal_year")


# ---------------------------------------------------------------------------
# Opening Balances
# ---------------------------------------------------------------------------

class OpeningBalance(Base):
    """Stores opening debit/credit balances per account per fiscal year.
    Used for migration from legacy systems and for year-start initialization."""

    __tablename__ = "opening_balances"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    fiscal_year_id = Column(Integer, ForeignKey("fiscal_years.id", ondelete="CASCADE"), nullable=True, index=True)
    opening_debit = Column(Float, nullable=False, default=0.0)
    opening_credit = Column(Float, nullable=False, default=0.0)
    opening_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    account = relationship("Account", back_populates="opening_balances")
    fiscal_year = relationship("FiscalYear", back_populates="opening_balances")
