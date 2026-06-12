from datetime import date
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.hr import Employee, PayrollPeriod, PayrollLine, LeaveType, LeaveRequest, AttendanceRecord, EmploymentType, PayrollStatus
from app.models.finance_coa import Account, FiscalYear, JournalEntry, JournalLine, AccountType, NormalBalance
from app.modules.hr.service import HRService, calculate_paye
from app.modules.hr.schemas import EmployeeCreate, PayrollPeriodCreate, LeaveTypeCreate, LeaveRequestCreate, AttendanceRecordCreate

TENANT_ID = 1

@pytest.fixture()
def hr_db_session():
    engine = create_engine("sqlite:///:memory:")
    tables = [
        Account.__table__,
        FiscalYear.__table__,
        JournalEntry.__table__,
        JournalLine.__table__,
        Employee.__table__,
        PayrollPeriod.__table__,
        PayrollLine.__table__,
        LeaveType.__table__,
        LeaveRequest.__table__,
        AttendanceRecord.__table__,
    ]
    for table in tables:
        table.create(bind=engine, checkfirst=True)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    try:
        # Create default COA and system account mappings if needed
        # We'll mock the AccountingService parts or set up the minimum accounts
        yield session
    finally:
        session.close()
        for table in reversed(tables):
            table.drop(bind=engine, checkfirst=True)

def _make_account(db: Session, code: str, name: str, account_type: AccountType, normal_balance: NormalBalance) -> Account:
    account = Account(
        tenant_id=TENANT_ID,
        account_code=code,
        name=name,
        account_type=account_type,
        normal_balance=normal_balance,
        is_active=True,
        allow_manual_entries=True,
        is_system=False,
    )
    db.add(account)
    db.flush()
    return account

def test_uganda_paye_bounds():
    # gross <= 235k
    assert calculate_paye(Decimal("200000")) == Decimal("0")
    # gross <= 335k: 10% of gross exceeding 235k
    assert calculate_paye(Decimal("285000")) == Decimal("5000")
    # gross <= 410k: 10k + 20% of gross exceeding 335k
    assert calculate_paye(Decimal("350000")) == Decimal("13000")
    # gross <= 10M: 25k + 30% of gross exceeding 410k
    assert calculate_paye(Decimal("450000")) == Decimal("37000")
    # gross > 10M: 25k + 30% of gross exceeding 410k + 10% of gross exceeding 10M
    assert calculate_paye(Decimal("11000000")) == Decimal("25000") + Decimal("0.3") * Decimal("10590000") + Decimal("0.1") * Decimal("1000000")

def test_create_and_list_employees(hr_db_session: Session):
    service = HRService(hr_db_session, tenant_id=TENANT_ID)
    
    emp_data = EmployeeCreate(
        full_name="John Doe",
        email="john.doe@example.com",
        phone="+256770000000",
        gender="male",
        date_of_birth=date(1990, 1, 1),
        national_id="UG123456",
        nssf_number="NSSF98765",
        tin_number="TIN112233",
        date_joined=date(2025, 1, 1),
        employment_type=EmploymentType.PERMANENT,
        job_title="Manager",
        department="Operations",
        basic_salary=Decimal("1500000.00"),
        bank_name="Stanbic Bank",
        bank_account_number="0123456789",
    )
    
    emp = service.create_employee(emp_data)
    assert emp.id is not None
    assert emp.full_name == "John Doe"
    assert emp.basic_salary == Decimal("1500000.00")
    
    employees = service.list_employees()
    assert len(employees) == 1
    assert employees[0].full_name == "John Doe"

def test_attendance_and_leaves(hr_db_session: Session):
    service = HRService(hr_db_session, tenant_id=TENANT_ID)
    
    # Create employee
    emp = service.create_employee(EmployeeCreate(
        full_name="Jane Doe", email="jane.doe@example.com", phone="+256770000001",
        gender="female", date_of_birth=date(1992, 2, 2), national_id="UG654321", date_joined=date(2025, 1, 1),
        employment_type=EmploymentType.PERMANENT, job_title="Accountant", basic_salary=Decimal("2000000.00")
    ))
    
    # Record Attendance
    att = service.record_attendance(AttendanceRecordCreate(
        employee_id=emp.id,
        date=date(2026, 6, 1),
        clock_in=None,
        clock_out=None,
        notes="On time"
    ))
    assert att.id is not None
    
    records = service.list_attendance(date_filter=date(2026, 6, 1))
    assert len(records) == 1
    
    # Leave Type
    lt = service.create_leave_type(LeaveTypeCreate(
        name="Annual Leave",
        days_per_year=21,
        is_paid=True
    ))
    assert lt.id is not None
    
    # Leave Request
    req = service.create_leave_request(LeaveRequestCreate(
        employee_id=emp.id,
        leave_type_id=lt.id,
        start_date=date(2026, 6, 10),
        end_date=date(2026, 6, 15),
        days_requested=5,
        reason="Vacation"
    ))
    assert req.id is not None
    assert req.status == "pending"
    
    # Approve Leave
    approved = service.approve_leave(req.id, approver_id=99)
    assert approved.status == "approved"
    assert approved.approved_by_id == 99
