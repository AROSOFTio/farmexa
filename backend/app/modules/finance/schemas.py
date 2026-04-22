from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

class ExpenseCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass

class ExpenseCategoryOut(ExpenseCategoryBase):
    id: int

    class Config:
        from_attributes = True

class ExpenseBase(BaseModel):
    category_id: int
    amount: float
    expense_date: date
    description: Optional[str] = None
    reference: Optional[str] = None
    batch_id: Optional[int] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseOut(ExpenseBase):
    id: int
    created_at: datetime
    category: ExpenseCategoryOut

    class Config:
        from_attributes = True

class IncomeCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class IncomeCategoryCreate(IncomeCategoryBase):
    pass

class IncomeCategoryOut(IncomeCategoryBase):
    id: int

    class Config:
        from_attributes = True

class IncomeBase(BaseModel):
    category_id: int
    amount: float
    income_date: date
    description: Optional[str] = None
    reference: Optional[str] = None

class IncomeCreate(IncomeBase):
    pass

class IncomeOut(IncomeBase):
    id: int
    created_at: datetime
    category: IncomeCategoryOut

    class Config:
        from_attributes = True
