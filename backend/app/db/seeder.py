"""
Database seeder: runs on application startup.
Seeds roles, permissions, and the initial super admin account if not present.
"""

import logging
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.core.config import settings
from app.core.security import hash_password

logger = logging.getLogger("perp.seeder")

# ── Role & Permission seed data ───────────────────────────────

ROLES = [
    {"name": "super_manager",      "description": "Full system access"},
    {"name": "farm_manager",       "description": "Farm and production operations"},
    {"name": "inventory_officer",  "description": "Inventory and stock management"},
    {"name": "sales_officer",      "description": "Sales, customers, and invoices"},
    {"name": "finance_officer",    "description": "Finance, expenses, and reports"},
]

# permission_code: (description, module)
PERMISSIONS = [
    # Dashboard
    ("dashboard:read",            "View dashboard",                     "dashboard"),
    # Farm
    ("farm:read",                 "View farm data",                     "farm"),
    ("farm:write",                "Create/edit farm records",           "farm"),
    ("farm:delete",               "Delete farm records",                "farm"),
    # Feed
    ("feed:read",                 "View feed data",                     "feed"),
    ("feed:write",                "Create/edit feed records",           "feed"),
    ("feed:delete",               "Delete feed records",                "feed"),
    # Slaughter
    ("slaughter:read",            "View slaughter records",             "slaughter"),
    ("slaughter:write",           "Create/edit slaughter records",      "slaughter"),
    ("slaughter:delete",          "Delete slaughter records",           "slaughter"),
    # Inventory
    ("inventory:read",            "View inventory",                     "inventory"),
    ("inventory:write",           "Create/edit inventory records",      "inventory"),
    ("inventory:delete",          "Delete inventory records",           "inventory"),
    # Sales
    ("sales:read",                "View sales and customers",           "sales"),
    ("sales:write",               "Create/edit sales records",         "sales"),
    ("sales:delete",              "Delete sales records",               "sales"),
    # Finance
    ("finance:read",              "View financial records",             "finance"),
    ("finance:write",             "Create/edit financial records",      "finance"),
    ("finance:delete",            "Delete financial records",           "finance"),
    # Reports
    ("reports:read",              "View reports",                       "reports"),
    ("reports:export",            "Export reports",                     "reports"),
    # Settings
    ("settings:read",             "View settings",                      "settings"),
    ("settings:write",            "Edit settings",                      "settings"),
    # Users
    ("users:read",                "View users",                         "users"),
    ("users:write",               "Create/edit users",                  "users"),
    ("users:delete",              "Delete/deactivate users",            "users"),
]

# Map: role name → list of permission codes
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "super_manager": [p[0] for p in PERMISSIONS],  # all permissions
    "farm_manager": [
        "dashboard:read",
        "farm:read", "farm:write",
        "feed:read", "feed:write",
        "slaughter:read", "slaughter:write",
        "inventory:read", "inventory:write",
        "reports:read",
    ],
    "inventory_officer": [
        "dashboard:read",
        "inventory:read", "inventory:write",
        "feed:read", "feed:write",
        "reports:read",
    ],
    "sales_officer": [
        "dashboard:read",
        "sales:read", "sales:write",
        "inventory:read",
        "reports:read",
    ],
    "finance_officer": [
        "dashboard:read",
        "finance:read", "finance:write",
        "sales:read",
        "reports:read", "reports:export",
    ],
}


async def run_seed() -> None:
    """Idempotent seeder — safe to run on every startup."""
    async with AsyncSessionLocal() as db:
        try:
            await _seed_roles_and_permissions(db)
            await _seed_admin(db)
            await db.commit()
            logger.info("Database seed completed successfully.")
        except Exception as exc:
            await db.rollback()
            logger.error(f"Seed failed: {exc}", exc_info=True)


async def _seed_roles_and_permissions(db: AsyncSession) -> None:
    from app.models.auth import Role, Permission, RolePermission

    # Seed permissions safely using INSERT ... ON CONFLICT DO NOTHING
    perm_map: dict[str, Permission] = {}
    for code, description, module in PERMISSIONS:
        stmt = insert(Permission).values(code=code, description=description, module=module).on_conflict_do_nothing(index_elements=['code'])
        await db.execute(stmt)
        result = await db.execute(select(Permission).where(Permission.code == code))
        perm = result.scalar_one()
        perm_map[code] = perm

    # Seed roles safely
    role_map: dict[str, Role] = {}
    for role_data in ROLES:
        stmt = insert(Role).values(**role_data).on_conflict_do_nothing(index_elements=['name'])
        await db.execute(stmt)
        result = await db.execute(select(Role).where(Role.name == role_data["name"]))
        role = result.scalar_one()
        role_map[role_data["name"]] = role

    # Seed role-permission assignments
    for role_name, perm_codes in ROLE_PERMISSIONS.items():
        role = role_map.get(role_name)
        if not role:
            continue
        for code in perm_codes:
            perm = perm_map.get(code)
            if not perm:
                continue
            stmt = insert(RolePermission).values(role_id=role.id, permission_id=perm.id).on_conflict_do_nothing(index_elements=['role_id', 'permission_id'])
            await db.execute(stmt)



async def _seed_admin(db: AsyncSession) -> None:
    from app.models.user import User
    from app.models.auth import Role

    result = await db.execute(
        select(User).where(User.email == settings.SEED_ADMIN_EMAIL)
    )
    if result.scalar_one_or_none() is not None:
        return

    role_result = await db.execute(select(Role).where(Role.name == "super_manager"))
    role = role_result.scalar_one_or_none()
    if not role:
        logger.error("super_manager role not found during admin seed.")
        return

    admin = User(
        email=settings.SEED_ADMIN_EMAIL,
        full_name=settings.SEED_ADMIN_FULL_NAME,
        hashed_password=hash_password(settings.SEED_ADMIN_PASSWORD),
        is_active=True,
        role_id=role.id,
    )
    db.add(admin)
    logger.info(f"Super admin seeded: {settings.SEED_ADMIN_EMAIL}")
