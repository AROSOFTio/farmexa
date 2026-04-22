from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_sync_db
from . import schemas, service

router = APIRouter(prefix="/finance", tags=["Finance"])

@router.get("/expenses/categories", response_model=List[schemas.ExpenseCategoryOut])
def list_expense_categories(db: Session = Depends(get_sync_db)):
    return service.finance_service.get_expense_categories(db)

@router.post("/expenses/categories", response_model=schemas.ExpenseCategoryOut)
def create_expense_category(category: schemas.ExpenseCategoryCreate, db: Session = Depends(get_sync_db)):
    return service.finance_service.create_expense_category(db, category)

@router.get("/expenses", response_model=List[schemas.ExpenseOut])
def list_expenses(skip: int = 0, limit: int = 100, db: Session = Depends(get_sync_db)):
    return service.finance_service.get_expenses(db, skip, limit)

@router.post("/expenses", response_model=schemas.ExpenseOut)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_sync_db)):
    return service.finance_service.create_expense(db, expense)

@router.get("/incomes/categories", response_model=List[schemas.IncomeCategoryOut])
def list_income_categories(db: Session = Depends(get_sync_db)):
    return service.finance_service.get_income_categories(db)

@router.post("/incomes/categories", response_model=schemas.IncomeCategoryOut)
def create_income_category(category: schemas.IncomeCategoryCreate, db: Session = Depends(get_sync_db)):
    return service.finance_service.create_income_category(db, category)

@router.get("/incomes", response_model=List[schemas.IncomeOut])
def list_incomes(skip: int = 0, limit: int = 100, db: Session = Depends(get_sync_db)):
    return service.finance_service.get_incomes(db, skip, limit)

@router.post("/incomes", response_model=schemas.IncomeOut)
def create_income(income: schemas.IncomeCreate, db: Session = Depends(get_sync_db)):
    return service.finance_service.create_income(db, income)
