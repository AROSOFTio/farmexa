"""Create HR and Payroll tables.

Revision ID: 030_hr_payroll
Revises: 029_performance_indexes
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa


revision = "030_hr_payroll"
down_revision = "029_performance_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Employees table
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("employee_number", sa.String(length=50), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=150), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("national_id", sa.String(length=100), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("gender", sa.String(length=20), nullable=True),
        sa.Column("employment_type", sa.String(length=30), nullable=False, server_default="permanent"),
        sa.Column("job_title", sa.String(length=100), nullable=True),
        sa.Column("department", sa.String(length=100), nullable=True),
        sa.Column("date_joined", sa.Date(), nullable=False),
        sa.Column("date_terminated", sa.Date(), nullable=True),
        sa.Column("basic_salary", sa.Numeric(precision=18, scale=4), nullable=False, server_default="0"),
        sa.Column("bank_name", sa.String(length=100), nullable=True),
        sa.Column("bank_account_number", sa.String(length=100), nullable=True),
        sa.Column("bank_branch", sa.String(length=100), nullable=True),
        sa.Column("nssf_number", sa.String(length=50), nullable=True),
        sa.Column("nhif_number", sa.String(length=50), nullable=True),
        sa.Column("tin_number", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("employee_number", "tenant_id", name="uq_emp_number_tenant"),
    )
    op.create_index(op.f("ix_employees_branch_id"), "employees", ["branch_id"], unique=False)
    op.create_index(op.f("ix_employees_employee_number"), "employees", ["employee_number"], unique=False)
    op.create_index(op.f("ix_employees_id"), "employees", ["id"], unique=False)
    op.create_index(op.f("ix_employees_tenant_id"), "employees", ["tenant_id"], unique=False)

    # 2. Payroll periods table
    op.create_table(
        "payroll_periods",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("period_name", sa.String(length=50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("approved_by_id", sa.Integer(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("payment_reference", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payroll_periods_branch_id"), "payroll_periods", ["branch_id"], unique=False)
    op.create_index(op.f("ix_payroll_periods_id"), "payroll_periods", ["id"], unique=False)
    op.create_index(op.f("ix_payroll_periods_tenant_id"), "payroll_periods", ["tenant_id"], unique=False)

    # 3. Payroll lines table
    op.create_table(
        "payroll_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("payroll_period_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("basic_salary", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("allowances_json", sa.JSON(), nullable=True),
        sa.Column("gross_pay", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("paye_tax", sa.Numeric(precision=18, scale=4), nullable=False, server_default="0"),
        sa.Column("nssf_employee", sa.Numeric(precision=18, scale=4), nullable=False, server_default="0"),
        sa.Column("nssf_employer", sa.Numeric(precision=18, scale=4), nullable=False, server_default="0"),
        sa.Column("nhif_employee", sa.Numeric(precision=18, scale=4), nullable=False, server_default="0"),
        sa.Column("nhif_employer", sa.Numeric(precision=18, scale=4), nullable=False, server_default="0"),
        sa.Column("other_deductions", sa.Numeric(precision=18, scale=4), nullable=False, server_default="0"),
        sa.Column("net_pay", sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column("journal_entry_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["payroll_period_id"], ["payroll_periods.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payroll_lines_employee_id"), "payroll_lines", ["employee_id"], unique=False)
    op.create_index(op.f("ix_payroll_lines_id"), "payroll_lines", ["id"], unique=False)
    op.create_index(op.f("ix_payroll_lines_payroll_period_id"), "payroll_lines", ["payroll_period_id"], unique=False)

    # 4. Leave types table
    op.create_table(
        "leave_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("days_per_year", sa.Integer(), nullable=True, server_default="21"),
        sa.Column("is_paid", sa.Boolean(), nullable=True, server_default="true"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leave_types_tenant_id"), "leave_types", ["tenant_id"], unique=False)

    # 5. Leave requests table
    op.create_table(
        "leave_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("leave_type_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("days_requested", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("approved_by_id", sa.Integer(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["leave_type_id"], ["leave_types.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_leave_requests_employee_id"), "leave_requests", ["employee_id"], unique=False)
    op.create_index(op.f("ix_leave_requests_id"), "leave_requests", ["id"], unique=False)
    op.create_index(op.f("ix_leave_requests_tenant_id"), "leave_requests", ["tenant_id"], unique=False)

    # 6. Attendance records table
    op.create_table(
        "attendance_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.Integer(), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("clock_in", sa.DateTime(timezone=True), nullable=True),
        sa.Column("clock_out", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hours_worked", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_attendance_records_employee_id"), "attendance_records", ["employee_id"], unique=False)
    op.create_index(op.f("ix_attendance_records_id"), "attendance_records", ["id"], unique=False)
    op.create_index(op.f("ix_attendance_records_tenant_id"), "attendance_records", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_table("attendance_records")
    op.drop_table("leave_requests")
    op.drop_table("leave_types")
    op.drop_table("payroll_lines")
    op.drop_table("payroll_periods")
    op.drop_table("employees")
