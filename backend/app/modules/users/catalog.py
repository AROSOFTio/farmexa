"""
Role catalog and ordering for platform and tenant staff access.
"""

from __future__ import annotations

PLATFORM_ROLE_NAMES = {"super_manager", "developer_admin"}
TENANT_ADMIN_ROLE_NAME = "tenant_admin"
COMPLIANCE_NOTIFICATION_ROLES = {
    "super_manager",
    "developer_admin",
    "tenant_admin",
    "director",
    "compliance_officer",
    "finance_officer",
}

ROLE_DEFINITIONS = [
    {"name": "super_manager", "description": "Full platform control across every tenant, catalog, billing flow, and system setting."},
    {"name": "developer_admin", "description": "Platform tenancy, plans, modules, onboarding, and billing administration."},
    {"name": "tenant_admin", "description": "Full tenant administration including staff registration, settings, reports, and operational oversight."},
    {"name": "director", "description": "Executive oversight for finance, sales, compliance, staffing, and management reporting."},
    {"name": "farm_manager", "description": "Farm leadership for houses, flocks, feeding, health records, and daily production control."},
    {"name": "operations_officer", "description": "Daily operations execution across farm activities, feed usage, processing, and inventory handoff."},
    {"name": "supervisor", "description": "Operational supervision for houses, flock movements, daily entries, and master-data approval."},
    {"name": "data_entrant", "description": "Structured operational data entry using predefined dropdowns and approved master data."},
    {"name": "attendant", "description": "Restricted flock and daily operation capture under supervisor guidance."},
    {"name": "clerk", "description": "Controlled register entry for operational logs, supporting stock and dispatch workflows."},
    {"name": "production_officer", "description": "Production run capture, yield tracking, cut-part recording, and output inventory updates."},
    {"name": "slaughter_supervisor", "description": "Slaughter scheduling, record capture, yield approval, and processed output posting."},
    {"name": "veterinary_officer", "description": "Bird health, vaccination, medication, mortality follow-up, and welfare monitoring."},
    {"name": "inventory_officer", "description": "Feed, medicine, and stock control including receipts, balances, and stock movements."},
    {"name": "procurement_officer", "description": "Supplier coordination, replenishment planning, and stock availability monitoring."},
    {"name": "sales_officer", "description": "Customers, orders, invoicing, dispatch coordination, and sales follow-up."},
    {"name": "cashier", "description": "Cash collection, payment posting, receipt handling, and day-to-day sales settlement."},
    {"name": "finance_officer", "description": "Expenses, income, payment controls, and financial reporting for the tenant."},
    {"name": "hr_officer", "description": "Dedicated HR and payroll administration: employee records, attendance, leave, and payroll processing."},
    {"name": "compliance_officer", "description": "Compliance documents, expiry follow-up, renewal coordination, and audit readiness."},
    {"name": "support_staff", "description": "Restricted operational support access for supervised day-to-day assistance tasks."},
]

ROLE_DISPLAY_ORDER = [role["name"] for role in ROLE_DEFINITIONS]

