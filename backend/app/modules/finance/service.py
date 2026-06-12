from datetime import datetime, timezone
import logging

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.farm import Batch
from app.models.finance import Expense, ExpenseCategory, Income, IncomeCategory

from . import schemas

logger = logging.getLogger(__name__)

DEFAULT_EXPENSE_ACCOUNT = "6000"
DEFAULT_INCOME_ACCOUNT = "4000"
DEFAULT_CASH_ACCOUNT = "1100"


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

        batch = None
        if expense.batch_id:
            batch = db.query(Batch).filter(Batch.id == expense.batch_id).first()
            if not batch:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch not found")

        db_expense = Expense(**expense.model_dump())
        db.add(db_expense)
        db.flush()

        expense_account = category.default_account_code or DEFAULT_EXPENSE_ACCOUNT
        description = f"Expense: {category.name} — {expense.description or ''}".strip(" —")
        try:
            from app.services.accounting_service import AccountingService

            tenant_id = getattr(batch, "tenant_id", None) if batch else None
            acct = AccountingService(db, tenant_id=tenant_id)
            acct.record_expense(
                amount=expense.amount,
                expense_account_code=expense_account,
                entry_date=expense.expense_date,
                reference_id=db_expense.id,
                is_cash=True,
                created_by_user_id=None,
                description=description,
                branch_id=batch.house.branch_id if batch and batch.house else None,
                batch_id=expense.batch_id,
            )
        except Exception as exc:
            logger.warning("Failed to auto-post expense journal for expense %s: %s", db_expense.id, exc)

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
        db.flush()

        income_account = category.default_account_code or DEFAULT_INCOME_ACCOUNT
        description = f"Income: {category.name} — {income.description or ''}".strip(" —")
        try:
            from app.services.accounting_service import AccountingService

            acct = AccountingService(db)
            acct.record_income(
                amount=income.amount,
                income_account_code=income_account,
                entry_date=income.income_date,
                reference_id=db_income.id,
                is_cash=True,
                created_by_user_id=None,
                description=description,
            )
        except Exception as exc:
            logger.warning("Failed to auto-post income journal for income %s: %s", db_income.id, exc)

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
