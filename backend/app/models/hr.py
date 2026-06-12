"""HR & Payroll models for Farmexa ERP."""
from __future__ import annotations
import enum
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer,
    Numeric, String, Text, JSON, UniqueConstraint,
)
from sqlalchemy.orm import relationship, Mapped
from app.db.base import Base


def _now(): return datetime.now(timezone.utc)


class EmploymentType(str, enum.Enum):
    PERMANENT = "permanent"
    CASUAL    = "casual"
    CONTRACT  = "contract"
    INTERN    = "intern"


class Gender(str, enum.Enum):
    MALE   = "male"
    FEMALE = "female"
    OTHER  = "other"


class PayrollStatus(str, enum.Enum):
    DRAFT      = "draft"
    PROCESSING = "processing"
    APPROVED   = "approved"
    PAID       = "paid"
    CLOSED     = "closed"


class LeaveStatus(str, enum.Enum):
    PENDING   = "pending"
    APPROVED  = "approved"
    REJECTED  = "rejected"
    CANCELLED = "cancelled"


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("employee_number", "tenant_id", name="uq_emp_number_tenant"),
    )
    id               = Column(Integer, primary_key=True, index=True)
    tenant_id        = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id        = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    employee_number  = Column(String(50), nullable=False, index=True)
    full_name        = Column(String(150), nullable=False)
    email            = Column(String(150), nullable=True)
    phone            = Column(String(50), nullable=True)
    national_id      = Column(String(100), nullable=True)   # store plain for now
    date_of_birth    = Column(Date, nullable=True)
    gender           = Column(String(20), nullable=True)
    employment_type  = Column(String(30), nullable=False, default="permanent")
    job_title        = Column(String(100), nullable=True)
    department       = Column(String(100), nullable=True)
    date_joined      = Column(Date, nullable=False)
    date_terminated  = Column(Date, nullable=True)
    basic_salary     = Column(Numeric(18, 4), nullable=False, default=0)
    bank_name        = Column(String(100), nullable=True)
    bank_account_number = Column(String(100), nullable=True)
    bank_branch      = Column(String(100), nullable=True)
    nssf_number      = Column(String(50), nullable=True)
    nhif_number      = Column(String(50), nullable=True)
    tin_number       = Column(String(50), nullable=True)
    notes            = Column(Text, nullable=True)
    is_active        = Column(Boolean, default=True, nullable=False)
    created_at       = Column(DateTime(timezone=True), default=_now)
    updated_at       = Column(DateTime(timezone=True), default=_now, onupdate=_now)
    
    payroll_lines    = relationship("PayrollLine", back_populates="employee")
    leave_requests   = relationship("LeaveRequest", back_populates="employee")
    attendance       = relationship("AttendanceRecord", back_populates="employee")


class PayrollPeriod(Base):
    __tablename__ = "payroll_periods"
    id                = Column(Integer, primary_key=True, index=True)
    tenant_id         = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id         = Column(Integer, ForeignKey("branches.id"), nullable=True, index=True)
    period_name       = Column(String(50), nullable=False)
    start_date        = Column(Date, nullable=False)
    end_date          = Column(Date, nullable=False)
    status            = Column(String(20), nullable=False, default="draft")
    approved_by_id    = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at       = Column(DateTime(timezone=True), nullable=True)
    paid_at           = Column(DateTime(timezone=True), nullable=True)
    payment_reference = Column(String(100), nullable=True)
    created_at        = Column(DateTime(timezone=True), default=_now)
    
    lines = relationship("PayrollLine", back_populates="period", cascade="all, delete-orphan")


class PayrollLine(Base):
    __tablename__ = "payroll_lines"
    id                = Column(Integer, primary_key=True, index=True)
    payroll_period_id = Column(Integer, ForeignKey("payroll_periods.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id       = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    basic_salary      = Column(Numeric(18, 4), nullable=False)
    allowances_json   = Column(JSON, default=dict)
    gross_pay         = Column(Numeric(18, 4), nullable=False)
    paye_tax          = Column(Numeric(18, 4), nullable=False, default=0)
    nssf_employee     = Column(Numeric(18, 4), nullable=False, default=0)
    nssf_employer     = Column(Numeric(18, 4), nullable=False, default=0)
    nhif_employee     = Column(Numeric(18, 4), nullable=False, default=0)
    nhif_employer     = Column(Numeric(18, 4), nullable=False, default=0)
    other_deductions  = Column(Numeric(18, 4), nullable=False, default=0)
    net_pay           = Column(Numeric(18, 4), nullable=False)
    journal_entry_id  = Column(Integer, nullable=True)
    
    period   = relationship("PayrollPeriod", back_populates="lines")
    employee = relationship("Employee", back_populates="payroll_lines")


class LeaveType(Base):
    __tablename__ = "leave_types"
    id            = Column(Integer, primary_key=True)
    tenant_id     = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name          = Column(String(100), nullable=False)
    days_per_year = Column(Integer, default=21)
    is_paid       = Column(Boolean, default=True)


class LeaveRequest(Base):
    __tablename__ = "leave_requests"
    id             = Column(Integer, primary_key=True, index=True)
    tenant_id      = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id    = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    leave_type_id  = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    start_date     = Column(Date, nullable=False)
    end_date       = Column(Date, nullable=False)
    days_requested = Column(Integer, nullable=False)
    reason         = Column(Text, nullable=True)
    status         = Column(String(20), nullable=False, default="pending")
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at    = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), default=_now)
    
    employee   = relationship("Employee", back_populates="leave_requests")
    leave_type = relationship("LeaveType")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    id           = Column(Integer, primary_key=True, index=True)
    tenant_id    = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id  = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id    = Column(Integer, ForeignKey("branches.id"), nullable=True)
    date         = Column(Date, nullable=False)
    clock_in     = Column(DateTime(timezone=True), nullable=True)
    clock_out    = Column(DateTime(timezone=True), nullable=True)
    hours_worked = Column(Numeric(6, 2), nullable=True)
    notes        = Column(Text, nullable=True)
    
    employee = relationship("Employee", back_populates="attendance")
