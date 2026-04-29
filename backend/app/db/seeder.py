"""
Database seeder that runs on application startup.
Seeds roles, permissions, and the initial super manager account if not present.
"""

import logging

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.modules.developer_admin.catalog import (
    DEFAULT_MODULE_PRICES,
    DEFAULT_MODULES,
    MANDATORY_TENANT_MODULE_KEYS,
    DEFAULT_PLAN_MODULES,
    DEFAULT_PLANS,
)
from app.modules.users.catalog import ROLE_DEFINITIONS, ROLE_PERMISSIONS, TENANT_ADMIN_ROLE_NAME

logger = logging.getLogger("farmexa.seeder")

ROLES = ROLE_DEFINITIONS

PERMISSIONS = [
    ("dashboard:read", "View dashboard", "dashboard"),
    ("farm:read", "View farm data", "farm"),
    ("farm:write", "Create/edit farm records", "farm"),
    ("farm:delete", "Delete farm records", "farm"),
    ("feed:read", "View feed data", "feed"),
    ("feed:write", "Create/edit feed records", "feed"),
    ("feed:delete", "Delete feed records", "feed"),
    ("slaughter:read", "View slaughter records", "slaughter"),
    ("slaughter:write", "Create/edit slaughter records", "slaughter"),
    ("slaughter:delete", "Delete slaughter records", "slaughter"),
    ("inventory:read", "View inventory", "inventory"),
    ("inventory:write", "Create/edit inventory records", "inventory"),
    ("inventory:delete", "Delete inventory records", "inventory"),
    ("sales:read", "View sales and customers", "sales"),
    ("sales:write", "Create/edit sales records", "sales"),
    ("sales:delete", "Delete sales records", "sales"),
    ("finance:read", "View financial records", "finance"),
    ("finance:write", "Create/edit financial records", "finance"),
    ("finance:delete", "Delete financial records", "finance"),
    ("reports:read", "View reports", "reports"),
    ("reports:export", "Export reports", "reports"),
    ("settings:read", "View settings", "settings"),
    ("settings:write", "Edit settings", "settings"),
    ("users:read", "View users", "users"),
    ("users:write", "Create/edit users", "users"),
    ("users:delete", "Delete/deactivate users", "users"),
    ("dev_admin:read", "View developer admin workspace", "developer_admin"),
    ("dev_admin:write", "Manage tenants, plans, and modules", "developer_admin"),
]

async def run_seed() -> None:
    """Idempotent seeder that is safe to run on every startup."""
    logger.info("Starting database seed process.")
    async with AsyncSessionLocal() as db:
        try:
            await _seed_roles_and_permissions(db)
            await _seed_saas_catalog(db)
            await _backfill_tenant_staff_access(db)
            await _seed_admin(db)
            await _seed_developer_admin(db)
            await db.commit()
            logger.info("Database seed completed successfully.")
        except Exception as exc:
            await db.rollback()
            logger.exception("Database seed failed: %s", exc)


async def _seed_roles_and_permissions(db: AsyncSession) -> None:
    from app.models.auth import Permission, Role, RolePermission

    logger.info("Seeding permissions.")
    permission_map = {}
    for code, description, module in PERMISSIONS:
        statement = (
            insert(Permission)
            .values(code=code, description=description, module=module)
            .on_conflict_do_update(
                index_elements=["code"],
                set_={
                    "description": description,
                    "module": module,
                },
            )
        )
        await db.execute(statement)

        result = await db.execute(select(Permission).where(Permission.code == code))
        permission = result.scalar_one()
        permission_map[code] = permission

    logger.info("Seeding roles.")
    role_map = {}
    for role_data in ROLES:
        statement = (
            insert(Role)
            .values(**role_data)
            .on_conflict_do_update(
                index_elements=["name"],
                set_={"description": role_data["description"]},
            )
        )
        await db.execute(statement)

        result = await db.execute(select(Role).where(Role.name == role_data["name"]))
        role = result.scalar_one()
        role_map[role_data["name"]] = role

    logger.info("Seeding role-permission mappings.")
    for role_name, permission_codes in ROLE_PERMISSIONS.items():
        role = role_map.get(role_name)
        if not role:
            continue

        target_permission_ids = {
            permission_map[code].id
            for code in permission_codes
            if code in permission_map
        }

        current_permission_ids = set(
            (
                await db.execute(
                    select(RolePermission.permission_id).where(RolePermission.role_id == role.id)
                )
            ).scalars().all()
        )

        for permission_id in current_permission_ids - target_permission_ids:
            await db.execute(
                delete(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == permission_id,
                )
            )

        for code in permission_codes:
            permission = permission_map.get(code)
            if not permission:
                continue

            statement = (
                insert(RolePermission)
                .values(role_id=role.id, permission_id=permission.id)
                .on_conflict_do_nothing(index_elements=["role_id", "permission_id"])
            )
            await db.execute(statement)


