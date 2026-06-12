from typing import List, Optional
from datetime import date
import io

from fastapi import APIRouter, Depends, Query, Response, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.modules.hr import schemas
from app.modules.hr.service import HRService

router = APIRouter(prefix="/hr", tags=["HR & Payroll"])


# --- Employees ---
@router.post("/employees", response_model=schemas.EmployeeOut)
def create_employee(
    payload: schemas.EmployeeCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.create_employee(payload)


@router.get("/employees", response_model=List[schemas.EmployeeOut])
def list_employees(
    branch_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:read")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.list_employees(branch_id=branch_id, is_active=is_active, skip=skip, limit=limit)


@router.get("/employees/{employee_id}", response_model=schemas.EmployeeOut)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:read")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.get_employee(employee_id)


@router.patch("/employees/{employee_id}", response_model=schemas.EmployeeOut)
def update_employee(
    employee_id: int,
    payload: schemas.EmployeeUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.update_employee(employee_id, payload)


@router.delete("/employees/{employee_id}")
def deactivate_employee(
    employee_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    service.deactivate_employee(employee_id)
    return {"message": "Employee deactivated successfully"}


# --- Payroll ---
@router.post("/payroll/periods", response_model=schemas.PayrollPeriodOut)
def create_payroll_period(
    payload: schemas.PayrollPeriodCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.create_payroll_period(payload)


@router.get("/payroll/periods", response_model=List[schemas.PayrollPeriodOut])
def list_payroll_periods(
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:read")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.list_payroll_periods(branch_id=branch_id)


@router.get("/payroll/periods/{period_id}", response_model=schemas.PayrollPeriodOut)
def get_payroll_period(
    period_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:read")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.get_payroll_period(period_id)


@router.post("/payroll/periods/{period_id}/process", response_model=schemas.PayrollPeriodOut)
def process_payroll_period(
    period_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.process_payroll_period(period_id)


@router.post("/payroll/periods/{period_id}/approve", response_model=schemas.PayrollPeriodOut)
def approve_payroll_period(
    period_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
    _=Depends(require_permission("accounting:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.approve_payroll_period(period_id, approved_by_id=current_user.id)


@router.post("/payroll/periods/{period_id}/post-journals")
def post_payroll_journals(
    period_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
    _=Depends(require_permission("accounting:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.post_payroll_journals(period_id, posted_by_id=current_user.id)


@router.get("/payroll/periods/{period_id}/lines", response_model=List[schemas.PayrollLineOut])
def get_payroll_lines(
    period_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:read")),
):
    from app.models.hr import PayrollLine
    from sqlalchemy.orm import joinedload
    lines = db.query(PayrollLine).options(joinedload(PayrollLine.employee)).filter(
        PayrollLine.payroll_period_id == period_id
    ).all()
    return lines


@router.get("/payroll/periods/{period_id}/payslips/{employee_id}.pdf")
def get_payslip_pdf(
    period_id: int,
    employee_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:read")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    pdf_data = service.generate_payslip_pdf(period_id, employee_id)
    return StreamingResponse(io.BytesIO(pdf_data), media_type="application/pdf")


# --- Leave Types ---
@router.get("/leave-types", response_model=List[schemas.LeaveTypeOut])
def list_leave_types(
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:read")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.list_leave_types()


@router.post("/leave-types", response_model=schemas.LeaveTypeOut)
def create_leave_type(
    payload: schemas.LeaveTypeCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.create_leave_type(payload)


# --- Leave Requests ---
@router.get("/leave-requests", response_model=List[schemas.LeaveRequestOut])
def list_leave_requests(
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:read")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.list_leave_requests(employee_id=employee_id, status=status)


@router.post("/leave-requests", response_model=schemas.LeaveRequestOut)
def create_leave_request(
    payload: schemas.LeaveRequestCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.create_leave_request(payload)


@router.patch("/leave-requests/{request_id}/approve", response_model=schemas.LeaveRequestOut)
def approve_leave_request(
    request_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.approve_leave(request_id, approver_id=current_user.id)


@router.patch("/leave-requests/{request_id}/reject", response_model=schemas.LeaveRequestOut)
def reject_leave_request(
    request_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.reject_leave(request_id)


# --- Attendance ---
@router.post("/attendance", response_model=schemas.AttendanceRecordOut)
def record_attendance(
    payload: schemas.AttendanceRecordCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:write")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.record_attendance(payload)


@router.get("/attendance", response_model=List[schemas.AttendanceRecordOut])
def list_attendance(
    employee_id: Optional[int] = Query(None),
    date_filter: Optional[date] = Query(None, alias="date"),
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("hr:read")),
):
    service = HRService(db, tenant_id=current_user.tenant_id)
    return service.list_attendance(employee_id=employee_id, date_filter=date_filter, branch_id=branch_id)
