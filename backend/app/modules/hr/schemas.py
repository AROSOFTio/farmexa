from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


# --- Employee Schemas ---
class EmployeeBase(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    national_id: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    employment_type: str = "permanent"
    job_title: Optional[str] = None
    department: Optional[str] = None
    date_joined: date
    date_terminated: Optional[date] = None
    basic_salary: Decimal = Decimal("0")
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_branch: Optional[str] = None
    nssf_number: Optional[str] = None
    nhif_number: Optional[str] = None
    tin_number: Optional[str] = None
    notes: Optional[str] = None
    branch_id: Optional[int] = None
    user_id: Optional[int] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    national_id: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    employment_type: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    date_joined: Optional[date] = None
    date_terminated: Optional[date] = None
    basic_salary: Optional[Decimal] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_branch: Optional[str] = None
    nssf_number: Optional[str] = None
    nhif_number: Optional[str] = None
    tin_number: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    branch_id: Optional[int] = None
    user_id: Optional[int] = None


class EmployeeOut(EmployeeBase):
    id: int
    employee_number: str
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- Payroll Schemas ---
class PayrollPeriodBase(BaseModel):
    period_name: str
    start_date: date
    end_date: date
    branch_id: Optional[int] = None


class PayrollPeriodCreate(PayrollPeriodBase):
    pass


class PayrollPeriodOut(PayrollPeriodBase):
    id: int
    tenant_id: int
    status: str
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    payment_reference: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PayrollLineOut(BaseModel):
    id: int
    payroll_period_id: int
    employee_id: int
    employee: Optional[EmployeeOut] = None
    basic_salary: Decimal
    allowances_json: Optional[Dict[str, Any]] = None
    gross_pay: Decimal
    paye_tax: Decimal
    nssf_employee: Decimal
    nssf_employer: Decimal
    nhif_employee: Decimal
    nhif_employer: Decimal
    other_deductions: Decimal
    net_pay: Decimal
    journal_entry_id: Optional[int] = None

    class Config:
        from_attributes = True


# --- Leave Schemas ---
class LeaveTypeBase(BaseModel):
    name: str
    days_per_year: int = 21
    is_paid: bool = True


class LeaveTypeCreate(LeaveTypeBase):
    pass


class LeaveTypeOut(LeaveTypeBase):
    id: int
    tenant_id: int

    class Config:
        from_attributes = True


class LeaveRequestBase(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    days_requested: int
    reason: Optional[str] = None


class LeaveRequestCreate(LeaveRequestBase):
    # Optional: approvers may file on behalf of staff. When omitted (or when the
    # caller lacks team-leave permission) it resolves to the caller's own record.
    employee_id: Optional[int] = None


class LeaveRejectIn(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class LeaveAdjustIn(BaseModel):
    adjusted_days: int = Field(..., gt=0)
    reason: str = Field(..., min_length=1, max_length=500)


class LeaveRequestOut(LeaveRequestBase):
    id: int
    tenant_id: int
    employee_id: int
    status: str
    manager_note: Optional[str] = None
    adjusted_days: Optional[int] = None
    reviewed_by_id: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    employee: Optional[EmployeeOut] = None
    leave_type: Optional[LeaveTypeOut] = None

    class Config:
        from_attributes = True


# --- Attendance Schemas ---
class AttendanceRecordBase(BaseModel):
    employee_id: int
    branch_id: Optional[int] = None
    date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    hours_worked: Optional[Decimal] = None
    notes: Optional[str] = None


class AttendanceRecordCreate(AttendanceRecordBase):
    pass


class AttendanceRecordOut(AttendanceRecordBase):
    id: int
    tenant_id: int
    employee: Optional[EmployeeOut] = None

    class Config:
        from_attributes = True
