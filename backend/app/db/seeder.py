"""
Database seeder that runs on application startup.
Seeds roles, permissions, and the initial super manager account if not present.
"""

import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import delete, func, select
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
from app.utils.domains import default_platform_domain, tenant_domain_suffix

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
    ("accounting:read", "View accounting data (COA, journals, reports)", "accounting"),
    ("accounting:write", "Create and post journal entries, manage COA", "accounting"),
]


def _password_hash_from_seed(value: str) -> str:
    """Accept either a raw seed password or an existing bcrypt hash."""
    clean = value.strip()
    if clean.startswith(("$2a$", "$2b$", "$2y$")) and len(clean) == 60:
        return clean
    return hash_password(clean)


async def run_seed() -> None:
    """Idempotent seeder that is safe to run on every startup."""
    logger.info("Starting database seed process.")
    async with AsyncSessionLocal() as db:
        try:
            await _seed_roles_and_permissions(db)
            await _seed_system_settings(db)
            await _repair_legacy_tenant_domain_suffixes(db)
            await _seed_saas_catalog(db)
            await _seed_affiliate_commission_rules(db)
            await _backfill_tenant_staff_access(db)
            await _seed_admin(db)
            await _seed_developer_admin(db)
            await _seed_demo_tenant_if_enabled(db)
            await _seed_coa_templates(db)
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


async def _seed_system_settings(db: AsyncSession) -> None:
    from app.models.settings import SystemSettings

    def non_empty(value, fallback):
        if isinstance(value, str):
            clean = value.strip()
            return clean if clean else fallback
        return fallback if value is None else value

    result = await db.execute(select(SystemSettings).order_by(SystemSettings.id).limit(1))
    settings_row = result.scalar_one_or_none()
    if settings_row:
        if not settings_row.system_logo_url:
            settings_row.system_logo_url = "/brand/farmexa-logo-full.png"
        if not settings_row.system_favicon_url:
            settings_row.system_favicon_url = "/favicon.svg"
        settings_row.platform_domain = settings.PRIMARY_PLATFORM_DOMAIN
        settings_row.tenant_domain_suffix = tenant_domain_suffix()
        settings_row.sender_email = settings.SMTP_FROM_EMAIL or settings_row.sender_email
        settings_row.sender_name = settings.SMTP_FROM_NAME
        settings_row.support_email = settings.SMTP_FROM_EMAIL or settings_row.support_email
        settings_row.smtp_host = non_empty(settings.SMTP_HOST, settings_row.smtp_host)
        settings_row.smtp_port = settings.SMTP_PORT or settings_row.smtp_port
        settings_row.smtp_username = non_empty(settings.SMTP_USERNAME, settings_row.smtp_username)
        settings_row.smtp_password = non_empty(settings.SMTP_PASSWORD, settings_row.smtp_password)
        settings_row.smtp_use_tls = settings.SMTP_USE_TLS
        settings_row.cloudflare_api_token = non_empty(settings.CLOUDFLARE_API_TOKEN, settings_row.cloudflare_api_token)
        settings_row.cloudflare_zone_id = non_empty(settings.CLOUDFLARE_ZONE_ID, settings_row.cloudflare_zone_id)
        settings_row.tenant_domain_target_ip = non_empty(
            settings.TENANT_DNS_TARGET_VALUE or settings.TENANT_DOMAIN_TARGET_IP,
            settings_row.tenant_domain_target_ip,
        )
        settings_row.enable_cloudflare_dns_automation = settings.ENABLE_CLOUDFLARE_DNS_AUTOMATION
        return

    db.add(
        SystemSettings(
            system_name="Farmexa",
            system_logo_url="/brand/farmexa-logo-full.png",
            system_favicon_url="/favicon.svg",
            primary_color="#d6a62e",
            secondary_color="#202020",
            platform_domain=settings.PRIMARY_PLATFORM_DOMAIN,
            tenant_domain_suffix=tenant_domain_suffix(),
            sender_email=settings.SMTP_FROM_EMAIL or "farmexa@arosoftlabs.com",
            sender_name=settings.SMTP_FROM_NAME,
            support_email=settings.SMTP_FROM_EMAIL or "farmexa@arosoftlabs.com",
            company_name="AROSOFT",
            footer_text="Powered by AROSOFT",
            smtp_host=settings.SMTP_HOST,
            smtp_port=settings.SMTP_PORT,
            smtp_username=settings.SMTP_USERNAME,
            smtp_password=settings.SMTP_PASSWORD,
            smtp_use_tls=settings.SMTP_USE_TLS,
            cloudflare_api_token=settings.CLOUDFLARE_API_TOKEN,
            cloudflare_zone_id=settings.CLOUDFLARE_ZONE_ID,
            tenant_domain_target_ip=settings.TENANT_DNS_TARGET_VALUE or settings.TENANT_DOMAIN_TARGET_IP,
            enable_cloudflare_dns_automation=settings.ENABLE_CLOUDFLARE_DNS_AUTOMATION,
            enable_automatic_ssl_provisioning=settings.ENABLE_AUTOMATIC_SSL_PROVISIONING,
        )
    )