# ---------------------------------------------------------------------------
# HR & Payroll access tiers (composed into role permission sets below).
#
#   SELF      every staff member: apply for leave and track their own requests.
#   APPROVER  supervisors/managers: read team leave, approve/reject/adjust, and
#             record attendance for their people.
#   PAYROLL_APPROVE  finance/admin sign-off on payroll runs + journal posting.
#   FULL      dedicated HR officer: every HR capability except they still rely
#             on finance/admin (accounting:write) to post payroll to the ledger.
# ---------------------------------------------------------------------------
HR_LEAVE_SELF = ["hr:leave:request"]
HR_APPROVER = [
    "hr:leave:request",
    "hr:leave:read",
    "hr:leave:approve",
    "hr:attendance:read",
    "hr:attendance:write",
]
HR_READ_ONLY = [
    "hr:leave:request",
    "hr:leave:read",
    "hr:employee:read",
    "hr:attendance:read",
    "hr:payroll:read",
]
HR_FULL = [
    "hr:leave:request",
    "hr:leave:read",
    "hr:leave:approve",
    "hr:employee:read",
    "hr:employee:write",
    "hr:attendance:read",
    "hr:attendance:write",
    "hr:payroll:read",
    "hr:payroll:process",
    "hr:payroll:approve",
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    # ===================== Platform roles =====================
    "super_manager": [
        "dashboard:read",
        "farm:read", "farm:write", "farm:delete",
        "feed:read", "feed:write", "feed:delete",
        "slaughter:read", "slaughter:write", "slaughter:delete",
        "inventory:read", "inventory:write", "inventory:delete",
        "giv:read", "giv:create", "giv:approve", "giv:issue", "giv:cancel",
        "grn:read", "grn:create", "grn:approve", "grn:receive", "grn:cancel",
        "sales:read", "sales:write", "sales:delete",
        "finance:read", "finance:write", "finance:delete",
        "accounting:read", "accounting:write",
        "reports:read", "reports:export",
        "settings:read", "settings:write",
        "branches:read", "branches:write",
        "users:read", "users:write", "users:delete",
        "dev_admin:read", "dev_admin:write",
        "health_safety:read", "health_safety:write",
        "procurement:read", "procurement:write",
        *HR_FULL,
    ],
    "developer_admin": [
        "dashboard:read",
        "reports:read",
        "users:read",
        "dev_admin:read", "dev_admin:write",
    ],
    # ===================== Tenant administration =====================
    "tenant_admin": [
        "dashboard:read",
        "farm:read", "farm:write", "farm:delete",
        "feed:read", "feed:write", "feed:delete",
        "slaughter:read", "slaughter:write", "slaughter:delete",
        "inventory:read", "inventory:write", "inventory:delete",
        "giv:read", "giv:create", "giv:approve", "giv:issue", "giv:cancel",
        "grn:read", "grn:create", "grn:approve", "grn:receive", "grn:cancel",
        "sales:read", "sales:write", "sales:delete",
        "finance:read", "finance:write", "finance:delete",
        "accounting:read", "accounting:write",
        "reports:read", "reports:export",
        "settings:read", "settings:write",
        "branches:read", "branches:write",
        "users:read", "users:write", "users:delete",
        "health_safety:read", "health_safety:write",
        "procurement:read", "procurement:write",
        *HR_FULL,
    ],
    # Executive oversight — read-only across the tenant (plus own leave).
    "director": [
        "dashboard:read",
        "farm:read",
        "feed:read",
        "slaughter:read",
        "inventory:read",
        "sales:read",
        "finance:read",
        "accounting:read",
        "procurement:read",
        "health_safety:read",
        "reports:read", "reports:export",
        "settings:read",
        "branches:read", "branches:write",
        "users:read",
        *HR_READ_ONLY,
    ],
    # ===================== Farm & operations management =====================
    "farm_manager": [
        "dashboard:read",
        "farm:read", "farm:write",
        "feed:read", "feed:write",
        "inventory:read",
        "giv:read", "giv:create", "giv:approve", "giv:issue",
        "health_safety:read", "health_safety:write",
        "reports:read",
        "branches:read", "branches:write",
        *HR_APPROVER,
        "hr:employee:read",
    ],
    "operations_officer": [
        "dashboard:read",
        "farm:read", "farm:write",
        "feed:read", "feed:write",
        "slaughter:read", "slaughter:write",
        "inventory:read",
        "giv:read", "giv:create", "giv:approve", "giv:issue",
        "health_safety:read", "health_safety:write",
        "reports:read",
        *HR_APPROVER,
    ],
    "supervisor": [
        "dashboard:read",
        "farm:read", "farm:write",
        "feed:read", "feed:write",
        "inventory:read",
        "health_safety:read",
        "reports:read",
        *HR_APPROVER,
    ],
    # ===================== Field & data-entry staff =====================
    "data_entrant": [
        "dashboard:read",
        "farm:read", "farm:write",
        "feed:read", "feed:write",
        "inventory:read",
        *HR_LEAVE_SELF,
    ],
    "attendant": [
        "dashboard:read",
        "farm:read", "farm:write",
        "feed:read", "feed:write",
        *HR_LEAVE_SELF,
    ],
    "clerk": [
        "dashboard:read",
        "farm:read", "farm:write",
        "inventory:read",
        "sales:read",
        *HR_LEAVE_SELF,
    ],
    # ===================== Production & slaughter =====================
    "production_officer": [
        "dashboard:read",
        "farm:read",
        "feed:read",
        "slaughter:read", "slaughter:write",
        "inventory:read", "inventory:write",
        "giv:read", "giv:create", "giv:approve", "giv:issue",
        "health_safety:read",
        "reports:read",
        *HR_LEAVE_SELF,
    ],
    "slaughter_supervisor": [
        "dashboard:read",
        "slaughter:read", "slaughter:write",
        "inventory:read", "inventory:write",
        "giv:read", "giv:create", "giv:approve", "giv:issue",
        "health_safety:read", "health_safety:write",
        "reports:read",
        *HR_APPROVER,
    ],
    "veterinary_officer": [
        "dashboard:read",
        "farm:read", "farm:write",
        "feed:read",
        "health_safety:read",
        "reports:read",
        *HR_LEAVE_SELF,
    ],
    # ===================== Inventory & procurement =====================
    "inventory_officer": [
        "dashboard:read",
        "inventory:read", "inventory:write", "inventory:delete",
        "procurement:read", "procurement:write",
        "giv:read", "giv:create", "giv:approve", "giv:issue", "giv:cancel",
        "grn:read", "grn:create", "grn:approve", "grn:receive", "grn:cancel",
        "feed:read", "feed:write",
        "sales:read",
        "reports:read",
        *HR_LEAVE_SELF,
    ],
    "procurement_officer": [
        "dashboard:read",
        "inventory:read", "inventory:write",
        "procurement:read", "procurement:write",
        "grn:read", "grn:create", "grn:approve", "grn:receive", "grn:cancel",
        "feed:read", "feed:write",
        "finance:read",
        "reports:read",
        *HR_LEAVE_SELF,
    ],
    # ===================== Sales & finance =====================
    "sales_officer": [
        "dashboard:read",
        "sales:read", "sales:write", "sales:delete",
        "inventory:read",
        "reports:read",
        *HR_LEAVE_SELF,
    ],
    "cashier": [
        "dashboard:read",
        "sales:read", "sales:write",
        "finance:read", "finance:write",
        "accounting:read",
        "reports:read",
        *HR_LEAVE_SELF,
    ],
    "finance_officer": [
        "dashboard:read",
        "finance:read", "finance:write", "finance:delete",
        "procurement:read", "procurement:write",
        "accounting:read", "accounting:write",
        "sales:read",
        "reports:read", "reports:export",
        "settings:read",
        # Finance signs off payroll and posts the journals (has accounting:write).
        "hr:leave:request",
        "hr:payroll:read",
        "hr:payroll:approve",
    ],
    # ===================== Dedicated HR =====================
    "hr_officer": [
        "dashboard:read",
        *HR_FULL,
    ],
    # ===================== Compliance & support =====================
    "compliance_officer": [
        "dashboard:read",
        "farm:read", "farm:write",
        "health_safety:read", "health_safety:write",
        "reports:read",
        "settings:read",
        *HR_LEAVE_SELF,
    ],
    "support_staff": [
        "dashboard:read",
        "farm:read",
        "feed:read",
        "inventory:read",
        *HR_LEAVE_SELF,
    ],
}


def role_sort_key(role_name: str) -> tuple[int, str]:
    try:
        return (ROLE_DISPLAY_ORDER.index(role_name), role_name)
    except ValueError:
        return (len(ROLE_DISPLAY_ORDER), role_name)
