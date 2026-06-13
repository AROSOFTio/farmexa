from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Any
from datetime import datetime, timezone

PAYE_BANDS_UGX = [
    (0,        235_000,    Decimal("0")),
    (235_001,  335_000,    Decimal("0.10")),
    (335_001,  410_000,    Decimal("0.20")),
    (410_001,  10_000_000, Decimal("0.30")),
    (10_000_001, float("inf"), Decimal("0.40")),
]

NHIF_TIERS = [
    (0,       5_999,      Decimal("0")),
    (6_000,   7_999,      Decimal("400")),
    (8_000,   11_999,     Decimal("600")),
    (12_000,  14_999,     Decimal("800")),
    (15_000,  19_999,     Decimal("1000")),
    (20_000,  24_999,     Decimal("1700")),
    (25_000,  29_999,     Decimal("1800")),
    (30_000,  34_999,     Decimal("1900")),
    (35_000,  39_999,     Decimal("2000")),
    (40_000,  44_999,     Decimal("2100")),
    (45_000,  49_999,     Decimal("2300")),
    (50_000,  59_999,     Decimal("2500")),
    (60_000,  69_999,     Decimal("2750")),
    (70_000,  79_999,     Decimal("3000")),
    (80_000,  89_999,     Decimal("3250")),
    (90_000,  99_999,     Decimal("3500")),
    (100_000, float("inf"), Decimal("3750")),
]