async def _backfill_tenant_staff_access(db: AsyncSession) -> None:
    from app.models.auth import Role
    from app.models.tenant import Tenant, TenantModule
    from app.models.user import User

    logger.info("Backfilling tenant staff administration access.")

    tenant_admin_role = (
        await db.execute(select(Role).where(Role.name == TENANT_ADMIN_ROLE_NAME))
    ).scalar_one_or_none()
    farm_manager_role = (
        await db.execute(select(Role).where(Role.name == "farm_manager"))
    ).scalar_one_or_none()

    if tenant_admin_role and farm_manager_role:
        tenant_admin_users = (
            await db.execute(
                select(User, Tenant)
                .join(Tenant, Tenant.id == User.tenant_id)
                .where(
                    User.deleted_at.is_(None),
                    User.email == Tenant.email,
                    User.role_id == farm_manager_role.id,
                )
            )
        ).all()
        for user, _tenant in tenant_admin_users:
            user.role_id = tenant_admin_role.id
            if not user.job_title:
                user.job_title = "Tenant Administrator"

    tenants = (await db.execute(select(Tenant.id))).scalars().all()
    for tenant_id in tenants:
        for module_key in MANDATORY_TENANT_MODULE_KEYS:
            statement = (
                insert(TenantModule)
                .values(tenant_id=tenant_id, module_key=module_key, is_enabled=True)
                .on_conflict_do_update(
                    index_elements=["tenant_id", "module_key"],
                    set_={"is_enabled": True},
                )
            )
            await db.execute(statement)


async def _seed_saas_catalog(db: AsyncSession) -> None:
    from app.models.tenant import ModulePrice, PlanDefinition, PlanModule, PlatformModule

    logger.info("Seeding SaaS catalog.")

    for module in DEFAULT_MODULES:
        statement = (
            insert(PlatformModule)
            .values(**module)
            .on_conflict_do_update(
                index_elements=["key"],
                set_={
                    "name": module["name"],
                    "category": module["category"],
                    "description": module["description"],
                    "is_core": module["is_core"],
                    "is_active": True,
                },
            )
        )
        await db.execute(statement)

    for plan in DEFAULT_PLANS:
        statement = (
            insert(PlanDefinition)
            .values(**plan)
            .on_conflict_do_update(
                index_elements=["code"],
                set_={
                    "name": plan["name"],
                    "description": plan["description"],
                    "billing_cycle": plan["billing_cycle"],
                    "is_custom": plan["is_custom"],
                    "is_active": True,
                },
            )
        )
        await db.execute(statement)

    for plan_code, modules in DEFAULT_PLAN_MODULES.items():
        for module_key in modules:
            statement = (
                insert(PlanModule)
                .values(plan_code=plan_code, module_key=module_key, is_included=True)
                .on_conflict_do_nothing(index_elements=["plan_code", "module_key"])
            )
            await db.execute(statement)

    for price in DEFAULT_MODULE_PRICES:
        statement = (
            insert(ModulePrice)
            .values(**price)
            .on_conflict_do_update(
                index_elements=["module_key", "billing_cycle"],
                set_={
                    "price": price["price"],
                    "currency": price["currency"],
                    "notes": price["notes"],
                },
            )
        )
        await db.execute(statement)


async def _seed_admin(db: AsyncSession) -> None:
    from app.models.auth import Role
    from app.models.user import User

    logger.info("Checking for admin user %s.", settings.SEED_ADMIN_EMAIL)
    result = await db.execute(select(User).where(User.email == settings.SEED_ADMIN_EMAIL))
    if result.scalar_one_or_none() is not None:
        logger.info("Admin user already exists.")
        return

    role_result = await db.execute(select(Role).where(Role.name == "super_manager"))
    role = role_result.scalar_one_or_none()
    if not role:
        logger.error("super_manager role was not found during admin seeding.")
        return

    admin = User(
        email=settings.SEED_ADMIN_EMAIL,
        full_name=settings.SEED_ADMIN_FULL_NAME,
        hashed_password=hash_password(settings.SEED_ADMIN_PASSWORD),
        is_active=True,
        role_id=role.id,
    )
    db.add(admin)
    logger.info("Super admin user staged for creation: %s", settings.SEED_ADMIN_EMAIL)


async def _seed_developer_admin(db: AsyncSession) -> None:
    from app.models.auth import Role
    from app.models.user import User

    logger.info("Checking for developer admin user %s.", settings.SEED_DEV_ADMIN_EMAIL)
    result = await db.execute(select(User).where(User.email == settings.SEED_DEV_ADMIN_EMAIL))
    if result.scalar_one_or_none() is not None:
        logger.info("Developer admin user already exists.")
        return

    role_result = await db.execute(select(Role).where(Role.name == "developer_admin"))
    role = role_result.scalar_one_or_none()
    if not role:
        logger.error("developer_admin role was not found during developer admin seeding.")
        return

    admin = User(
        email=settings.SEED_DEV_ADMIN_EMAIL,
        full_name=settings.SEED_DEV_ADMIN_FULL_NAME,
        hashed_password=hash_password(settings.SEED_DEV_ADMIN_PASSWORD),
        is_active=True,
        role_id=role.id,
    )
    db.add(admin)
    logger.info("Developer admin user staged for creation: %s", settings.SEED_DEV_ADMIN_EMAIL)
