from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.finance_coa import AccountType, JournalEntryStatus


class AccountBase(BaseModel):
    account_code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    account_type: AccountType
    parent_account_id: Optional[int] = None
    is_active: bool = True


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    account_type: Optional[AccountType] = None
    parent_account_id: Optional[int] = None
    is_active: Optional[bool] = None


class AccountOut(AccountBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class JournalLineBase(BaseModel):
    account_id: int
    memo: Optional[str] = None
    debit: float = Field(default=0.0, ge=0)
    credit: float = Field(default=0.0, ge=0)


class JournalLineCreate(JournalLineBase):
    pass


class JournalLineOut(JournalLineBase):
    id: int
    journal_entry_id: int

    class Config:
        from_attributes = True


class JournalEntryBase(BaseModel):
    entry_date: date
    source_module: Optional[str] = None
    source_reference: Optional[str] = None
    description: Optional[str] = None


class JournalEntryCreate(JournalEntryBase):
    lines: List[JournalLineCreate] = Field(min_length=1)


class JournalEntryUpdate(BaseModel):
    entry_date: Optional[date] = None
    description: Optional[str] = None


class JournalEntryOut(JournalEntryBase):
    id: int
    entry_number: str
    status: JournalEntryStatus
    created_at: datetime
    lines: List[JournalLineOut] = []

    class Config:
        from_attributes = True