def Q(v) -> Decimal:
    return Decimal(str(v)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

def calculate_paye(monthly_gross: Decimal) -> Decimal:
    gross = float(monthly_gross)
    if gross <= 235_000:
        return Q(0)
    elif gross <= 335_000:
        return Q((gross - 235_000) * 0.10)
    elif gross <= 410_000:
        return Q(100_000 * 0.10 + (gross - 335_000) * 0.20)
    elif gross <= 10_000_000:
        return Q(100_000 * 0.10 + 75_000 * 0.20 + (gross - 410_000) * 0.30)
    else:
        return Q(100_000*0.10 + 75_000*0.20 + 9_590_000*0.30 + (gross - 10_000_000)*0.40)

def calculate_nhif(monthly_gross: Decimal) -> Decimal:
    gross = float(monthly_gross)
    for low, high, amount in NHIF_TIERS:
        if low <= gross <= high:
            return amount
    return Decimal("3750")

class HRService:
    def __init__(self, db, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id

    # --- Employees ---
    def list_employees(self, branch_id=None, is_active=None, skip=0, limit=100):
        from app.models.hr import Employee
        q = self.db.query(Employee).filter(Employee.tenant_id == self.tenant_id)
        if branch_id: q = q.filter(Employee.branch_id == branch_id)
        if is_active is not None: q = q.filter(Employee.is_active == is_active)
        return q.order_by(Employee.full_name).offset(skip).limit(limit).all()

    def get_employee(self, employee_id: int):
        from app.models.hr import Employee
        from fastapi import HTTPException
        emp = self.db.query(Employee).filter(
            Employee.id == employee_id, Employee.tenant_id == self.tenant_id
        ).first()
        if not emp: raise HTTPException(404, "Employee not found")
        return emp

    def create_employee(self, data):
        from app.models.hr import Employee
        emp_number = self._next_employee_number()
        emp = Employee(tenant_id=self.tenant_id, employee_number=emp_number, **data.model_dump())
        self.db.add(emp)
        self.db.commit()
        self.db.refresh(emp)
        return emp

    def update_employee(self, employee_id: int, data):
        emp = self.get_employee(employee_id)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(emp, k, v)
        self.db.commit()
        self.db.refresh(emp)
        return emp

    def deactivate_employee(self, employee_id: int):
        emp = self.get_employee(employee_id)
        emp.is_active = False
        import datetime
        emp.date_terminated = emp.date_terminated or datetime.date.today()
        self.db.commit()

    def _next_employee_number(self) -> str:
        from app.models.hr import Employee
        from sqlalchemy import func
        count = self.db.query(func.count(Employee.id)).filter(
            Employee.tenant_id == self.tenant_id
        ).scalar() or 0
        return f"EMP{str(count + 1).zfill(4)}"

    # --- Payroll ---
    def list_payroll_periods(self, branch_id=None):
        from app.models.hr import PayrollPeriod
        q = self.db.query(PayrollPeriod).filter(PayrollPeriod.tenant_id == self.tenant_id)
        if branch_id: q = q.filter(PayrollPeriod.branch_id == branch_id)
        return q.order_by(PayrollPeriod.start_date.desc()).all()

    def get_payroll_period(self, period_id: int):
        from app.models.hr import PayrollPeriod
        from fastapi import HTTPException
        period = self.db.query(PayrollPeriod).filter(
            PayrollPeriod.id == period_id, PayrollPeriod.tenant_id == self.tenant_id
        ).first()
        if not period: raise HTTPException(404, "Payroll period not found")
        return period

    def create_payroll_period(self, data):
        from app.models.hr import PayrollPeriod
        period = PayrollPeriod(tenant_id=self.tenant_id, **data.model_dump())
        self.db.add(period)
        self.db.commit()
        self.db.refresh(period)
        return period

    def process_payroll_period(self, period_id: int):
        """Calculate all payroll lines for every active employee in the period's branch."""
        from app.models.hr import PayrollPeriod, PayrollLine, Employee
        from fastapi import HTTPException
        period = self.db.query(PayrollPeriod).filter(
            PayrollPeriod.id == period_id, PayrollPeriod.tenant_id == self.tenant_id
        ).first()
        if not period: raise HTTPException(404, "Payroll period not found")
        if period.status not in ("draft", "processing"):
            raise HTTPException(400, "Period cannot be processed in current status")

        # Delete existing lines (idempotent)
        self.db.query(PayrollLine).filter(PayrollLine.payroll_period_id == period_id).delete()

        employees = self.db.query(Employee).filter(
            Employee.tenant_id == self.tenant_id,
            Employee.is_active == True,
            Employee.branch_id == period.branch_id if period.branch_id else True,
        ).all()

        for emp in employees:
            gross = Q(emp.basic_salary or 0)
            paye       = calculate_paye(gross)
            nssf_emp   = Q(gross * Decimal("0.05"))
            nssf_er    = Q(gross * Decimal("0.10"))
            nhif_emp   = calculate_nhif(gross)
            nhif_er    = nhif_emp
            total_deductions = paye + nssf_emp + nhif_emp
            net = Q(gross - total_deductions)
            line = PayrollLine(
                payroll_period_id=period_id,
                employee_id=emp.id,
                basic_salary=gross,
                allowances_json={},
                gross_pay=gross,
                paye_tax=paye,
                nssf_employee=nssf_emp,
                nssf_employer=nssf_er,
                nhif_employee=nhif_emp,
                nhif_employer=nhif_er,
                other_deductions=Decimal("0"),
                net_pay=net,
            )
            self.db.add(line)

        period.status = "processing"
        self.db.commit()
        self.db.refresh(period)
        return period

    def approve_payroll_period(self, period_id: int, approved_by_id: int):
        from app.models.hr import PayrollPeriod
        from fastapi import HTTPException
        period = self.db.query(PayrollPeriod).filter(
            PayrollPeriod.id == period_id, PayrollPeriod.tenant_id == self.tenant_id
        ).first()
        if not period: raise HTTPException(404, "Not found")
        if period.status != "processing":
            raise HTTPException(400, "Period must be in processing status to approve")
        period.status = "approved"
        period.approved_by_id = approved_by_id
        period.approved_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(period)
        return period

    def post_payroll_journals(self, period_id: int, posted_by_id: int):
        """Post journal entries for each payroll line."""
        from app.models.hr import PayrollPeriod, PayrollLine
        from app.services.accounting_service import AccountingService
        from fastapi import HTTPException
        period = self.db.query(PayrollPeriod).filter(
            PayrollPeriod.id == period_id, PayrollPeriod.tenant_id == self.tenant_id
        ).first()
        if not period: raise HTTPException(404, "Not found")
        if period.status != "approved":
            raise HTTPException(400, "Period must be approved before posting journals")

        acct = AccountingService(self.db, tenant_id=self.tenant_id)
        lines = self.db.query(PayrollLine).filter(
            PayrollLine.payroll_period_id == period_id,
            PayrollLine.journal_entry_id.is_(None),
        ).all()

        for line in lines:
            emp = line.employee
            salary_code = acct.get_mapped_account_code("salary_expense",  "6110")
            nssf_er_code = acct.get_mapped_account_code("nssf_employer",  "6140")
            nhif_er_code = acct.get_mapped_account_code("nhif_employer",  "6150")
            net_pay_code = acct.get_mapped_account_code("accrued_salaries","2190")
            paye_code    = acct.get_mapped_account_code("paye_payable",   "2140")
            nssf_code    = acct.get_mapped_account_code("nssf_payable",   "2170")
            nhif_code    = acct.get_mapped_account_code("nhif_payable",   "2180")

            raw_lines = [
                {"account_code": salary_code,  "debit": line.gross_pay,    "credit": Decimal("0"),
                 "memo": f"Gross salary — {emp.full_name}"},
                {"account_code": nssf_er_code, "debit": line.nssf_employer, "credit": Decimal("0"),
                 "memo": f"NSSF employer — {emp.full_name}"},
                {"account_code": nhif_er_code, "debit": line.nhif_employer, "credit": Decimal("0"),
                 "memo": f"NHIF employer — {emp.full_name}"},
                {"account_code": net_pay_code, "debit": Decimal("0"), "credit": line.net_pay,
                 "memo": f"Net pay accrued — {emp.full_name}"},
                {"account_code": paye_code,    "debit": Decimal("0"), "credit": line.paye_tax,
                 "memo": f"PAYE — {emp.full_name}"},
                {"account_code": nssf_code,    "debit": Decimal("0"), "credit": line.nssf_employee + line.nssf_employer,
                 "memo": f"NSSF payable — {emp.full_name}"},
                {"account_code": nhif_code,    "debit": Decimal("0"), "credit": line.nhif_employee + line.nhif_employer,
                 "memo": f"NHIF payable — {emp.full_name}"},
            ]

            active_lines = [rl for rl in raw_lines if rl["debit"] > 0 or rl["credit"] > 0]

            entry = acct.create_journal_entry(
                entry_date=period.end_date,
                description=f"Payroll — {period.period_name} — {emp.full_name}",
                reference_type="payroll",
                reference_id=period_id,
                created_by_user_id=posted_by_id,
            )

            for jl in active_lines:
                acct.add_journal_line(
                    journal_entry=entry,
                    account_code=jl["account_code"],
                    debit=jl["debit"],
                    credit=jl["credit"],
                    memo=jl["memo"],
                    branch_id=period.branch_id,
                )

            acct.post_journal_entry(entry, posted_by_user_id=posted_by_id)
            line.journal_entry_id = entry.id

        period.status = "paid"
        period.paid_at = datetime.now(timezone.utc)
        self.db.commit()
        return {"message": f"Posted {len(lines)} payroll journal entries", "period": period}

    def generate_payslip_pdf(self, period_id: int, employee_id: int) -> bytes:
        """Generate a branded payslip PDF for one employee."""
        from app.models.hr import PayrollPeriod, PayrollLine
        from fastapi import HTTPException
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from io import BytesIO

        period = self.db.query(PayrollPeriod).filter(
            PayrollPeriod.id == period_id, PayrollPeriod.tenant_id == self.tenant_id
        ).first()
        line = self.db.query(PayrollLine).filter(
            PayrollLine.payroll_period_id == period_id,
            PayrollLine.employee_id == employee_id,
        ).first()
        if not period or not line:
            raise HTTPException(404, "Payslip not found")

        emp = line.employee
        buf = BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm,
                                 topMargin=15*mm, bottomMargin=15*mm)
        styles = getSampleStyleSheet()
        BRAND = colors.HexColor("#1D9E75")
        DARK  = colors.HexColor("#1a1a2e")

        def money(v): return f"UGX {float(v or 0):,.2f}"
        def h(text, size=12, bold=True, color=DARK):
            return Paragraph(f"<font size={size} color={color.hexval()}><b>{text}</b></font>", styles["Normal"]) if bold else Paragraph(f"<font size={size} color={color.hexval()}>{text}</font>", styles["Normal"])

        story = []

        # Header
        story.append(h("FARMEXA ERP", 16, color=BRAND))
        story.append(h("PAYSLIP", 13))
        story.append(Spacer(1, 4*mm))

        # Employee details
        emp_data = [
            ["Employee Name:", emp.full_name, "Period:", period.period_name],
            ["Employee No:",   emp.employee_number, "Department:", emp.department or "—"],
            ["Job Title:",     emp.job_title or "—", "Branch:", "—"],
        ]
        t = Table(emp_data, colWidths=[40*mm, 65*mm, 30*mm, 35*mm])
        t.setStyle(TableStyle([
            ("FONTSIZE", (0,0), (-1,-1), 9),
            ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
            ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ]))
        story.append(t)
        story.append(Spacer(1, 5*mm))

        # Earnings
        earnings_data = [["EARNINGS", "", "AMOUNT"],
                         ["Basic Salary", "", money(line.basic_salary)],
                         ["Gross Pay", "", money(line.gross_pay)]]
        et = Table(earnings_data, colWidths=[80*mm, 50*mm, 40*mm])
        et.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), BRAND),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",   (0,0), (-1,-1), 9),
            ("ALIGN",      (2,0), (2,-1), "RIGHT"),
            ("FONTNAME",   (0,-1),(-1,-1), "Helvetica-Bold"),
            ("LINEABOVE",  (0,-1), (-1,-1), 0.5, colors.grey),
        ]))
        story.append(et)
        story.append(Spacer(1, 3*mm))

        # Deductions
        ded_data = [["DEDUCTIONS", "", "AMOUNT"],
                    ["PAYE Tax",             "", money(line.paye_tax)],
                    ["NSSF (Employee 5%)",   "", money(line.nssf_employee)],
                    ["NHIF (Employee)",      "", money(line.nhif_employee)],
                    ["Other Deductions",     "", money(line.other_deductions)],
                    ["Total Deductions",     "", money(line.paye_tax + line.nssf_employee + line.nhif_employee + line.other_deductions)]]
        dt = Table(ded_data, colWidths=[80*mm, 50*mm, 40*mm])
        dt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#E24B4A")),
            ("TEXTCOLOR",  (0,0), (-1,0), colors.white),
            ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",   (0,0), (-1,-1), 9),
            ("ALIGN",      (2,0), (2,-1), "RIGHT"),
            ("FONTNAME",   (0,-1),(-1,-1), "Helvetica-Bold"),
            ("LINEABOVE",  (0,-1), (-1,-1), 0.5, colors.grey),
        ]))
        story.append(dt)
        story.append(Spacer(1, 5*mm))

        # Net Pay
        net_data = [["NET PAY", money(line.net_pay)]]
        nt = Table(net_data, colWidths=[130*mm, 40*mm])
        nt.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), BRAND),
            ("TEXTCOLOR",  (0,0), (-1,-1), colors.white),
            ("FONTNAME",   (0,0), (-1,-1), "Helvetica-Bold"),
            ("FONTSIZE",   (0,0), (-1,-1), 12),
            ("ALIGN",      (1,0), (1,0), "RIGHT"),
            ("TOPPADDING", (0,0),(-1,-1), 5),
            ("BOTTOMPADDING",(0,0),(-1,-1), 5),
        ]))
        story.append(nt)
        story.append(Spacer(1, 8*mm))

        # Employer contributions
        ec_data = [["EMPLOYER CONTRIBUTIONS", "", ""],
                   ["NSSF (Employer 10%)", "", money(line.nssf_employer)],
                   ["NHIF (Employer)",     "", money(line.nhif_employer)]]
        ect = Table(ec_data, colWidths=[80*mm, 50*mm, 40*mm])
        ect.setStyle(TableStyle([
            ("FONTSIZE", (0,0),(-1,-1), 8),
            ("FONTNAME", (0,0),(-1,0), "Helvetica-Bold"),
            ("TEXTCOLOR",(0,0),(-1,0), colors.grey),
        ]))
        story.append(ect)
        story.append(Spacer(1, 15*mm))

        # Signature lines
        sig_data = [["", "Employee Signature", "", "Payroll Officer"]]
        st = Table(sig_data, colWidths=[30*mm, 60*mm, 20*mm, 60*mm])
        st.setStyle(TableStyle([
            ("LINEABOVE", (1,0),(1,0), 0.5, colors.black),
            ("LINEABOVE", (3,0),(3,0), 0.5, colors.black),
            ("FONTSIZE",  (0,0),(-1,-1), 8),
            ("ALIGN",     (0,0),(-1,-1), "CENTER"),
        ]))
        story.append(st)

        doc.build(story)
        return buf.getvalue()

    # --- Leave ---
    def list_leave_types(self):
        from app.models.hr import LeaveType
        return self.db.query(LeaveType).filter(LeaveType.tenant_id == self.tenant_id).all()

    def create_leave_type(self, data):
        from app.models.hr import LeaveType
        lt = LeaveType(tenant_id=self.tenant_id, **data.model_dump())
        self.db.add(lt); self.db.commit(); self.db.refresh(lt); return lt

    def employee_for_user(self, user_id: int):
        """Resolve the Employee record linked to a staff user account (or None)."""
        from app.models.hr import Employee
        if not user_id:
            return None
        return self.db.query(Employee).filter(
            Employee.tenant_id == self.tenant_id, Employee.user_id == user_id
        ).first()

    def list_leave_requests(self, employee_id=None, status=None, restrict_employee_id=None):
        from app.models.hr import LeaveRequest
        from sqlalchemy.orm import joinedload
        q = self.db.query(LeaveRequest).options(
            joinedload(LeaveRequest.employee), joinedload(LeaveRequest.leave_type)
        ).filter(LeaveRequest.tenant_id == self.tenant_id)
        # Self-service callers only ever see their own requests.
        if restrict_employee_id is not None:
            q = q.filter(LeaveRequest.employee_id == restrict_employee_id)
        if employee_id: q = q.filter(LeaveRequest.employee_id == employee_id)
        if status: q = q.filter(LeaveRequest.status == status)
        return q.order_by(LeaveRequest.created_at.desc()).all()

    def create_leave_request(self, data, requester_user_id: int, can_manage: bool):
        from app.models.hr import LeaveRequest
        from fastapi import HTTPException
        payload = data.model_dump()
        requested_employee_id = payload.pop("employee_id", None)
        own = self.employee_for_user(requester_user_id)
        # Approvers/HR may file on behalf of any employee; everyone else (and any
        # request with no explicit employee) is pinned to the caller's own record.
        if can_manage and requested_employee_id:
            employee_id = requested_employee_id
        else:
            if own is None:
                raise HTTPException(
                    400,
                    "Your user account is not linked to an employee record, so leave "
                    "cannot be filed for you. Ask HR to link your staff profile.",
                )
            employee_id = own.id
        req = LeaveRequest(
            tenant_id=self.tenant_id, employee_id=employee_id, status="pending", **payload
        )
        self.db.add(req); self.db.commit(); self.db.refresh(req); return req

    def _get_leave(self, request_id: int):
        from app.models.hr import LeaveRequest
        from fastapi import HTTPException
        req = self.db.query(LeaveRequest).filter(
            LeaveRequest.id == request_id, LeaveRequest.tenant_id == self.tenant_id
        ).first()
        if not req:
            raise HTTPException(404, "Leave request not found")
        return req

    def approve_leave(self, request_id: int, approver_id: int):
        from fastapi import HTTPException
        req = self._get_leave(request_id)
        if req.status not in ("pending", "adjusted"):
            raise HTTPException(400, f"Cannot approve a leave request that is '{req.status}'.")
        req.status = "approved"
        req.reviewed_by_id = approver_id
        req.reviewed_at = datetime.now(timezone.utc)
        req.approved_by_id = approver_id
        req.approved_at = datetime.now(timezone.utc)
        self.db.commit(); self.db.refresh(req); return req

    def reject_leave(self, request_id: int, reviewer_id: int, reason: str):
        from fastapi import HTTPException
        req = self._get_leave(request_id)
        if req.status not in ("pending", "adjusted"):
            raise HTTPException(400, f"Cannot reject a leave request that is '{req.status}'.")
        req.status = "rejected"
        req.manager_note = reason
        req.reviewed_by_id = reviewer_id
        req.reviewed_at = datetime.now(timezone.utc)
        self.db.commit(); self.db.refresh(req); return req

    def adjust_leave(self, request_id: int, reviewer_id: int, adjusted_days: int, reason: str):
        """Supervisor proposes a different day count; requester must accept it."""
        from fastapi import HTTPException
        req = self._get_leave(request_id)
        if req.status != "pending":
            raise HTTPException(400, f"Only a pending request can be adjusted (this one is '{req.status}').")
        req.status = "adjusted"
        req.adjusted_days = adjusted_days
        req.manager_note = reason
        req.reviewed_by_id = reviewer_id
        req.reviewed_at = datetime.now(timezone.utc)
        self.db.commit(); self.db.refresh(req); return req

    def respond_to_adjustment(self, request_id: int, requester_user_id: int, accept: bool):
        """Requester accepts (auto-approves at adjusted days) or declines an adjustment."""
        from fastapi import HTTPException
        req = self._get_leave(request_id)
        if req.status != "adjusted":
            raise HTTPException(400, "This request has no pending day adjustment to respond to.")
        own = self.employee_for_user(requester_user_id)
        if own is None or req.employee_id != own.id:
            raise HTTPException(403, "Only the requester can respond to the proposed adjustment.")
        if accept:
            if req.adjusted_days:
                req.days_requested = req.adjusted_days
            req.status = "approved"
            req.approved_by_id = req.reviewed_by_id
            req.approved_at = datetime.now(timezone.utc)
        else:
            req.status = "cancelled"
        self.db.commit(); self.db.refresh(req); return req

    # --- Attendance ---
    def list_attendance(self, employee_id=None, date_filter=None, branch_id=None):
        from app.models.hr import AttendanceRecord
        from sqlalchemy.orm import joinedload
        q = self.db.query(AttendanceRecord).options(joinedload(AttendanceRecord.employee))\
            .filter(AttendanceRecord.tenant_id == self.tenant_id)
        if employee_id: q = q.filter(AttendanceRecord.employee_id == employee_id)
        if date_filter: q = q.filter(AttendanceRecord.date == date_filter)
        if branch_id: q = q.filter(AttendanceRecord.branch_id == branch_id)
        return q.order_by(AttendanceRecord.date.desc()).all()

    def record_attendance(self, data):
        from app.models.hr import AttendanceRecord
        rec = AttendanceRecord(tenant_id=self.tenant_id, **data.model_dump())
        self.db.add(rec); self.db.commit(); self.db.refresh(rec); return rec
