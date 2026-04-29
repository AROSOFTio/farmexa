"""
Developer Admin service for SaaS catalog, tenant onboarding, domain control, and billing control.
"""

from __future__ import annotations

import logging
import re
import secrets
import subprocess
from datetime import UTC, date, datetime, timedelta
from typing import Iterable

from fastapi import HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import hash_password
from app.models.auth import Role
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
from app.modules.developer_admin.schemas import (
    DomainAssignRequest,
    ModulePriceUpdate,
    ModuleToggle,
    PlanChange,
    SuspendRequest,
    TenantAdminCredentialOut,
    TenantCreate,
    TenantUpdate,
)
from app.utils.audit import write_audit_log
from app.utils.domains import infer_domain_type, normalize_host, strip_port, verify_domain_points_to_target


logger = logging.getLogger("farmexa.developer_admin")


class DeveloperAdminService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _tenant_query(self):
        return select(Tenant).options(
            selectinload(Tenant.modules),
            selectinload(Tenant.domains),
            selectinload(Tenant.subscriptions),
        )

    @staticmethod
    def _slugify(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")

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

    def _default_platform_domain(self, slug: str) -> str:
        return f"{slug}.{settings.DEFAULT_TENANT_DOMAIN_SUFFIX}"

    async def _get_plan(self, plan_code: str) -> PlanDefinition:
        result = await self.db.execute(
            select(PlanDefinition).options(selectinload(PlanDefinition.modules)).where(PlanDefinition.code == plan_code)
        )
        plan = result.scalar_one_or_none()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        return plan

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

    async def _get_tenant(self, tenant_id: int) -> Tenant:
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
            select(TenantModule).where(TenantModule.tenant_id == tenant_id).order_by(TenantModule.module_key)
        )
        return list(result.scalars().all())

    async def _get_tenant_domains(self, tenant_id: int) -> list[TenantDomain]:
        result = await self.db.execute(
            select(TenantDomain).where(TenantDomain.tenant_id == tenant_id).order_by(TenantDomain.is_primary.desc(), TenantDomain.host)
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

    async def _sync_tenant_modules(self, tenant_id: int, module_keys: Iterable[str], disable_missing: bool) -> None:
        unique_module_keys = list(dict.fromkeys(module_keys))
        for module_key in unique_module_keys:
            await self._get_module(module_key)

        existing_modules = {module.module_key: module for module in await self._get_tenant_modules(tenant_id)}
        keep = set(unique_module_keys)

        for module_key in unique_module_keys:
            if module_key in existing_modules:
                existing_modules[module_key].is_enabled = True
            else:
                self.db.add(TenantModule(tenant_id=tenant_id, module_key=module_key, is_enabled=True))

        if disable_missing:
            for module_key, module in existing_modules.items():
                if module_key not in keep:
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
        verification_target = settings.TENANT_DOMAIN_TARGET_IP if domain_type == DomainType.CUSTOM else settings.PRIMARY_PLATFORM_DOMAIN

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

    async def _create_subscription(
        self,
        tenant_id: int,
        plan_code: str,
        billing_cycle: str,
        start_date: date | None,
        expiry_date: date | None,
        notes: str | None = None,
        status: str | None = None,
    ) -> Subscription:
        latest = await self._get_latest_subscription(tenant_id)
        if latest and latest.status in {SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE}:
            latest.status = SubscriptionStatus.CANCELLED

        parsed_billing_cycle = self._parse_billing_cycle(billing_cycle)
        subscription = Subscription(
            tenant_id=tenant_id,
            plan_code=plan_code,
            billing_cycle=parsed_billing_cycle,
            status=SubscriptionStatus(status or ("trial" if not expiry_date else "active")),
            start_date=start_date or date.today(),
            expiry_date=expiry_date,
            next_invoice_date=(start_date or date.today()) + timedelta(days=30),
            notes=notes,
        )
        self.db.add(subscription)
        await self.db.flush()
        return subscription

    async def _create_tenant_admin(self, tenant: Tenant) -> TenantAdminCredentialOut:
        existing_user = await self.db.execute(select(User).where(User.email == tenant.email, User.deleted_at.is_(None)))
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail="The tenant email is already assigned to another user account.",
            )

        role = await self._get_role("farm_manager")
        temporary_password = self._build_temp_password()
        full_name = (tenant.contact_person or tenant.business_name or f"{tenant.name} Admin").strip()
        self.db.add(
            User(
                email=tenant.email,
                full_name=full_name,
                hashed_password=hash_password(temporary_password),
                is_active=True,
                role_id=role.id,
                tenant_id=tenant.id,
            )
        )
        await self.db.flush()
        return TenantAdminCredentialOut(
            email=tenant.email,
            full_name=full_name,
            temporary_password=temporary_password,
            must_change_password=True,
        )

    def _certbot_command(self, host: str) -> list[str]:
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
        command = self._certbot_command(domain.host)
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
        except subprocess.CalledProcessError as exc:  # pragma: no cover - depends on deployment environment
            logger.exception("SSL provisioning failed for domain %s.", domain.host)
            domain.status = DomainStatus.FAILED
            domain.last_error = (exc.stderr or exc.stdout or str(exc)).strip()
        await self.db.flush()

    async def list_tenants(self) -> list[Tenant]:
        result = await self.db.execute(self._tenant_query().order_by(Tenant.name))
        return list(result.scalars().all())

    async def list_plans(self) -> list[PlanDefinition]:
        result = await self.db.execute(
            select(PlanDefinition).options(selectinload(PlanDefinition.modules)).order_by(PlanDefinition.code)
        )
        return list(result.scalars().all())

    async def list_modules(self) -> list[PlatformModule]:
        result = await self.db.execute(select(PlatformModule).order_by(PlatformModule.category, PlatformModule.name))
        return list(result.scalars().all())

    async def list_module_prices(self) -> list[ModulePrice]:
        result = await self.db.execute(select(ModulePrice).order_by(ModulePrice.module_key, ModulePrice.billing_cycle))
        return list(result.scalars().all())

    async def create_tenant(self, data: TenantCreate, actor: User) -> Tenant:
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
            plan = await self._get_plan(data.plan)
            billing_cycle = self._parse_billing_cycle(data.billing_cycle)
            tenant = Tenant(
                name=data.name,
                slug=slug,
                business_name=data.business_name or data.name,
                contact_person=data.contact_person,
                email=data.email,
                phone=data.phone,
                address=data.address,
                country=data.country,
                status=TenantStatus.TRIAL if not data.subscription_expiry else TenantStatus.ACTIVE,
                plan=plan.code,
                billing_cycle=billing_cycle,
                subscription_start=data.subscription_start,
                subscription_expiry=data.subscription_expiry,
                notes=data.notes,
            )
            self.db.add(tenant)
            await self.db.flush()

            module_keys = data.enabled_modules if plan.is_custom and data.enabled_modules else await self._get_plan_module_keys(plan.code)
            await self._sync_tenant_modules(tenant.id, module_keys, disable_missing=True)
            await self._ensure_primary_domain(tenant, data.domain)
            await self._create_subscription(
                tenant_id=tenant.id,
                plan_code=plan.code,
                billing_cycle=billing_cycle.value,
                start_date=data.subscription_start,
                expiry_date=data.subscription_expiry,
                notes=data.notes,
                status="trial" if not data.subscription_expiry else "active",
            )
            onboarding_admin = await self._create_tenant_admin(tenant)

            self.db.add(
                SubscriptionHistory(
                    tenant_id=tenant.id,
                    changed_by_user_id=actor.id,
                    event_type="created",
                    new_plan=plan.code,
                    notes=f"Tenant created on {plan.name}",
                )
            )
            await write_audit_log(
                self.db,
                user_id=actor.id,
                action="CREATE",
                entity="tenant",
                entity_id=tenant.id,
                meta={
                    "tenant_name": tenant.name,
                    "plan": plan.code,
                    "billing_cycle": billing_cycle.value,
                    "domain": data.domain or self._default_platform_domain(tenant.slug),
                    "enabled_modules": module_keys,
                },
            )
            await self.db.commit()
            tenant_out = await self._get_tenant(tenant.id)
            setattr(tenant_out, "onboarding_admin", onboarding_admin)
            return tenant_out
        except HTTPException:
            await self.db.rollback()
            raise
        except IntegrityError as exc:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Vendor registration failed because some values are invalid or already in use.") from exc
        except Exception as exc:
            await self.db.rollback()
            logger.exception("Unexpected vendor registration failure for tenant '%s'.", data.name)
            root_error = str(getattr(exc, "orig", exc)).strip() or "Unexpected server error."
            raise HTTPException(status_code=500, detail=f"Vendor registration failed: {root_error}") from exc

    async def update_tenant(self, tenant_id: int, data: TenantUpdate) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        updates = data.model_dump(exclude_none=True)
        if "slug" in updates:
            updates["slug"] = self._slugify(updates["slug"])
        if "billing_cycle" in updates:
            updates["billing_cycle"] = self._parse_billing_cycle(updates["billing_cycle"])
        for field, value in updates.items():
            setattr(tenant, field, value)
        await self.db.commit()
        return await self._get_tenant(tenant_id)

    async def change_plan(self, tenant_id: int, data: PlanChange, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        plan = await self._get_plan(data.plan)
        latest = await self._get_latest_subscription(tenant_id)
        old_plan = latest.plan_code if latest else (tenant.plan.value if hasattr(tenant.plan, "value") else str(tenant.plan))
        billing_cycle = self._parse_billing_cycle(
            data.billing_cycle or (tenant.billing_cycle.value if hasattr(tenant.billing_cycle, "value") else str(tenant.billing_cycle))
        )

        tenant.plan = plan.code
        if data.billing_cycle:
            tenant.billing_cycle = billing_cycle
        if data.subscription_expiry is not None:
            tenant.subscription_expiry = data.subscription_expiry
        tenant.subscription_start = date.today()
        tenant.status = TenantStatus.ACTIVE

        module_keys = await self._get_plan_module_keys(plan.code)
        if not plan.is_custom:
            await self._sync_tenant_modules(tenant.id, module_keys, disable_missing=True)

        await self._create_subscription(
            tenant_id=tenant.id,
            plan_code=plan.code,
            billing_cycle=billing_cycle.value,
            start_date=date.today(),
            expiry_date=data.subscription_expiry or tenant.subscription_expiry,
            notes=data.notes,
            status="active",
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
        return await self._get_tenant(tenant_id)

    async def toggle_module(self, tenant_id: int, data: ModuleToggle, actor: User) -> TenantModule:
        await self._get_tenant(tenant_id)
        await self._get_module(data.module_key)

        result = await self.db.execute(
            select(TenantModule).where(
                TenantModule.tenant_id == tenant_id,
                TenantModule.module_key == data.module_key,
            )
        )
        module = result.scalar_one_or_none()
        if module:
            module.is_enabled = data.is_enabled
        else:
            module = TenantModule(tenant_id=tenant_id, module_key=data.module_key, is_enabled=data.is_enabled)
            self.db.add(module)
            await self.db.flush()

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
            entity_id=module.id if module.id else None,
            meta={
                "tenant_id": tenant_id,
                "module_key": data.module_key,
                "is_enabled": data.is_enabled,
                "source": "developer_admin_manual",
            },
        )
        await self.db.commit()
        await self.db.refresh(module)
        return module

    async def assign_domain(self, tenant_id: int, data: DomainAssignRequest, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
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
        return await self._get_tenant(tenant_id)

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
            meta={"tenant_id": tenant_id, "status": getattr(domain.status, 'value', domain.status), "host": domain.host},
        )
        await self.db.commit()
        return await self._get_tenant(tenant_id)

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
            meta={"tenant_id": tenant_id, "status": getattr(domain.status, 'value', domain.status), "host": domain.host},
        )
        await self.db.commit()
        return await self._get_tenant(tenant_id)

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
                "previous_status": getattr(previous_status, "value", previous_status),
                "manual_override": domain.domain_type == DomainType.CUSTOM,
            },
        )
        await self.db.commit()
        return await self._get_tenant(tenant_id)

    async def disable_domain(self, tenant_id: int, domain_id: int, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        domain = await self._load_domain(tenant_id, domain_id)
        domain.status = DomainStatus.DISABLED
        domain.disabled_at = datetime.now(UTC)
        domain.is_primary = False

        primary_domains = await self._get_tenant_domains(tenant_id)
        if not any(item.is_primary and item.id != domain.id and item.status == DomainStatus.ACTIVE for item in primary_domains):
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
        return await self._get_tenant(tenant_id)

    async def retry_domain_setup(self, tenant_id: int, domain_id: int, actor: User) -> Tenant:
        await self.verify_domain(tenant_id, domain_id, actor)
        domain = await self._load_domain(tenant_id, domain_id)
        if domain.domain_type == DomainType.CUSTOM and domain.status == DomainStatus.DNS_VERIFIED:
            await self._provision_ssl(domain)
            await self.db.commit()
        return await self._get_tenant(tenant_id)

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
        tenant = await self._get_tenant(tenant_id)
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
        return await self._get_tenant(tenant_id)

    async def reactivate_tenant(self, tenant_id: int, actor: User) -> Tenant:
        tenant = await self._get_tenant(tenant_id)
        tenant.is_suspended = False
        tenant.status = TenantStatus.ACTIVE
        latest = await self._get_latest_subscription(tenant_id)
        if latest and latest.status == SubscriptionStatus.SUSPENDED:
            latest.status = SubscriptionStatus.ACTIVE
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
        return await self._get_tenant(tenant_id)

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
            status = latest.status.value if latest else ("suspended" if tenant.is_suspended else "trial")
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
                    "plan": latest.plan_code if latest else (tenant.plan.value if hasattr(tenant.plan, "value") else str(tenant.plan)),
                    "status": status,
                    "billing_cycle": latest.billing_cycle.value if latest and hasattr(latest.billing_cycle, "value") else (tenant.billing_cycle.value if hasattr(tenant.billing_cycle, "value") else str(tenant.billing_cycle)),
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