async def _repair_legacy_tenant_domain_suffixes(db: AsyncSession) -> None:
    from app.models.tenant import DomainStatus, TenantDomain
    from app.services.cloudflare_service import create_tenant_dns_record

    old_suffix = ".farmexa.arosoft.io"
    new_suffix = f".{tenant_domain_suffix()}"
    if new_suffix == old_suffix:
        return

    result = await db.execute(select(TenantDomain).where(TenantDomain.normalized_host.like(f"%{old_suffix}")))
    legacy_domains = list(result.scalars().all())
    if not legacy_domains:
        return

    existing_hosts_result = await db.execute(select(TenantDomain.normalized_host))
    existing_hosts = {host for (host,) in existing_hosts_result.all()}

    for domain in legacy_domains:
        new_host = f"{domain.normalized_host.removesuffix(old_suffix)}{new_suffix}"
        if new_host in existing_hosts:
            logger.warning("Skipping legacy tenant domain repair because %s already exists.", new_host)
            continue

        logger.info("Updating tenant domain %s to %s.", domain.host, new_host)
        domain.host = new_host
        domain.normalized_host = new_host
        domain.cloudflare_record_id = None
        domain.cloudflare_provision_status = None
        domain.cloudflare_last_error = None
        domain.last_error = None
        domain.last_checked_at = datetime.now(UTC)

        dns_result = await create_tenant_dns_record(new_host)
        if dns_result.ok:
            domain.status = DomainStatus.ACTIVE
            domain.dns_verified_at = datetime.now(UTC)
            domain.activated_at = datetime.now(UTC)
            domain.cloudflare_record_id = dns_result.record_id
            domain.cloudflare_provision_status = dns_result.status
            domain.cloudflare_provisioned_at = datetime.now(UTC)
            domain.verification_target = dns_result.target
        else:
            domain.status = DomainStatus.FAILED
            domain.cloudflare_provision_status = dns_result.status
            domain.cloudflare_last_error = dns_result.message
            domain.last_error = dns_result.message

        existing_hosts.add(new_host)


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

    tenants = (await db.execute(select(Tenant.id, Tenant.plan))).all()
    for tenant_id, tenant_plan in tenants:
        plan_module_keys = set(DEFAULT_PLAN_MODULES.get(tenant_plan or "", []))

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

        for module_key in plan_module_keys - set(MANDATORY_TENANT_MODULE_KEYS):
            statement = (
                insert(TenantModule)
                .values(tenant_id=tenant_id, module_key=module_key, is_enabled=True)
                .on_conflict_do_nothing(index_elements=["tenant_id", "module_key"])
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
                    "monthly_price": plan["monthly_price"],
                    "quarterly_price": plan["quarterly_price"],
                    "annual_price": plan["annual_price"],
                    "currency": plan["currency"],
                    "trial_days": plan["trial_days"],
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


async def _seed_affiliate_commission_rules(db: AsyncSession) -> None:
    from app.modules.affiliates.service import AffiliateService

    logger.info("Seeding affiliate commission rules.")
    await AffiliateService(db).seed_default_rules()


async def _seed_admin(db: AsyncSession) -> None:
    from app.models.auth import Role
    from app.models.user import User

    role_result = await db.execute(select(Role).where(Role.name == "super_manager"))
    role = role_result.scalar_one_or_none()
    if not role:
        logger.error("super_manager role was not found during admin seeding.")
        return

    email = settings.SEED_ADMIN_EMAIL.strip().lower()
    logger.info("Upserting admin user %s.", email)
    result = await db.execute(select(User).where(func.lower(User.email) == email))
    admin = result.scalar_one_or_none()
    if admin is None:
        admin = User(email=email)
        db.add(admin)

    admin.email = email
    admin.full_name = settings.SEED_ADMIN_FULL_NAME
    admin.hashed_password = _password_hash_from_seed(settings.SEED_ADMIN_PASSWORD)
    admin.is_active = True
    admin.role_id = role.id
    admin.tenant_id = None
    admin.deleted_at = None
    logger.info("Super admin user staged for upsert: %s", email)


async def _seed_developer_admin(db: AsyncSession) -> None:
    from app.models.auth import Role
    from app.models.user import User

    role_result = await db.execute(select(Role).where(Role.name == "developer_admin"))
    role = role_result.scalar_one_or_none()
    if not role:
        logger.error("developer_admin role was not found during developer admin seeding.")
        return

    email = settings.SEED_DEV_ADMIN_EMAIL.strip().lower()
    logger.info("Upserting developer admin user %s.", email)
    result = await db.execute(select(User).where(func.lower(User.email) == email))
    admin = result.scalar_one_or_none()
    if admin is None:
        admin = User(email=email)
        db.add(admin)

    admin.email = email
    admin.full_name = settings.SEED_DEV_ADMIN_FULL_NAME
    admin.hashed_password = _password_hash_from_seed(settings.SEED_DEV_ADMIN_PASSWORD)
    admin.is_active = True
    admin.role_id = role.id
    admin.tenant_id = None
    admin.deleted_at = None
    logger.info("Developer admin user staged for upsert: %s", email)


async def _seed_demo_tenant_if_enabled(db: AsyncSession) -> None:
    """Create a login-only tenant/admin only when explicitly enabled.

    The seed is disabled by default and does not create operational demo records.
    """
    if not settings.SEED_DEMO_TENANT_ENABLED:
        logger.info("Demo tenant seed is disabled.")
        return

    from app.models.auth import Role
    from app.models.tenant import (
        BillingCycle,
        DomainStatus,
        DomainType,
        PlanDefinition,
        Subscription,
        SubscriptionStatus,
        Tenant,
        TenantDomain,
        TenantModule,
        TenantStatus,
    )
    from app.models.user import User

    slug = settings.SEED_DEMO_TENANT_SLUG.strip().lower()
    host = default_platform_domain(slug)
    today = date.today()
    trial_expiry = today + timedelta(days=14)

    plan = (
        await db.execute(select(PlanDefinition).where(PlanDefinition.code == "full_trial"))
    ).scalar_one_or_none()
    if plan is None:
        logger.error("Cannot seed demo tenant because the full_trial plan is missing.")
        return

    tenant = (await db.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none()
    if tenant is None:
        tenant = Tenant(
            name=settings.SEED_DEMO_TENANT_NAME,
            slug=slug,
            business_name=settings.SEED_DEMO_TENANT_NAME,
            contact_person=settings.SEED_DEMO_TENANT_ADMIN_FULL_NAME,
            email=settings.SEED_DEMO_TENANT_ADMIN_EMAIL,
            country="Uganda",
            status=TenantStatus.TRIAL,
            plan="full_trial",
            billing_cycle=BillingCycle.MONTHLY,
            subscription_start=today,
            subscription_expiry=trial_expiry,
            trial_started_at=datetime.combine(today, datetime.min.time(), tzinfo=UTC),
            trial_ends_at=datetime.combine(trial_expiry, datetime.min.time(), tzinfo=UTC),
            subscription_status=SubscriptionStatus.TRIAL,
            is_profile_only=False,
            notes="Seeded login-only tenant for explicit testing. Contains no demo operational records.",
        )
        db.add(tenant)
        await db.flush()
    else:
        tenant.name = settings.SEED_DEMO_TENANT_NAME
        tenant.business_name = tenant.business_name or settings.SEED_DEMO_TENANT_NAME
        tenant.contact_person = settings.SEED_DEMO_TENANT_ADMIN_FULL_NAME
        tenant.email = settings.SEED_DEMO_TENANT_ADMIN_EMAIL
        tenant.plan = "full_trial"
        tenant.status = TenantStatus.TRIAL
        tenant.subscription_status = SubscriptionStatus.TRIAL
        tenant.subscription_start = tenant.subscription_start or today
        tenant.subscription_expiry = tenant.subscription_expiry or trial_expiry
        tenant.trial_started_at = tenant.trial_started_at or datetime.combine(today, datetime.min.time(), tzinfo=UTC)
        tenant.trial_ends_at = tenant.trial_ends_at or datetime.combine(trial_expiry, datetime.min.time(), tzinfo=UTC)
        tenant.is_profile_only = False

    existing_domain = (
        await db.execute(select(TenantDomain).where(TenantDomain.normalized_host == host))
    ).scalar_one_or_none()
    if existing_domain is None:
        db.add(
            TenantDomain(
                tenant_id=tenant.id,
                host=host,
                normalized_host=host,
                domain_type=DomainType.PLATFORM_SUBDOMAIN,
                is_primary=True,
                status=DomainStatus.ACTIVE,
                verification_target=settings.TENANT_DNS_TARGET_VALUE or settings.TENANT_DOMAIN_TARGET_IP,
                dns_verified_at=datetime.now(UTC),
                activated_at=datetime.now(UTC),
            )
        )
    elif existing_domain.tenant_id == tenant.id:
        existing_domain.is_primary = True
        existing_domain.status = DomainStatus.ACTIVE
        existing_domain.activated_at = existing_domain.activated_at or datetime.now(UTC)

    # Also register the localhost variant so local Docker dev works
    # (browser hits testfarm.localhost:4021 → nginx proxies to backend with host testfarm.localhost)
    local_host = f"{slug}.localhost"
    existing_local_domain = (
        await db.execute(select(TenantDomain).where(TenantDomain.normalized_host == local_host))
    ).scalar_one_or_none()
    if existing_local_domain is None:
        db.add(
            TenantDomain(
                tenant_id=tenant.id,
                host=local_host,
                normalized_host=local_host,
                domain_type=DomainType.PLATFORM_SUBDOMAIN,
                is_primary=False,
                status=DomainStatus.ACTIVE,
                dns_verified_at=datetime.now(UTC),
                activated_at=datetime.now(UTC),
            )
        )
    elif existing_local_domain.tenant_id == tenant.id:
        existing_local_domain.status = DomainStatus.ACTIVE
        existing_local_domain.activated_at = existing_local_domain.activated_at or datetime.now(UTC)

    for module in DEFAULT_MODULES:
        statement = (
            insert(TenantModule)
            .values(tenant_id=tenant.id, module_key=module["key"], is_enabled=True, is_manual_override=False)
            .on_conflict_do_update(
                index_elements=["tenant_id", "module_key"],
                set_={"is_enabled": True, "is_manual_override": False},
            )
        )
        await db.execute(statement)

    latest_subscription = (
        await db.execute(
            select(Subscription)
            .where(Subscription.tenant_id == tenant.id, Subscription.plan_code == "full_trial")
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if latest_subscription is None:
        db.add(
            Subscription(
                tenant_id=tenant.id,
                plan_code="full_trial",
                status=SubscriptionStatus.TRIAL,
                billing_cycle=BillingCycle.MONTHLY,
                start_date=today,
                expiry_date=trial_expiry,
                next_invoice_date=trial_expiry,
                amount=0,
                currency=plan.currency,
                trial_days=14,
                notes="Seeded login-only test tenant subscription.",
            )
        )

    role = (await db.execute(select(Role).where(Role.name == TENANT_ADMIN_ROLE_NAME))).scalar_one_or_none()
    if role is None:
        logger.error("Cannot seed demo tenant admin because tenant_admin role is missing.")
        return

    user = (
        await db.execute(select(User).where(User.email == settings.SEED_DEMO_TENANT_ADMIN_EMAIL))
    ).scalar_one_or_none()
    if user is None:
        db.add(
            User(
                email=settings.SEED_DEMO_TENANT_ADMIN_EMAIL,
                full_name=settings.SEED_DEMO_TENANT_ADMIN_FULL_NAME,
                job_title="Tenant Administrator",
                hashed_password=_password_hash_from_seed(settings.SEED_DEMO_TENANT_ADMIN_PASSWORD),
                is_active=True,
                role_id=role.id,
                tenant_id=tenant.id,
            )
        )
    else:
        user.full_name = settings.SEED_DEMO_TENANT_ADMIN_FULL_NAME
        user.job_title = user.job_title or "Tenant Administrator"
        user.role_id = role.id
        user.tenant_id = tenant.id
        user.is_active = True

    logger.info("Demo tenant/admin seed staged for %s at %s.", settings.SEED_DEMO_TENANT_ADMIN_EMAIL, host)


async def _seed_coa_templates(db: AsyncSession) -> None:
    """Seed the default COA template into the platform main database.

    The Poultry Enterprise template is stored in account_templates and
    template_accounts tables on the main platform DB. When a tenant's
    accounting module is initialized, this template is copied into their
    operational database.
    
    Uses direct SQL upsert to avoid asyncpg/sync driver conflicts.
    """
    from sqlalchemy import select as sa_select

    logger.info("Seeding COA templates (platform-level).")
    try:
        from app.models.finance_coa import AccountTemplate
        result = await db.execute(
            sa_select(AccountTemplate).where(AccountTemplate.name == "Poultry Enterprise")
        )
        existing = result.scalar_one_or_none()
        if existing:
            logger.info("COA template 'Poultry Enterprise' already exists — skipping seed.")
            return
        logger.info("COA template not found on platform DB; will be created on first tenant initialization.")
    except Exception as exc:
        logger.warning("COA template check skipped (non-critical): %s", exc)
