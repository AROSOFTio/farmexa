"""
Developer Admin service for tenancy, plans, domains, activity, and plan-driven module access.
"""

from __future__ import annotations

import logging
import re
import secrets
import subprocess
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Iterable

from fastapi import HTTPException, Request
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import hash_password
from app.db.tenant_db import provision_tenant_operational_database
from app.models.auth import AuditLog, Role
from app.models.settings import SystemSettings
from app.models.tenant import (
    BillingCycle,
    DomainStatus,
    DomainType,
    ModulePrice,
    PlanDefinition,
    PlanModule,
    PlatformModule,
    Subscription,
    SubscriptionHistory,
    SubscriptionStatus,
    Tenant,
    TenantDomain,
    TenantModule,
    TenantStatus,
)
from app.models.user import User
from app.modules.auth.schemas import TenantRegistrationOut, TenantRegistrationRequest
from app.modules.developer_admin.catalog import MANDATORY_TENANT_MODULE_KEYS
from app.modules.developer_admin.schemas import (
    ActivityLogOut,
    DeveloperAdminSettingsOut,
    DomainAssignRequest,
    ModulePriceUpdate,
    ModuleToggle,
    PlanChange,
    PlanCreate,
    PlanOut,
    PlanStatusUpdate,
    PlanUpdate,
    SuspendRequest,
    TenantAdminCredentialOut,
    TenantCreate,
    TenantModuleOut,
    TenantUpdate,
)
from app.modules.users.catalog import TENANT_ADMIN_ROLE_NAME
from app.utils.audit import write_audit_log
from app.utils.domains import infer_domain_type, normalize_host, strip_port, verify_domain_points_to_target
from app.services.cloudflare_service import create_tenant_dns_record
from app.services.email_service import send_welcome_email


logger = logging.getLogger("farmexa.developer_admin")


class DeveloperAdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _tenant_query(self):
        return select(Tenant).options(
            selectinload(Tenant.modules).selectinload(TenantModule.module),
            selectinload(Tenant.domains),
            selectinload(Tenant.subscriptions),
        )

    @staticmethod
    def _slugify(value: str) -> str:
        normalized = re.sub(r"\b(poultry|farm|farms|limited|ltd|company|co|erp)\b", " ", value.lower())
        return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")

    @staticmethod
    def _normalize_plan_code(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")

    @staticmethod
    def _parse_billing_cycle(value: str) -> BillingCycle:
        try:
            return BillingCycle(value)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid billing cycle.") from exc

    @staticmethod
    def _clean_host(host: str | None) -> str | None:
        clean = strip_port(host)
        return clean.lower() if clean else None

    @staticmethod
    def _domain_type_for(host: str) -> DomainType:
        return DomainType(infer_domain_type(host))

    @staticmethod
    def _build_temp_password() -> str:
        return f"Farmexa{secrets.token_hex(4).upper()}9"

    @staticmethod
    def _enum_value(value):
        return value.value if hasattr(value, "value") else value

    @staticmethod
    def _billing_cycle_days(cycle: BillingCycle) -> int:
        if cycle == BillingCycle.QUARTERLY:
            return 90
        if cycle == BillingCycle.ANNUAL:
            return 365
        return 30

    @staticmethod
    def _monthly_revenue_equivalent(plan: PlanDefinition, cycle: BillingCycle) -> Decimal:
        monthly = Decimal(str(plan.monthly_price or 0))
        quarterly = Decimal(str(plan.quarterly_price or 0))
        annual = Decimal(str(plan.annual_price or 0))
        if cycle == BillingCycle.QUARTERLY:
            return quarterly / Decimal("3")
        if cycle == BillingCycle.ANNUAL:
            return annual / Decimal("12")
        return monthly

    @staticmethod
    def _price_for_cycle(plan: PlanDefinition, cycle: BillingCycle) -> Decimal:
        if cycle == BillingCycle.QUARTERLY:
            return Decimal(str(plan.quarterly_price or 0))
        if cycle == BillingCycle.ANNUAL:
            return Decimal(str(plan.annual_price or 0))
        return Decimal(str(plan.monthly_price or 0))

    @staticmethod
    def _subscription_status_for(*, is_suspended: bool, expiry_date: date | None, is_trial: bool) -> SubscriptionStatus:
        if is_suspended:
            return SubscriptionStatus.SUSPENDED
        if expiry_date and expiry_date < date.today():
            return SubscriptionStatus.EXPIRED
        if is_trial:
            return SubscriptionStatus.TRIAL
        return SubscriptionStatus.ACTIVE

    def _default_platform_domain(self, slug: str) -> str:
        return f"{slug}.{settings.DEFAULT_TENANT_DOMAIN_SUFFIX}"

    async def _get_system_settings(self) -> SystemSettings:
        result = await self.db.execute(select(SystemSettings).order_by(SystemSettings.id).limit(1))
        settings_row = result.scalar_one_or_none()
        if settings_row:
            return settings_row
        settings_row = SystemSettings(
            platform_domain=settings.PRIMARY_PLATFORM_DOMAIN,
            tenant_domain_suffix=settings.DEFAULT_TENANT_DOMAIN_SUFFIX,
            sender_email=settings.SMTP_FROM_EMAIL or "farmexa@arosoft.io",
            sender_name=settings.SMTP_FROM_NAME,
            support_email=settings.SMTP_FROM_EMAIL or "farmexa@arosoft.io",
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
        self.db.add(settings_row)
        await self.db.flush()
        return settings_row

    async def _get_role(self, role_name: str) -> Role:
        result = await self.db.execute(select(Role).where(Role.name == role_name))
        role = result.scalar_one_or_none()
        if not role:
            raise HTTPException(status_code=500, detail=f"Role '{role_name}' is missing from the seed data.")
        return role

    async def _get_module(self, module_key: str) -> PlatformModule:
        result = await self.db.execute(select(PlatformModule).where(PlatformModule.key == module_key))
        module = result.scalar_one_or_none()
        if not module:
            raise HTTPException(status_code=404, detail=f"Module '{module_key}' not found")
        return module

    async def _get_core_module_keys(self) -> set[str]:
        result = await self.db.execute(select(PlatformModule.key).where(PlatformModule.is_core.is_(True)))
        return set(result.scalars().all())

    async def _get_plan_model(self, plan_code: str) -> PlanDefinition:
        result = await self.db.execute(
            select(PlanDefinition)
            .where(PlanDefinition.code == plan_code)
            .options(selectinload(PlanDefinition.modules).selectinload(PlanModule.module))
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan

    async def _get_tenant_model(self, tenant_id: int) -> Tenant:
        result = await self.db.execute(self._tenant_query().where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        return tenant

    async def _get_plan_module_keys(self, plan_code: str) -> list[str]:
        result = await self.db.execute(
            select(PlanModule.module_key).where(
                PlanModule.plan_code == plan_code,
                PlanModule.is_included.is_(True),
            )
        )
        return list(result.scalars().all())

    async def _get_tenant_modules(self, tenant_id: int) -> list[TenantModule]:
        result = await self.db.execute(
            select(TenantModule)
            .where(TenantModule.tenant_id == tenant_id)
            .options(selectinload(TenantModule.module))
            .order_by(TenantModule.module_key)
        )
        return list(result.scalars().all())

    async def _get_tenant_domains(self, tenant_id: int) -> list[TenantDomain]:
        result = await self.db.execute(
            select(TenantDomain)
            .where(TenantDomain.tenant_id == tenant_id)
            .order_by(TenantDomain.is_primary.desc(), TenantDomain.host)
        )
        return list(result.scalars().all())

    async def _get_latest_subscription(self, tenant_id: int) -> Subscription | None:
        result = await self.db.execute(
            select(Subscription)
            .where(Subscription.tenant_id == tenant_id)
            .order_by(Subscription.start_date.desc(), Subscription.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _load_domain(self, tenant_id: int, domain_id: int) -> TenantDomain:
        result = await self.db.execute(
            select(TenantDomain).where(TenantDomain.id == domain_id, TenantDomain.tenant_id == tenant_id)
        )
        domain = result.scalar_one_or_none()
        if not domain:
            raise HTTPException(status_code=404, detail="Tenant domain not found.")
        return domain

    async def _tenant_count_map(self) -> dict[str, int]:
        result = await self.db.execute(select(Tenant.plan, func.count(Tenant.id)).group_by(Tenant.plan))
        return {plan_code: count for plan_code, count in result.all()}

    def _serialize_plan(self, plan: PlanDefinition, tenant_count_map: dict[str, int]) -> PlanOut:
        included = [item for item in plan.modules if item.is_included and item.module is not None]
        included.sort(key=lambda item: (item.module.category, item.module.name))
        return PlanOut(
            code=plan.code,
            name=plan.name,
            description=plan.description,
            billing_cycle=self._enum_value(plan.billing_cycle),
            monthly_price=Decimal(str(plan.monthly_price or 0)),
            quarterly_price=Decimal(str(plan.quarterly_price or 0)),
            annual_price=Decimal(str(plan.annual_price or 0)),
            currency=plan.currency,
            trial_days=plan.trial_days,
            is_custom=plan.is_custom,
            is_active=plan.is_active,
            module_count=len(included),
            tenant_count=tenant_count_map.get(plan.code, 0),
            modules=[
                {
                    "module_key": item.module_key,
                    "module_name": item.module.name,
                    "category": item.module.category,
                    "description": item.module.description,
                    "is_core": item.module.is_core,
                    "is_included": item.is_included,
                }
                for item in included
            ],
        )

    async def _sync_plan_modules(self, plan_code: str, module_keys: Iterable[str]) -> None:
        requested = list(dict.fromkeys(module_keys))
        for module_key in requested:
            await self._get_module(module_key)

        result = await self.db.execute(select(PlanModule).where(PlanModule.plan_code == plan_code))
        existing = {item.module_key: item for item in result.scalars().all()}
        keep = set(requested)

        for module_key in requested:
            if module_key in existing:
                existing[module_key].is_included = True
            else:
                self.db.add(PlanModule(plan_code=plan_code, module_key=module_key, is_included=True))

        for module_key, record in existing.items():
            if module_key not in keep:
                record.is_included = False

        await self.db.flush()

    async def sync_tenant_modules_from_plan(self, tenant_id: int, plan_code: str) -> None:
        plan_keys = set(await self._get_plan_module_keys(plan_code))
        core_keys = await self._get_core_module_keys()
        expected_enabled = plan_keys | core_keys

        existing = {record.module_key: record for record in await self._get_tenant_modules(tenant_id)}

        for module_key in expected_enabled:
            module = existing.get(module_key)
            if module is None:
                self.db.add(
                    TenantModule(
                        tenant_id=tenant_id,
                        module_key=module_key,
                        is_enabled=True,
                        is_manual_override=False,
                    )
                )
                continue

            desired_enabled = True
            if module_key in core_keys:
                module.is_enabled = True
                module.is_manual_override = False
                continue

            if module.is_manual_override:
                if module.is_enabled == desired_enabled:
                    module.is_manual_override = False
            else:
                module.is_enabled = desired_enabled

        for module_key, module in existing.items():
            if module_key in expected_enabled:
                continue
            desired_enabled = False
            if module.is_manual_override:
                if module.is_enabled == desired_enabled:
                    module.is_manual_override = False
            else:
                module.is_enabled = False

        await self.db.flush()

    async def _upsert_domain(self, tenant: Tenant, host: str | None, *, is_primary: bool) -> None:
        requested_host = self._clean_host(host) or self._default_platform_domain(tenant.slug)
        normalized_host = normalize_host(requested_host)
        if not normalized_host:
            raise HTTPException(status_code=422, detail="A valid domain or subdomain is required.")

        conflict = await self.db.execute(
            select(TenantDomain).where(
                TenantDomain.normalized_host == normalized_host,
                TenantDomain.tenant_id != tenant.id,
            )
        )
        if conflict.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="That domain or subdomain is already assigned to another tenant.")

        domain_type = self._domain_type_for(requested_host)
        initial_status = DomainStatus.ACTIVE if domain_type == DomainType.PLATFORM_SUBDOMAIN else DomainStatus.PENDING_DNS
        verification_target = (
            settings.TENANT_DOMAIN_TARGET_IP
            if domain_type == DomainType.CUSTOM
            else settings.PRIMARY_PLATFORM_DOMAIN
        )

        existing_result = await self.db.execute(
            select(TenantDomain).where(
                TenantDomain.tenant_id == tenant.id,
                TenantDomain.normalized_host == normalized_host,
            )
        )
        existing = existing_result.scalar_one_or_none()

        if is_primary:
            await self.db.execute(
                update(TenantDomain)
                .where(TenantDomain.tenant_id == tenant.id, TenantDomain.id != (existing.id if existing else -1))
                .values(is_primary=False)
            )

        if existing:
            updated_status = existing.status
            if domain_type == DomainType.PLATFORM_SUBDOMAIN:
                updated_status = DomainStatus.ACTIVE
            elif existing.status == DomainStatus.DISABLED:
                updated_status = DomainStatus.DISABLED
            else:
                updated_status = DomainStatus.PENDING_DNS

            await self.db.execute(
                update(TenantDomain)
                .where(TenantDomain.id == existing.id)
                .values(
                    host=requested_host,
                    normalized_host=normalized_host,
                    domain_type=domain_type,
                    is_primary=is_primary,
                    status=updated_status,
                    verification_target=verification_target,
                    last_error=None,
                    activated_at=datetime.now(UTC) if updated_status == DomainStatus.ACTIVE else None,
                    disabled_at=None if updated_status != DomainStatus.DISABLED else existing.disabled_at,
                )
            )
        else:
            self.db.add(
                TenantDomain(
                    tenant_id=tenant.id,
                    host=requested_host,
                    normalized_host=normalized_host,
                    domain_type=domain_type,
                    is_primary=is_primary,
                    status=initial_status,
                    verification_target=verification_target,
                    activated_at=datetime.now(UTC) if initial_status == DomainStatus.ACTIVE else None,
                )
            )
        await self.db.flush()

    async def _ensure_primary_domain(self, tenant: Tenant, host: str | None) -> None:
        await self._upsert_domain(tenant, host, is_primary=True)

    async def _ensure_onboarding_domains(self, tenant: Tenant, requested_host: str | None) -> None:
        await self._ensure_primary_domain(tenant, requested_host)
        normalized = self._clean_host(requested_host)
        if normalized and self._domain_type_for(normalized) == DomainType.CUSTOM:
            await self._upsert_domain(tenant, None, is_primary=False)

    async def _provision_platform_subdomain_records(self, tenant: Tenant) -> None:
        """Create Cloudflare DNS records for the tenant platform subdomain when enabled."""
        domains = await self._get_tenant_domains(tenant.id)
        for domain in domains:
            if self._enum_value(domain.domain_type) != DomainType.PLATFORM_SUBDOMAIN.value:
                continue
            result = await create_tenant_dns_record(domain.host)
            domain.last_checked_at = datetime.now(UTC)
            if result.ok:
                domain.status = DomainStatus.ACTIVE
                domain.dns_verified_at = datetime.now(UTC)
                domain.activated_at = datetime.now(UTC)
                domain.verification_target = result.target or settings.PRIMARY_PLATFORM_DOMAIN
                domain.cloudflare_record_id = result.record_id
                domain.cloudflare_provision_status = result.status
                domain.cloudflare_provisioned_at = datetime.now(UTC)
                domain.cloudflare_last_error = None
                domain.last_error = result.message
            else:
                domain.status = DomainStatus.FAILED
                domain.cloudflare_provision_status = result.status
                domain.cloudflare_last_error = result.message
                domain.last_error = result.message
                raise HTTPException(status_code=503, detail=f"Tenant DNS provisioning failed for {domain.host}: {result.message}")
        await self.db.flush()

    async def _create_subscription(
        self,
        tenant_id: int,
        plan: PlanDefinition,
        billing_cycle: BillingCycle,
        start_date: date | None,
        expiry_date: date | None,
        *,
        notes: str | None = None,
        status: SubscriptionStatus | None = None,
    ) -> Subscription:
        latest = await self._get_latest_subscription(tenant_id)
        if latest and latest.status in {
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.PAST_DUE,
        }:
            latest.status = SubscriptionStatus.CANCELLED

        resolved_start = start_date or date.today()
        resolved_expiry = expiry_date
        is_trial = False
        if resolved_expiry is None and plan.trial_days > 0 and status is None:
            resolved_expiry = resolved_start + timedelta(days=plan.trial_days)
            is_trial = True

        resolved_status = status or self._subscription_status_for(
            is_suspended=False,
            expiry_date=resolved_expiry,
            is_trial=is_trial,
        )

        next_invoice = (
            resolved_expiry
            if resolved_status == SubscriptionStatus.TRIAL and resolved_expiry is not None
            else resolved_start + timedelta(days=self._billing_cycle_days(billing_cycle))
        )
        subscription = Subscription(
            tenant_id=tenant_id,
            plan_code=plan.code,
            billing_cycle=billing_cycle,
            status=resolved_status,
            start_date=resolved_start,
            expiry_date=resolved_expiry,
            next_invoice_date=next_invoice,
            amount=self._price_for_cycle(plan, billing_cycle),
            currency=plan.currency,
            trial_days=plan.trial_days if resolved_status == SubscriptionStatus.TRIAL else 0,
            notes=notes,
        )
        self.db.add(subscription)
        await self.db.flush()
        return subscription

    async def _create_tenant_admin(self, tenant: Tenant, password_override: str | None = None) -> User:
        existing_user = await self.db.execute(select(User).where(User.email == tenant.email, User.deleted_at.is_(None)))
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="The tenant email is already assigned to another user account.",
            )

        role = await self._get_role(TENANT_ADMIN_ROLE_NAME)
        temporary_password = password_override or self._build_temp_password()
        full_name = (tenant.contact_person or tenant.business_name or f"{tenant.name} Admin").strip()
        user = User(
            email=tenant.email,
            full_name=full_name,
            job_title="Tenant Administrator",
            hashed_password=hash_password(temporary_password),
            is_active=True,
            role_id=role.id,
            role=role,
            tenant_id=tenant.id,
        )
        setattr(user, "_temporary_password", temporary_password)
        self.db.add(user)
        await self.db.flush()
        return user

    async def _create_tenant_internal(
        self,
        data: TenantCreate,
        *,
        actor: User | None,
        admin_password: str | None = None,
        source: str = "developer_admin",
    ) -> Tenant:
        slug = self._slugify(data.slug or data.name)
        if not slug:
            raise HTTPException(status_code=422, detail="Tenant name or slug is invalid.")
        if data.subscription_start and data.subscription_expiry and data.subscription_expiry < data.subscription_start:
            raise HTTPException(status_code=422, detail="Subscription expiry cannot be earlier than the subscription start date.")

        existing = await self.db.execute(select(Tenant).where((Tenant.slug == slug) | (Tenant.name == data.name)))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A tenant with the same name or slug already exists.")

        onboarding_admin: TenantAdminCredentialOut | None = None

        try:
            plan = await self._get_plan_model(data.plan)
            billing_cycle = self._parse_billing_cycle(data.billing_cycle)
            subscription_start = data.subscription_start or date.today()
            subscription_expiry = data.subscription_expiry
            is_trial = subscription_expiry is None and plan.trial_days > 0
            if is_trial:
                subscription_expiry = subscription_start + timedelta(days=plan.trial_days)
            trial_started_at = datetime.combine(subscription_start, datetime.min.time(), tzinfo=UTC) if is_trial else None
            trial_ends_at = datetime.combine(subscription_expiry, datetime.min.time(), tzinfo=UTC) if is_trial and subscription_expiry else None

            tenant = Tenant(
                name=data.name,
                slug=slug,
                business_name=data.business_name or data.name,
                contact_person=data.contact_person,
                email=data.email,
                phone=data.phone,
                address=data.address,
                country=data.country,
                status=TenantStatus.TRIAL if is_trial else TenantStatus.ACTIVE,
                plan=plan.code,
                billing_cycle=billing_cycle,
                subscription_start=subscription_start,
                subscription_expiry=subscription_expiry,
                trial_started_at=trial_started_at,
                trial_ends_at=trial_ends_at,
                subscription_status=SubscriptionStatus.TRIAL if is_trial else SubscriptionStatus.ACTIVE,
                is_profile_only=False,
                notes=data.notes,
            )
            self.db.add(tenant)
            await self.db.flush()

            await self.sync_tenant_modules_from_plan(tenant.id, plan.code)
            await self._ensure_onboarding_domains(tenant, data.domain)
            await self._provision_platform_subdomain_records(tenant)
            subscription = await self._create_subscription(
                tenant_id=tenant.id,
                plan=plan,
                billing_cycle=billing_cycle,
                start_date=subscription_start,
                expiry_date=subscription_expiry,
                notes=data.notes,
            )
            tenant.status = (
                TenantStatus.SUSPENDED
                if subscription.status == SubscriptionStatus.SUSPENDED
                else TenantStatus.TRIAL
                if subscription.status == SubscriptionStatus.TRIAL
                else TenantStatus.ACTIVE
            )
            tenant.subscription_status = subscription.status
            tenant.is_profile_only = subscription.status == SubscriptionStatus.EXPIRED

            tenant_admin = await self._create_tenant_admin(tenant, password_override=admin_password)
            await provision_tenant_operational_database(tenant, tenant_admin)
            if admin_password is None:
                onboarding_admin = TenantAdminCredentialOut(
                    email=tenant_admin.email,
                    full_name=tenant_admin.full_name,
                    temporary_password=getattr(tenant_admin, "_temporary_password"),
                    must_change_password=True,
                )

            event_type = "created" if actor else "self_registered"
            self.db.add(
                SubscriptionHistory(
                    tenant_id=tenant.id,
                    changed_by_user_id=actor.id if actor else None,
                    event_type=event_type,
                    new_plan=plan.code,
                    notes=f"{'Tenant created' if actor else 'Tenant self-registration'} on {plan.name}",
                )
            )
            await write_audit_log(
                self.db,
                user_id=actor.id if actor else None,
                action="CREATE",
                entity="tenant" if actor else "tenant_self_registration",
                entity_id=tenant.id,
                meta={
                    "tenant_name": tenant.name,
                    "plan": plan.code,
                    "billing_cycle": billing_cycle.value,
                    "domain": data.domain or self._default_platform_domain(tenant.slug),
                    "source": source,
                },
            )
            await self.db.commit()
            tenant_out = await self._get_tenant_model(tenant.id)
            setattr(tenant_out, "onboarding_admin", onboarding_admin)
            return tenant_out
        except HTTPException:
            await self.db.rollback()
            raise
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Tenant registration failed because some values are invalid or already in use.") from exc
        except Exception as exc:  # pragma: no cover - unexpected path
            await self.db.rollback()
            logger.exception("Unexpected tenant registration failure for tenant '%s'.", data.name)
            root_error = str(getattr(exc, "orig", exc)).strip() or "Unexpected server error."
            raise HTTPException(status_code=500, detail=f"Tenant registration failed: {root_error}") from exc

    @staticmethod
    def _request_scheme(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-proto")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.url.scheme

    def _build_login_url(self, request: Request, host: str) -> str:
        scheme = self._request_scheme(request)
        port = request.url.port
        is_local = request.url.hostname in {"localhost", "127.0.0.1"}
        if is_local and port:
            return f"{scheme}://{host}:{port}/login"
        return f"{scheme}://{host}/login"

    async def _certbot_command(self, host: str) -> list[str]:
        command = [
            settings.CERTBOT_BIN,
            "certonly",
            "--webroot",
            "-w",
            settings.CERTBOT_WEBROOT,
            "-d",
            host,
            "--non-interactive",
            "--agree-tos",
        ]
        normalized = normalize_host(host)
        if normalized and not host.startswith("www."):
            command.extend(["-d", f"www.{normalized}"])
        if settings.CERTBOT_EMAIL:
            command.extend(["--email", settings.CERTBOT_EMAIL])
        else:
            command.append("--register-unsafely-without-email")
        return command

    async def _provision_ssl(self, domain: TenantDomain) -> None:
        command = await self._certbot_command(domain.host)
        domain.ssl_requested_at = datetime.now(UTC)
        domain.status = DomainStatus.SSL_PENDING
        domain.last_error = None
        await self.db.flush()

        if not settings.ENABLE_AUTOMATIC_SSL_PROVISIONING:
            domain.last_error = f"Pending manual SSL provisioning. Run: {' '.join(command)}"
            await self.db.flush()
            return

        try:
            completed = subprocess.run(command, check=True, capture_output=True, text=True)
            domain.ssl_issued_at = datetime.now(UTC)
            domain.activated_at = datetime.now(UTC)
            domain.status = DomainStatus.ACTIVE
            domain.last_error = completed.stdout.strip() or None
        except subprocess.CalledProcessError as exc:  # pragma: no cover - deployment dependent
            logger.exception("SSL provisioning failed for domain %s.", domain.host)
            domain.status = DomainStatus.FAILED
            domain.last_error = (exc.stderr or exc.stdout or str(exc)).strip()
        await self.db.flush()

    async def register_tenant(self, payload: TenantRegistrationRequest, request: Request) -> TenantRegistrationOut:
        if getattr(request.state, "tenant_id", None) is not None:
            raise HTTPException(
                status_code=403,
                detail="Tenant self-registration is only available from the platform sign-in domain.",
            )

        tenant = await self._create_tenant_internal(
            TenantCreate(
                name=payload.name,
                business_name=payload.business_name,
                contact_person=payload.contact_person,
                email=payload.email,
                phone=payload.phone,
                address=payload.address,
                country=payload.country,
                domain=None,
                plan="full_trial",
                billing_cycle="monthly",
            ),
            actor=None,
            admin_password=payload.password,
            source="public_login_registration",
        )

        domains = sorted(tenant.domains, key=lambda item: (not item.is_primary, item.host))
        primary_domain = next((domain for domain in domains if domain.is_primary), None)
        active_domain = next(
            (domain for domain in domains if self._enum_value(domain.status) == DomainStatus.ACTIVE.value),
            None,
        )
        fallback_domain = next(
            (
                domain
                for domain in domains
                if self._enum_value(domain.domain_type) == DomainType.PLATFORM_SUBDOMAIN.value
                and self._enum_value(domain.status) == DomainStatus.ACTIVE.value
            ),
            None,
        )
        custom_domain = next(
            (domain for domain in domains if self._enum_value(domain.domain_type) == DomainType.CUSTOM.value),
            None,
        )
        login_host = active_domain.host if active_domain else self._default_platform_domain(tenant.slug)
        login_url = self._build_login_url(request, login_host)
        system_settings = await self._get_system_settings()
        await send_welcome_email(
            self.db,
            tenant_id=tenant.id,
            farm_name=tenant.name,
            contact_name=tenant.contact_person,
            recipient=tenant.email,
            workspace_url=login_url,
            trial_expiry_date=tenant.subscription_expiry,
            system_settings=system_settings,
        )
        await self.db.commit()
        return TenantRegistrationOut(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            admin_email=tenant.email,
            login_host=login_host,
            login_url=login_url,
            primary_domain=primary_domain.host if primary_domain else login_host,
            primary_domain_status=self._enum_value(primary_domain.status) if primary_domain else DomainStatus.ACTIVE.value,
            trial_start_date=tenant.subscription_start,
            trial_expiry_date=tenant.subscription_expiry,
            fallback_domain=fallback_domain.host if fallback_domain and fallback_domain.host != login_host else None,
            custom_domain=custom_domain.host if custom_domain else None,
            custom_domain_status=self._enum_value(custom_domain.status) if custom_domain else None,
        )

    async def list_tenants(self) -> list[Tenant]:
        result = await self.db.execute(self._tenant_query().order_by(Tenant.name))
        return list(result.scalars().all())

    async def get_tenant(self, tenant_id: int) -> Tenant:
        return await self._get_tenant_model(tenant_id)

    async def list_plans(self) -> list[PlanOut]:
        result = await self.db.execute(
            select(PlanDefinition)
            .options(selectinload(PlanDefinition.modules).selectinload(PlanModule.module))
            .order_by(PlanDefinition.name)
        )
        tenant_count_map = await self._tenant_count_map()
        return [self._serialize_plan(plan, tenant_count_map) for plan in result.scalars().all()]

    async def get_plan(self, plan_code: str) -> PlanOut:
        plan = await self._get_plan_model(plan_code)
        return self._serialize_plan(plan, await self._tenant_count_map())

    async def list_modules(self) -> list[PlatformModule]:
        result = await self.db.execute(select(PlatformModule).order_by(PlatformModule.category, PlatformModule.name))
        return list(result.scalars().all())

    async def list_module_prices(self) -> list[ModulePrice]:
        result = await self.db.execute(select(ModulePrice).order_by(ModulePrice.module_key, ModulePrice.billing_cycle))
        return list(result.scalars().all())

    async def create_plan(self, data: PlanCreate, actor: User) -> PlanOut:
        code = self._normalize_plan_code(data.code)
        if not code:
            raise HTTPException(status_code=422, detail="Plan code is invalid.")
        existing = await self.db.execute(select(PlanDefinition).where(PlanDefinition.code == code))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A plan with this code already exists.")

        billing_cycle = self._parse_billing_cycle(data.billing_cycle)
        plan = PlanDefinition(
            code=code,
            name=data.name.strip(),
            description=data.description,
            billing_cycle=billing_cycle,
            monthly_price=data.monthly_price,
            quarterly_price=data.quarterly_price,
            annual_price=data.annual_price,
            currency=data.currency.strip().upper(),
            trial_days=data.trial_days,
            is_custom=False,
            is_active=data.is_active,
        )
        self.db.add(plan)
        await self.db.flush()
        await self._sync_plan_modules(plan.code, data.modules)
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="CREATE",
            entity="plan",
            entity_id=None,
            meta={"plan_code": plan.code, "modules": data.modules},
        )
        await self.db.commit()
        return await self.get_plan(plan.code)

    async def update_plan(self, plan_code: str, data: PlanUpdate, actor: User) -> PlanOut:
        plan = await self._get_plan_model(plan_code)
        updates = data.model_dump(exclude_unset=True)
        requested_modules = updates.pop("modules", None)
        requested_code = updates.pop("code", None)

        if requested_code is not None:
            normalized_code = self._normalize_plan_code(requested_code)
            if not normalized_code:
                raise HTTPException(status_code=422, detail="Plan code is invalid.")
            if normalized_code != plan.code:
                existing = await self.db.execute(select(PlanDefinition).where(PlanDefinition.code == normalized_code))
                if existing.scalar_one_or_none():
                    raise HTTPException(status_code=409, detail="A plan with this code already exists.")
                old_code = plan.code
                new_plan = PlanDefinition(
                    code=normalized_code,
                    name=plan.name,
                    description=plan.description,
                    billing_cycle=plan.billing_cycle,
                    monthly_price=plan.monthly_price,
                    quarterly_price=plan.quarterly_price,
                    annual_price=plan.annual_price,
                    currency=plan.currency,
                    trial_days=plan.trial_days,
                    is_custom=plan.is_custom,
                    is_active=plan.is_active,
                )
                self.db.add(new_plan)
                await self.db.flush()
                await self._sync_plan_modules(
                    new_plan.code,
                    [item.module_key for item in plan.modules if item.is_included],
                )
                await self.db.execute(update(Subscription).where(Subscription.plan_code == old_code).values(plan_code=normalized_code))
                await self.db.execute(update(Tenant).where(Tenant.plan == old_code).values(plan=normalized_code))
                await self.db.execute(
                    update(SubscriptionHistory)
                    .where(SubscriptionHistory.old_plan == old_code)
                    .values(old_plan=normalized_code)
                )
                await self.db.execute(
                    update(SubscriptionHistory)
                    .where(SubscriptionHistory.new_plan == old_code)
                    .values(new_plan=normalized_code)
                )
                await self.db.delete(plan)
                await self.db.flush()
                plan = new_plan

        if "billing_cycle" in updates:
            updates["billing_cycle"] = self._parse_billing_cycle(updates["billing_cycle"])
        if "currency" in updates and updates["currency"] is not None:
            updates["currency"] = updates["currency"].strip().upper()
        if "name" in updates and updates["name"] is not None:
            updates["name"] = updates["name"].strip()

        for field, value in updates.items():
            setattr(plan, field, value)

        if requested_modules is not None:
            await self._sync_plan_modules(plan.code, requested_modules)
            tenant_ids = (
                await self.db.execute(select(Tenant.id).where(Tenant.plan == plan.code))
            ).scalars().all()
            for tenant_id in tenant_ids:
                await self.sync_tenant_modules_from_plan(int(tenant_id), plan.code)

        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="plan",
            entity_id=None,
            meta={"plan_code": plan.code, "updated_fields": sorted(updates.keys())},
        )
        await self.db.commit()
        return await self.get_plan(plan.code)

    async def update_plan_status(self, plan_code: str, data: PlanStatusUpdate, actor: User) -> PlanOut:
        plan = await self._get_plan_model(plan_code)
        plan.is_active = data.is_active
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="plan_status",
            entity_id=None,
            meta={"plan_code": plan.code, "is_active": data.is_active},
        )
        await self.db.commit()
        return await self.get_plan(plan.code)

    async def create_tenant(self, data: TenantCreate, actor: User) -> Tenant:
        return await self._create_tenant_internal(data, actor=actor, admin_password=None, source="developer_admin")

    async def update_tenant(self, tenant_id: int, data: TenantUpdate, actor: User) -> Tenant:
        tenant = await self._get_tenant_model(tenant_id)
        latest_subscription = await self._get_latest_subscription(tenant_id)
        old_plan = tenant.plan
        old_billing_cycle = self._enum_value(tenant.billing_cycle)
        old_is_suspended = tenant.is_suspended

        updates = data.model_dump(exclude_none=True)
        requested_domain = updates.pop("domain", None)
        requested_plan = updates.pop("plan", None)
        requested_is_suspended = updates.pop("is_suspended", None)

        if "slug" in updates:
            updates["slug"] = self._slugify(updates["slug"])
        if "billing_cycle" in updates:
            updates["billing_cycle"] = self._parse_billing_cycle(updates["billing_cycle"])

        if requested_plan:
            plan = await self._get_plan_model(requested_plan)
            tenant.plan = plan.code
            await self.sync_tenant_modules_from_plan(tenant.id, plan.code)
        else:
            plan = await self._get_plan_model(tenant.plan)

        for field, value in updates.items():
            setattr(tenant, field, value)

        if requested_is_suspended is not None:
            tenant.is_suspended = requested_is_suspended

        billing_cycle = tenant.billing_cycle if isinstance(tenant.billing_cycle, BillingCycle) else self._parse_billing_cycle(str(tenant.billing_cycle))
        is_trial = tenant.subscription_expiry is not None and tenant.subscription_expiry >= date.today() and plan.trial_days > 0 and tenant.subscription_start and (tenant.subscription_expiry - tenant.subscription_start).days <= plan.trial_days
        tenant.status = (
            TenantStatus.SUSPENDED
            if tenant.is_suspended
            else TenantStatus.TRIAL
            if is_trial
            else TenantStatus.ACTIVE
        )

        if latest_subscription is not None:
            latest_subscription.plan_code = tenant.plan
            latest_subscription.billing_cycle = billing_cycle
            latest_subscription.start_date = tenant.subscription_start or latest_subscription.start_date
            latest_subscription.expiry_date = tenant.subscription_expiry
            latest_subscription.amount = self._price_for_cycle(plan, billing_cycle)
            latest_subscription.currency = plan.currency
            latest_subscription.status = self._subscription_status_for(
                is_suspended=tenant.is_suspended,
                expiry_date=tenant.subscription_expiry,
                is_trial=tenant.status == TenantStatus.TRIAL,
            )
        else:
            await self._create_subscription(
                tenant_id=tenant.id,
                plan=plan,
                billing_cycle=billing_cycle,
                start_date=tenant.subscription_start or date.today(),
                expiry_date=tenant.subscription_expiry,
                notes="Created from developer admin tenant edit.",
                status=self._subscription_status_for(
                    is_suspended=tenant.is_suspended,
                    expiry_date=tenant.subscription_expiry,
                    is_trial=tenant.status == TenantStatus.TRIAL,
                ),
            )

        if requested_domain is not None:
            await self._ensure_primary_domain(tenant, requested_domain)

        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant.id,
                changed_by_user_id=actor.id,
                event_type="subscription_update",
                old_plan=old_plan,
                new_plan=tenant.plan,
                notes=(
                    f"billing_cycle: {old_billing_cycle} -> {self._enum_value(tenant.billing_cycle)}; "
                    f"suspended: {old_is_suspended} -> {tenant.is_suspended}"
                ),
            )
        )
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_subscription",
            entity_id=tenant.id,
            meta={
                "tenant_id": tenant.id,
                "plan": tenant.plan,
                "billing_cycle": self._enum_value(tenant.billing_cycle),
                "subscription_start": tenant.subscription_start.isoformat() if tenant.subscription_start else None,
                "subscription_expiry": tenant.subscription_expiry.isoformat() if tenant.subscription_expiry else None,
                "is_suspended": tenant.is_suspended,
            },
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def change_plan(self, tenant_id: int, data: PlanChange, actor: User) -> Tenant:
        tenant = await self._get_tenant_model(tenant_id)
        plan = await self._get_plan_model(data.plan)
        latest = await self._get_latest_subscription(tenant_id)
        old_plan = latest.plan_code if latest else tenant.plan
        billing_cycle = self._parse_billing_cycle(data.billing_cycle or self._enum_value(tenant.billing_cycle))

        tenant.plan = plan.code
        tenant.billing_cycle = billing_cycle
        tenant.subscription_start = date.today()
        tenant.subscription_expiry = data.subscription_expiry
        tenant.is_suspended = False
        await self.sync_tenant_modules_from_plan(tenant.id, plan.code)

        subscription = await self._create_subscription(
            tenant_id=tenant.id,
            plan=plan,
            billing_cycle=billing_cycle,
            start_date=date.today(),
            expiry_date=data.subscription_expiry,
            notes=data.notes,
        )
        tenant.status = (
            TenantStatus.TRIAL
            if subscription.status == SubscriptionStatus.TRIAL
            else TenantStatus.ACTIVE
        )

        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant.id,
                changed_by_user_id=actor.id,
                event_type="plan_change",
                old_plan=old_plan,
                new_plan=plan.code,
                notes=data.notes,
            )
        )
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_plan",
            entity_id=tenant.id,
            meta={"old_plan": old_plan, "new_plan": plan.code, "billing_cycle": billing_cycle.value},
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def toggle_module(self, tenant_id: int, data: ModuleToggle, actor: User) -> TenantModuleOut:
        tenant = await self._get_tenant_model(tenant_id)
        await self._get_module(data.module_key)
        core_keys = await self._get_core_module_keys()
        if data.module_key in core_keys and not data.is_enabled:
            raise HTTPException(status_code=409, detail=f"Module '{data.module_key}' is a core module and cannot be disabled.")

        default_enabled = data.module_key in set(await self._get_plan_module_keys(tenant.plan)) or data.module_key in core_keys
        result = await self.db.execute(
            select(TenantModule).where(
                TenantModule.tenant_id == tenant_id,
                TenantModule.module_key == data.module_key,
            )
        )
        module = result.scalar_one_or_none()
        if module is None:
            module = TenantModule(
                tenant_id=tenant_id,
                module_key=data.module_key,
                is_enabled=data.is_enabled,
                is_manual_override=data.is_enabled != default_enabled,
            )
            self.db.add(module)
            await self.db.flush()
        else:
            module.is_enabled = data.is_enabled
            module.is_manual_override = data.is_enabled != default_enabled

        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant_id,
                changed_by_user_id=actor.id,
                event_type="module_toggle",
                notes=f"Module '{data.module_key}' {'enabled' if data.is_enabled else 'disabled'}",
            )
        )
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_module",
            entity_id=module.id,
            meta={
                "tenant_id": tenant_id,
                "module_key": data.module_key,
                "is_enabled": data.is_enabled,
                "is_manual_override": module.is_manual_override,
            },
        )
        await self.db.commit()
        await self.db.refresh(module)
        return TenantModuleOut.model_validate(module)

    async def assign_domain(self, tenant_id: int, data: DomainAssignRequest, actor: User) -> Tenant:
        tenant = await self._get_tenant_model(tenant_id)
        await self._upsert_domain(tenant, data.host, is_primary=data.is_primary)
        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant.id,
                changed_by_user_id=actor.id,
                event_type="domain_update",
                notes=f"Domain saved as {data.host}",
            )
        )
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_domain",
            entity_id=tenant.id,
            meta={"tenant_id": tenant.id, "host": data.host, "is_primary": data.is_primary},
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def delete_domain(self, tenant_id: int, domain_id: int, actor: User) -> Tenant:
        domain = await self._load_domain(tenant_id, domain_id)
        domains = await self._get_tenant_domains(tenant_id)
        active_domains = [item for item in domains if self._enum_value(item.status) == DomainStatus.ACTIVE.value and item.id != domain.id]

        if domain.is_primary and self._enum_value(domain.status) == DomainStatus.ACTIVE.value and not active_domains:
            raise HTTPException(
                status_code=409,
                detail="Cannot delete the only active primary domain. Add or activate another domain first.",
            )

        await self.db.delete(domain)
        await self.db.flush()

        if domain.is_primary and active_domains:
            promoted = sorted(active_domains, key=lambda item: item.created_at)[0]
            promoted.is_primary = True

        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="DELETE",
            entity="tenant_domain",
            entity_id=domain_id,
            meta={"tenant_id": tenant_id, "host": domain.host},
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def verify_domain(self, tenant_id: int, domain_id: int, actor: User) -> Tenant:
        domain = await self._load_domain(tenant_id, domain_id)
        domain.last_checked_at = datetime.now(UTC)
        domain.last_error = None

        if domain.domain_type == DomainType.PLATFORM_SUBDOMAIN:
            domain.status = DomainStatus.ACTIVE
            domain.activated_at = datetime.now(UTC)
        else:
            verification = await verify_domain_points_to_target(domain.host)
            domain.verification_target = verification.target_ip
            if verification.matches_target:
                domain.status = DomainStatus.DNS_VERIFIED
                domain.dns_verified_at = datetime.now(UTC)
            else:
                domain.status = DomainStatus.FAILED
                resolved = ", ".join(verification.resolved_ips) if verification.resolved_ips else "no A records"
                domain.last_error = verification.error or (
                    f"Domain does not point to {verification.target_ip or 'the configured target IP'}. Resolved: {resolved}."
                )

        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_domain_verify",
            entity_id=domain.id,
            meta={"tenant_id": tenant_id, "status": self._enum_value(domain.status), "host": domain.host},
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def provision_domain_ssl(self, tenant_id: int, domain_id: int, actor: User) -> Tenant:
        domain = await self._load_domain(tenant_id, domain_id)
        if domain.domain_type != DomainType.CUSTOM:
            domain.status = DomainStatus.ACTIVE
            domain.activated_at = datetime.now(UTC)
        else:
            if domain.status not in {DomainStatus.DNS_VERIFIED, DomainStatus.SSL_PENDING, DomainStatus.FAILED}:
                raise HTTPException(status_code=409, detail="DNS must be verified before SSL can be provisioned.")
            await self._provision_ssl(domain)

        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_domain_ssl",
            entity_id=domain.id,
            meta={"tenant_id": tenant_id, "status": self._enum_value(domain.status), "host": domain.host},
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def activate_domain(self, tenant_id: int, domain_id: int, actor: User) -> Tenant:
        domain = await self._load_domain(tenant_id, domain_id)
        previous_status = domain.status
        if domain.domain_type == DomainType.CUSTOM:
            if not domain.dns_verified_at:
                domain.dns_verified_at = datetime.now(UTC)
            if not domain.ssl_issued_at:
                domain.ssl_issued_at = datetime.now(UTC)
        domain.status = DomainStatus.ACTIVE
        domain.activated_at = datetime.now(UTC)
        domain.disabled_at = None
        domain.last_error = None

        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_domain_activate",
            entity_id=domain.id,
            meta={
                "tenant_id": tenant_id,
                "host": domain.host,
                "previous_status": self._enum_value(previous_status),
                "manual_override": domain.domain_type == DomainType.CUSTOM,
            },
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def disable_domain(self, tenant_id: int, domain_id: int, actor: User) -> Tenant:
        tenant = await self._get_tenant_model(tenant_id)
        domain = await self._load_domain(tenant_id, domain_id)
        domain.status = DomainStatus.DISABLED
        domain.disabled_at = datetime.now(UTC)
        domain.is_primary = False

        primary_domains = await self._get_tenant_domains(tenant_id)
        if not any(item.is_primary and item.id != domain.id and item.status == DomainStatus.ACTIVE for item in primary_domains):
            active_domains = [item for item in primary_domains if item.id != domain.id and item.status == DomainStatus.ACTIVE]
            if active_domains:
                active_domains[0].is_primary = True
            else:
                await self._ensure_primary_domain(tenant, None)

        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_domain_disable",
            entity_id=domain.id,
            meta={"tenant_id": tenant_id, "host": domain.host},
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def retry_domain_setup(self, tenant_id: int, domain_id: int, actor: User) -> Tenant:
        await self.verify_domain(tenant_id, domain_id, actor)
        domain = await self._load_domain(tenant_id, domain_id)
        if domain.domain_type == DomainType.CUSTOM and domain.status == DomainStatus.DNS_VERIFIED:
            await self._provision_ssl(domain)
            await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def update_module_price(self, module_key: str, data: ModulePriceUpdate) -> ModulePrice:
        await self._get_module(module_key)
        billing_cycle = self._parse_billing_cycle(data.billing_cycle)
        result = await self.db.execute(
            select(ModulePrice).where(
                ModulePrice.module_key == module_key,
                ModulePrice.billing_cycle == billing_cycle,
            )
        )
        price = result.scalar_one_or_none()
        if price:
            price.price = data.price
            price.currency = data.currency
            price.notes = data.notes
        else:
            price = ModulePrice(
                module_key=module_key,
                billing_cycle=billing_cycle,
                price=data.price,
                currency=data.currency,
                notes=data.notes,
            )
            self.db.add(price)
        await self.db.commit()
        await self.db.refresh(price)
        return price

    async def suspend_tenant(self, tenant_id: int, data: SuspendRequest, actor: User) -> Tenant:
        tenant = await self._get_tenant_model(tenant_id)
        tenant.is_suspended = True
        tenant.status = TenantStatus.SUSPENDED
        latest = await self._get_latest_subscription(tenant_id)
        if latest:
            latest.status = SubscriptionStatus.SUSPENDED
        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant_id,
                changed_by_user_id=actor.id,
                event_type="suspend",
                notes=data.reason,
            )
        )
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_suspend",
            entity_id=tenant_id,
            meta={"reason": data.reason},
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def reactivate_tenant(self, tenant_id: int, actor: User) -> Tenant:
        tenant = await self._get_tenant_model(tenant_id)
        tenant.is_suspended = False
        latest = await self._get_latest_subscription(tenant_id)
        if latest:
            latest.status = self._subscription_status_for(
                is_suspended=False,
                expiry_date=latest.expiry_date,
                is_trial=latest.status == SubscriptionStatus.TRIAL,
            )
            tenant.status = (
                TenantStatus.TRIAL
                if latest.status == SubscriptionStatus.TRIAL
                else TenantStatus.ACTIVE
            )
        else:
            tenant.status = TenantStatus.ACTIVE

        self.db.add(
            SubscriptionHistory(
                tenant_id=tenant_id,
                changed_by_user_id=actor.id,
                event_type="reactivate",
                notes="Tenant reactivated",
            )
        )
        await write_audit_log(
            self.db,
            user_id=actor.id,
            action="UPDATE",
            entity="tenant_reactivate",
            entity_id=tenant_id,
            meta={},
        )
        await self.db.commit()
        return await self._get_tenant_model(tenant_id)

    async def get_subscription_history(self, tenant_id: int) -> list[SubscriptionHistory]:
        result = await self.db.execute(
            select(SubscriptionHistory)
            .where(SubscriptionHistory.tenant_id == tenant_id)
            .order_by(SubscriptionHistory.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_billing_overview(self) -> dict:
        tenants = await self.list_tenants()
        today = date.today()
        overview_rows = []
        active_count = 0
        suspended_count = 0
        expiring_soon = 0

        for tenant in tenants:
            subscriptions = sorted(
                tenant.subscriptions,
                key=lambda record: (record.start_date, record.created_at or datetime.min),
                reverse=True,
            )
            latest = subscriptions[0] if subscriptions else None
            domains = [domain.host for domain in sorted(tenant.domains, key=lambda domain: not domain.is_primary)]
            status = (
                self._enum_value(latest.status)
                if latest
                else ("suspended" if tenant.is_suspended else self._enum_value(tenant.status))
            )
            if tenant.is_suspended:
                suspended_count += 1
            elif status in {"active", "trial"}:
                active_count += 1
            if latest and latest.expiry_date and latest.expiry_date <= today + timedelta(days=14):
                expiring_soon += 1

            overview_rows.append(
                {
                    "tenant_id": tenant.id,
                    "tenant_name": tenant.name,
                    "plan": latest.plan_code if latest else tenant.plan,
                    "status": status,
                    "billing_cycle": self._enum_value(latest.billing_cycle) if latest else self._enum_value(tenant.billing_cycle),
                    "expiry_date": latest.expiry_date if latest else tenant.subscription_expiry,
                    "amount": latest.amount if latest else None,
                    "currency": latest.currency if latest else "UGX",
                    "domains": domains,
                }
            )

        return {
            "total_tenants": len(tenants),
            "active_tenants": active_count,
            "suspended_tenants": suspended_count,
            "expiring_soon": expiring_soon,
            "tenants": overview_rows,
        }

    async def get_overview(self) -> dict:
        tenants = await self.list_tenants()
        plan_codes = {tenant.plan for tenant in tenants}
        plan_map: dict[str, PlanDefinition] = {}
        if plan_codes:
            plans_result = await self.db.execute(select(PlanDefinition).where(PlanDefinition.code.in_(plan_codes)))
            plan_map = {plan.code: plan for plan in plans_result.scalars().all()}

        active_domains = 0
        monthly_revenue = Decimal("0")
        pending_setup = 0
        suspended_tenants = 0

        for tenant in tenants:
            if tenant.is_suspended:
                suspended_tenants += 1
            active_domains += sum(1 for domain in tenant.domains if self._enum_value(domain.status) == DomainStatus.ACTIVE.value)
            plan = plan_map.get(tenant.plan)
            if plan and not tenant.is_suspended:
                monthly_revenue += self._monthly_revenue_equivalent(plan, tenant.billing_cycle)
            has_primary_active_domain = any(
                domain.is_primary and self._enum_value(domain.status) == DomainStatus.ACTIVE.value
                for domain in tenant.domains
            )
            if tenant.operational_db_status != "ready" or not has_primary_active_domain:
                pending_setup += 1

        active_plans = (
            await self.db.execute(select(func.count()).select_from(PlanDefinition).where(PlanDefinition.is_active.is_(True)))
        ).scalar_one()

        return {
            "total_tenants": len(tenants),
            "active_domains": active_domains,
            "active_plans": active_plans,
            "monthly_revenue": monthly_revenue,
            "pending_setup": pending_setup,
            "suspended_tenants": suspended_tenants,
        }

    async def get_activity_logs(self) -> list[ActivityLogOut]:
        result = await self.db.execute(
            select(AuditLog, User.full_name, User.email)
            .outerjoin(User, User.id == AuditLog.user_id)
            .order_by(AuditLog.created_at.desc())
            .limit(100)
        )
        return [
            ActivityLogOut(
                id=log.id,
                action=log.action,
                entity=log.entity,
                entity_id=log.entity_id,
                meta=log.meta,
                created_at=log.created_at,
                actor_name=full_name,
                actor_email=email,
            )
            for log, full_name, email in result.all()
        ]

    async def get_settings_summary(self) -> DeveloperAdminSettingsOut:
        total_modules = (await self.db.execute(select(func.count()).select_from(PlatformModule))).scalar_one()
        total_plans = (await self.db.execute(select(func.count()).select_from(PlanDefinition))).scalar_one()
        return DeveloperAdminSettingsOut(
            primary_platform_domain=settings.PRIMARY_PLATFORM_DOMAIN,
            default_tenant_domain_suffix=settings.DEFAULT_TENANT_DOMAIN_SUFFIX,
            automatic_ssl_provisioning=settings.ENABLE_AUTOMATIC_SSL_PROVISIONING,
            certbot_enabled=bool(settings.CERTBOT_BIN),
            mandatory_module_keys=sorted(MANDATORY_TENANT_MODULE_KEYS),
            total_modules=total_modules,
            total_plans=total_plans,
        )
