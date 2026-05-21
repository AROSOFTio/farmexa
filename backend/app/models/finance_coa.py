from datetime import datetime, timezone
import enum

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.enums import db_enum


class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"
    COST_OF_SALES = "cost_of_sales"


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), index=True, nullable=False)
    account_type = Column(db_enum(AccountType, name="accounttype"), nullable=False)
    parent_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    parent = relationship("Account", remote_side=[id], backref="sub_accounts")


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    CANCELLED = "cancelled"


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(50), unique=True, index=True, nullable=False)
    entry_date = Column(Date, nullable=False)
    source_module = Column(String(50), nullable=True)  # sales, inventory, expense, payment etc
    source_reference = Column(String(100), nullable=True)  # INV-XXXX, GRN-XXXX, GIV-XXXX etc
    description = Column(Text, nullable=True)
    status = Column(db_enum(JournalEntryStatus, name="journalentrystatus"), nullable=False, default=JournalEntryStatus.DRAFT)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    lines = relationship("JournalLine", back_populates="journal_entry", cascade="all, delete-orphan")


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    debit = Column(Float, nullable=False, default=0.0)
    credit = Column(Float, nullable=False, default=0.0)
    memo = Column(String(200), nullable=True)

    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account")
