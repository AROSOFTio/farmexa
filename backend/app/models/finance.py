from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Date
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.base import Base

class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    expenses = relationship("Expense", back_populates="category")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("expense_categories.id"), nullable=False)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    reference = Column(String, nullable=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)  # Optional link to farm batch
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    category = relationship("ExpenseCategory", back_populates="expenses")
    batch = relationship("Batch")

class IncomeCategory(Base):
    __tablename__ = "income_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    incomes = relationship("Income", back_populates="category")

class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("income_categories.id"), nullable=False)
    amount = Column(Float, nullable=False)
    income_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    reference = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    category = relationship("IncomeCategory", back_populates="incomes")
