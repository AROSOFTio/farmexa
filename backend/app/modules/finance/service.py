from sqlalchemy.orm import Session
from app.models.finance import Expense, ExpenseCategory, Income, IncomeCategory
from . import schemas

class FinanceService:
    def get_expenses(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(Expense).offset(skip).limit(limit).all()

    def create_expense(self, db: Session, expense: schemas.ExpenseCreate):
        db_expense = Expense(**expense.model_dump())
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)
        return db_expense

    def get_expense_categories(self, db: Session):
        return db.query(ExpenseCategory).all()

    def create_expense_category(self, db: Session, category: schemas.ExpenseCategoryCreate):
        db_cat = ExpenseCategory(**category.model_dump())
        db.add(db_cat)
        db.commit()
        db.refresh(db_cat)
        return db_cat

    def get_incomes(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(Income).offset(skip).limit(limit).all()

    def create_income(self, db: Session, income: schemas.IncomeCreate):
        db_inc = Income(**income.model_dump())
        db.add(db_inc)
        db.commit()
        db.refresh(db_inc)
        return db_inc

    def get_income_categories(self, db: Session):
        return db.query(IncomeCategory).all()

    def create_income_category(self, db: Session, category: schemas.IncomeCategoryCreate):
        db_cat = IncomeCategory(**category.model_dump())
        db.add(db_cat)
        db.commit()
        db.refresh(db_cat)
        return db_cat

finance_service = FinanceService()
