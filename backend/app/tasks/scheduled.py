"""
Scheduled Celery tasks for Farmexa background operations.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

from app.db.session import AsyncSessionLocal, engine
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.settings import SystemSettings
from app.models.tenant import Subscription, SubscriptionStatus, Tenant, TenantModule, TenantStatus
from app.modules.compliance.service import process_due_document_reminders
from app.modules.sales.service import sales_service
from app.services.email_service import log_and_send_email
from app.tasks.celery_app import celery_app
from app.db.tenant_db import _ensure_schema_ready_sync, operational_db_name_for_tenant

logger = logging.getLogger("farmexa.tasks")
T = TypeVar("T")


def _run_async_task(coro_factory: Callable[[], Awaitable[T]]) -> T:
    async def runner() -> T:
        try:
            return await coro_factory()
        finally:
            await engine.dispose()

    return asyncio.run(runner())


@celery_app.task(name="tasks.health_ping")
def health_ping() -> str:
    """Simple liveness task that verifies the Celery worker is responsive."""
    logger.info("Celery health ping OK")
    return "pong"


@celery_app.task(name="tasks.process_compliance_reminders")
def process_compliance_reminders_task() -> int:
    """Send due compliance expiry reminders and mark them as delivered."""
    return _run_async_task(_process_compliance_reminders_async)


async def _process_compliance_reminders_async() -> int:
    async with AsyncSessionLocal() as db:
        processed = await process_due_document_reminders(db)
        logger.info("Processed %s compliance reminder(s).", processed)
        return processed


@celery_app.task(name="tasks.process_trial_day_7_warnings")
def process_trial_day_7_warnings() -> int:
    return _run_async_task(lambda: _process_trial_warnings_async(day=7))


@celery_app.task(name="tasks.process_trial_day_13_warnings")
def process_trial_day_13_warnings() -> int:
    return _run_async_task(lambda: _process_trial_warnings_async(day=13))


@celery_app.task(name="tasks.process_expired_trials")
def process_expired_trials() -> int:
    return _run_async_task(_process_expired_trials_async)


@celery_app.task(name="tasks.process_subscription_status_updates")
def process_subscription_status_updates() -> int:
    return _run_async_task(_process_expired_trials_async)


@celery_app.task(name="tasks.process_email_retries")
def process_email_retries() -> int:
    logger.info("Email retry task is ready; failed email requeue is managed from the email dashboard.")
    return 0


@celery_app.task(name="tasks.process_customer_balance_reminders")
def process_customer_balance_reminders() -> int:
    return _run_async_task(_process_customer_balance_reminders_async)


async def _system_settings(db):
    result = await db.execute(select(SystemSettings).order_by(SystemSettings.id).limit(1))
    return result.scalar_one_or_none()


async def _process_customer_balance_reminders_async() -> int:
    async with AsyncSessionLocal() as db:
        tenants = (await db.execute(select(Tenant).where(Tenant.operational_db_status == "ready"))).scalars().all()
    processed = 0
    for tenant in tenants:
        database_name = tenant.operational_db_name or operational_db_name_for_tenant(int(tenant.id))
        try:
            session_factory = _ensure_schema_ready_sync(database_name)
            with session_factory() as tenant_db:
                processed += sales_service.process_due_balance_reminders(tenant_db)
        except Exception as exc:  # pragma: no cover - tenant runtime/database availability
            logger.exception("Failed to process balance reminders for tenant %s: %s", tenant.id, exc)
    logger.info("Processed %s customer balance reminder(s).", processed)
    return processed


async def _latest_subscription(db, tenant_id: int) -> Subscription | None:
    result = await db.execute(
        select(Subscription)
        .where(Subscription.tenant_id == tenant_id)
        .order_by(Subscription.start_date.desc(), Subscription.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _process_trial_warnings_async(*, day: int) -> int:
    now = datetime.now(UTC)
    async with AsyncSessionLocal() as db:
        system_settings = await _system_settings(db)
        warning_attr = "trial_warning_sent_at" if day == 7 else "final_warning_sent_at"
        result = await db.execute(
            select(Tenant)
            .where(
                Tenant.subscription_status == SubscriptionStatus.TRIAL,
                Tenant.trial_started_at.is_not(None),
                Tenant.trial_ends_at.is_not(None),
                getattr(Tenant, warning_attr).is_(None),
            )
            .options(selectinload(Tenant.subscriptions))
        )
        processed = 0
        for tenant in result.scalars().all():
            elapsed_days = (now.date() - tenant.trial_started_at.date()).days
            if elapsed_days < day:
                continue
            days_remaining = max((tenant.trial_ends_at.date() - now.date()).days, 0)
            if day == 7:
                subject = "Your Farmexa free trial has 7 days remaining"
                body = (
                    f"Hello {tenant.contact_person or tenant.name},\n\n"
                    "Your free trial has 7 days remaining. Upgrade to keep using all modules.\n\n"
                    f"Workspace: {tenant.name}\nTrial ends: {tenant.trial_ends_at.date()}\n\nFarmexa Team"
                )
            else:
                subject = "Your Farmexa free trial ends tomorrow"
                body = (
                    f"Hello {tenant.contact_person or tenant.name},\n\n"
                    "Your free trial ends tomorrow. Upgrade now to avoid module deactivation.\n\n"
                    f"Workspace: {tenant.name}\nDays remaining: {days_remaining}\n\nFarmexa Team"
                )
            await log_and_send_email(
                db,
                tenant_id=tenant.id,
                recipient=tenant.email,
                subject=subject,
                body=body,
                email_type="Trial Day-7 Warning" if day == 7 else "Trial Day-13 Final Warning",
                system_settings=system_settings,
            )
            setattr(tenant, warning_attr, now)
            processed += 1
        await db.commit()
        return processed


async def _process_expired_trials_async() -> int:
    now = datetime.now(UTC)
    async with AsyncSessionLocal() as db:
        system_settings = await _system_settings(db)
        result = await db.execute(
            select(Tenant).where(
                Tenant.subscription_status == SubscriptionStatus.TRIAL,
                Tenant.trial_ends_at.is_not(None),
                Tenant.trial_ends_at <= now,
                Tenant.trial_expired_at.is_(None),
            )
        )
        expired = 0
        for tenant in result.scalars().all():
            tenant.status = TenantStatus.EXPIRED
            tenant.subscription_status = SubscriptionStatus.EXPIRED
            tenant.is_profile_only = True
            tenant.trial_expired_at = now

            latest = await _latest_subscription(db, tenant.id)
            if latest:
                latest.status = SubscriptionStatus.EXPIRED

            modules = (
                await db.execute(select(TenantModule).where(TenantModule.tenant_id == tenant.id))
            ).scalars().all()
            for module in modules:
                module.is_enabled = module.module_key in {"farm_profile", "settings"}

            body = (
                f"Hello {tenant.contact_person or tenant.name},\n\n"
                "Your Farmexa trial has ended. Operational modules are temporarily disabled, "
                "but your farm data is safe. Upgrade your subscription to reactivate your modules.\n\n"
                "Farmexa Team"
            )
            await log_and_send_email(
                db,
                tenant_id=tenant.id,
                recipient=tenant.email,
                subject="Your Farmexa trial has ended",
                body=body,
                email_type="Trial Expired Email",
                system_settings=system_settings,
            )
            expired += 1
        await db.commit()
        return expired
