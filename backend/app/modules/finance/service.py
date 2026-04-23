from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.farm import Batch
from app.models.finance import Expense, ExpenseCategory, Income, IncomeCategory

from . import schemas


class FinanceService:
    def get_expenses(self, db: Session, skip: int = 0, limit: int = 100):
        return (
            db.query(Expense)
            .options(joinedload(Expense.category), joinedload(Expense.batch))
            .order_by(Expense.expense_date.desc(), Expense.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_expense(self, db: Session, expense: schemas.ExpenseCreate):
        category = db.query(ExpenseCategory).filter(ExpenseCategory.id == expense.category_id).first()
        if not category:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Expense category not found")

        if expense.batch_id:
            batch = db.query(Batch).filter(Batch.id == expense.batch_id).first()
            if not batch:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch not found")

        db_expense = Expense(**expense.model_dump())
        db.add(db_expense)
        db.commit()
        return (
            db.query(Expense)
            .options(joinedload(Expense.category), joinedload(Expense.batch))
            .filter(Expense.id == db_expense.id)
            .first()
        )

    def get_expense_categories(self, db: Session):
        return db.query(ExpenseCategory).order_by(ExpenseCategory.name.asc()).all()

    def create_expense_category(self, db: Session, category: schemas.ExpenseCategoryCreate):
        db_category = ExpenseCategory(**category.model_dump())
        db.add(db_category)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Expense category already exists")
        db.refresh(db_category)
        return db_category

    def get_incomes(self, db: Session, skip: int = 0, limit: int = 100):
        return (
            db.query(Income)
            .options(joinedload(Income.category))
            .order_by(Income.income_date.desc(), Income.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_income(self, db: Session, income: schemas.IncomeCreate):
        category = db.query(IncomeCategory).filter(IncomeCategory.id == income.category_id).first()
        if not category:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Income category not found")

        db_income = Income(**income.model_dump())
        db.add(db_income)
        db.commit()
        return (
            db.query(Income)
            .options(joinedload(Income.category))
            .filter(Income.id == db_income.id)
            .first()
        )

    def get_income_categories(self, db: Session):
        return db.query(IncomeCategory).order_by(IncomeCategory.name.asc()).all()

    def create_income_category(self, db: Session, category: schemas.IncomeCategoryCreate):
        db_category = IncomeCategory(**category.model_dump())
        db.add(db_category)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Income category already exists")
        db.refresh(db_category)
        return db_category


finance_service = FinanceService()
