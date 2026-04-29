"""
Tenant operational database provisioning and per-tenant session dependencies.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from threading import RLock
from typing import Any

from fastapi import Depends, HTTPException, status
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, URL, make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.base import Base
from app.db.session import AsyncSessionLocal, SyncSessionLocal
from app.models.auth import Role
from app.models.inventory import StockCategory, StockItem
from app.models.tenant import Tenant
from app.models.user import User

PLATFORM_ADMIN_ROLES = {"super_manager", "developer_admin"}

DEFAULT_PRODUCTION_STOCK_ITEMS = [
    {
        "name": "Dressed chicken",
        "sku": "PRD-DRESSED-CHICKEN",
        "description": "Whole dressed chicken produced from slaughter for sale and distribution.",
    },
    {
        "name": "Chicken breast",
        "sku": "PRD-CHICKEN-BREAST",
        "description": "Processed boneless or portioned chicken breast cuts.",
    },
    {
        "name": "Chicken thighs",
        "sku": "PRD-CHICKEN-THIGHS",
        "description": "Processed chicken thigh cuts ready for sale.",
    },
    {
        "name": "Chicken wings",
        "sku": "PRD-CHICKEN-WINGS",
        "description": "Processed chicken wing portions ready for sale.",
    },
    {
        "name": "Chicken drumsticks",
        "sku": "PRD-CHICKEN-DRUMSTICKS",
        "description": "Processed chicken drumstick portions ready for sale.",
    },
    {
        "name": "Gizzards",
        "sku": "PRD-GIZZARDS",
        "description": "Processed poultry gizzards handled as saleable byproducts.",
    },
    {
        "name": "Liver",
        "sku": "PRD-LIVER",
        "description": "Processed poultry liver handled as a saleable output.",
    },
    {
        "name": "Neck/backs",
        "sku": "PRD-NECK-BACKS",
        "description": "Processed neck and back portions tracked in inventory for sale.",
    },
    {
        "name": "Poultry manure",
        "sku": "PRD-POULTRY-MANURE",
        "description": "Collected poultry manure tracked as a byproduct in kilograms.",
    },
    {
        "name": "Feet",
        "sku": "PRD-FEET",
        "description": "Processed feet handled as a reusable poultry byproduct.",
    },
    {
        "name": "Head",
        "sku": "PRD-HEAD",
        "description": "Processed head handled as a reusable poultry byproduct.",
    },
]

_cache_lock = RLock()
_tenant_async_engines: dict[str, AsyncEngine] = {}
_tenant_sync_engines: dict[str, Engine] = {}
_tenant_async_sessions: dict[str, async_sessionmaker[AsyncSession]] = {}
_tenant_sync_sessions: dict[str, sessionmaker[Session]] = {}
_schema_initialized: set[str] = set()
_synced_user_ids: dict[str, set[int]] = {}


def _is_platform_admin(user: User | None) -> bool:
    return bool(user and user.role and user.role.name in PLATFORM_ADMIN_ROLES)


def _resolved_async_url() -> str:
    return settings.DATABASE_URL or settings.ASYNC_DATABASE_URL


def _resolved_sync_url() -> str:
    return settings.DATABASE_URL_SYNC or settings.SYNC_DATABASE_URL


def _url_for_database(url: str, database_name: str) -> str:
    resolved: URL = make_url(url)
    return resolved.set(database=database_name).render_as_string(hide_password=False)


def _maintenance_sync_url() -> str:
    return _url_for_database(_resolved_sync_url(), "postgres")


def _tenant_sync_url(database_name: str) -> str:
    return _url_for_database(_resolved_sync_url(), database_name)


def _tenant_async_url(database_name: str) -> str:
    return _url_for_database(_resolved_async_url(), database_name)


def operational_db_name_for_tenant(tenant_id: int) -> str:
    return f"farmexa_tenant_{tenant_id}"


def _build_tenant_snapshot(tenant: Tenant) -> dict[str, Any]:
    return {
        "id": int(tenant.id),
        "name": tenant.name,
        "slug": tenant.slug,
        "business_name": tenant.business_name,
        "contact_person": tenant.contact_person,
        "email": tenant.email,
        "phone": tenant.phone,
        "address": tenant.address,
        "country": tenant.country,
        "status": tenant.status,
        "plan": tenant.plan,
        "billing_cycle": tenant.billing_cycle,
        "subscription_start": tenant.subscription_start,
        "subscription_expiry": tenant.subscription_expiry,
        "is_suspended": tenant.is_suspended,
        "notes": tenant.notes,
    }


def _build_user_snapshot(user: User | None) -> dict[str, Any] | None:
    if user is None:
        return None

    role = user.role
    return {
        "id": int(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "hashed_password": user.hashed_password,
        "is_active": user.is_active,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "role": {
            "id": int(role.id),
            "name": role.name,
            "description": role.description,
        }
        if role is not None
        else None,
        "role_id": int(user.role_id) if user.role_id is not None else None,
        "tenant_id": int(user.tenant_id) if user.tenant_id is not None else None,
        "deleted_at": user.deleted_at,
    }


def _database_exists_sync(database_name: str) -> bool:
    engine = create_engine(_maintenance_sync_url(), isolation_level="AUTOCOMMIT", pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            return bool(
                connection.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :database_name"),
                    {"database_name": database_name},
                ).scalar()
            )
    finally:
        engine.dispose()


def _create_database_sync(database_name: str) -> None:
    engine = create_engine(_maintenance_sync_url(), isolation_level="AUTOCOMMIT", pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{database_name}"'))
    finally:
        engine.dispose()


def _get_or_create_sync_runtime(database_name: str) -> tuple[Engine, sessionmaker[Session], bool]:
    created = False
    with _cache_lock:
        engine = _tenant_sync_engines.get(database_name)
        factory = _tenant_sync_sessions.get(database_name)
        if engine is None or factory is None:
            engine = create_engine(
                _tenant_sync_url(database_name),
                echo=settings.DEBUG,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
            )
            factory = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False)
            _tenant_sync_engines[database_name] = engine
            _tenant_sync_sessions[database_name] = factory
            created = True
    return engine, factory, created


def _get_or_create_async_runtime(database_name: str) -> tuple[AsyncEngine, async_sessionmaker[AsyncSession]]:
    with _cache_lock:
        engine = _tenant_async_engines.get(database_name)
        factory = _tenant_async_sessions.get(database_name)
        if engine is None or factory is None:
            engine = create_async_engine(
                _tenant_async_url(database_name),
                echo=settings.DEBUG,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
            )
            factory = async_sessionmaker(
                engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
                autocommit=False,
            )
            _tenant_async_engines[database_name] = engine
            _tenant_async_sessions[database_name] = factory
    return engine, factory


def _ensure_schema_ready_sync(database_name: str) -> sessionmaker[Session]:
    engine, factory, created_runtime = _get_or_create_sync_runtime(database_name)
    needs_schema_init = created_runtime
    with _cache_lock:
        if database_name not in _schema_initialized:
            needs_schema_init = True
    if needs_schema_init:
        Base.metadata.create_all(bind=engine)
        with _cache_lock:
            _schema_initialized.add(database_name)
    return factory


def _upsert_tenant_identity(session: Session, tenant_snapshot: dict[str, Any]) -> None:
    tenant = session.get(Tenant, tenant_snapshot["id"])
    if tenant is None:
        tenant = Tenant(
            id=tenant_snapshot["id"],
            name=tenant_snapshot["name"],
            slug=tenant_snapshot["slug"],
            business_name=tenant_snapshot["business_name"],
            contact_person=tenant_snapshot["contact_person"],
            email=tenant_snapshot["email"],
            phone=tenant_snapshot["phone"],
            address=tenant_snapshot["address"],
            country=tenant_snapshot["country"],
            status=tenant_snapshot["status"],
            plan=tenant_snapshot["plan"],
            billing_cycle=tenant_snapshot["billing_cycle"],
            subscription_start=tenant_snapshot["subscription_start"],
            subscription_expiry=tenant_snapshot["subscription_expiry"],
            is_suspended=tenant_snapshot["is_suspended"],
            notes=tenant_snapshot["notes"],
            operational_db_name=operational_db_name_for_tenant(tenant_snapshot["id"]),
            operational_db_status="ready",
            operational_db_ready_at=datetime.now(UTC),
            operational_db_last_error=None,
        )
        session.add(tenant)
        return

    tenant.name = tenant_snapshot["name"]
    tenant.slug = tenant_snapshot["slug"]
    tenant.business_name = tenant_snapshot["business_name"]
    tenant.contact_person = tenant_snapshot["contact_person"]
    tenant.email = tenant_snapshot["email"]
    tenant.phone = tenant_snapshot["phone"]
    tenant.address = tenant_snapshot["address"]
    tenant.country = tenant_snapshot["country"]
    tenant.status = tenant_snapshot["status"]
    tenant.plan = tenant_snapshot["plan"]
    tenant.billing_cycle = tenant_snapshot["billing_cycle"]
    tenant.subscription_start = tenant_snapshot["subscription_start"]
    tenant.subscription_expiry = tenant_snapshot["subscription_expiry"]
    tenant.is_suspended = tenant_snapshot["is_suspended"]
    tenant.notes = tenant_snapshot["notes"]
    tenant.operational_db_name = operational_db_name_for_tenant(tenant_snapshot["id"])
    tenant.operational_db_status = "ready"
    tenant.operational_db_last_error = None
    if tenant.operational_db_ready_at is None:
        tenant.operational_db_ready_at = datetime.now(UTC)


def _upsert_user_identity(session: Session, user_snapshot: dict[str, Any] | None) -> None:
    if user_snapshot is None:
        return

    role_payload = user_snapshot.get("role")
    if role_payload:
        role = session.get(Role, role_payload["id"])
        if role is None:
            role = Role(
                id=role_payload["id"],
                name=role_payload["name"],
                description=role_payload["description"],
            )
            session.add(role)
        else:
            role.name = role_payload["name"]
            role.description = role_payload["description"]

    user = session.get(User, user_snapshot["id"])
    if user is None:
        user = User(
            id=user_snapshot["id"],
            email=user_snapshot["email"],
            full_name=user_snapshot["full_name"],
            hashed_password=user_snapshot["hashed_password"],
            is_active=user_snapshot["is_active"],
            phone=user_snapshot["phone"],
            avatar_url=user_snapshot["avatar_url"],
            role_id=user_snapshot["role_id"],
            tenant_id=user_snapshot["tenant_id"],
        )
        user.deleted_at = user_snapshot["deleted_at"]
        session.add(user)
        return

    user.email = user_snapshot["email"]
    user.full_name = user_snapshot["full_name"]
    user.hashed_password = user_snapshot["hashed_password"]
    user.is_active = user_snapshot["is_active"]
    user.phone = user_snapshot["phone"]
    user.avatar_url = user_snapshot["avatar_url"]
    user.role_id = user_snapshot["role_id"]
    user.tenant_id = user_snapshot["tenant_id"]
    user.deleted_at = user_snapshot["deleted_at"]


def _seed_default_inventory_items(session: Session) -> None:
    for item in DEFAULT_PRODUCTION_STOCK_ITEMS:
        existing = session.query(StockItem).filter(StockItem.sku == item["sku"]).first()
        if existing is not None:
            existing.name = item["name"]
            existing.category = StockCategory.FINISHED_PRODUCT
            existing.unit_of_measure = "kg"
            existing.description = item["description"]
            existing.is_active = True
            continue

        session.add(
            StockItem(
                sku=item["sku"],
                name=item["name"],
                category=StockCategory.FINISHED_PRODUCT,
                unit_of_measure="kg",
                current_quantity=0.0,
                reorder_level=0.0,
                unit_price=0.0,
                average_cost=0.0,
                description=item["description"],
                is_active=True,
            )
        )


def _mark_user_synced(database_name: str, user_snapshot: dict[str, Any] | None) -> None:
    if user_snapshot is None:
        return
    with _cache_lock:
        _synced_user_ids.setdefault(database_name, set()).add(int(user_snapshot["id"]))


def _is_user_already_synced(database_name: str, user_id: int) -> bool:
    with _cache_lock:
        return database_name in _schema_initialized and user_id in _synced_user_ids.get(database_name, set())


def _ensure_tenant_database_sync(
    *,
    database_name: str,
    tenant_snapshot: dict[str, Any],
    user_snapshot: dict[str, Any] | None,
) -> None:
    with _cache_lock:
        database_exists = _database_exists_sync(database_name)
        if not database_exists:
            _create_database_sync(database_name)

        session_factory = _ensure_schema_ready_sync(database_name)
        with session_factory() as session:
            _upsert_tenant_identity(session, tenant_snapshot)
            _upsert_user_identity(session, user_snapshot)
            _seed_default_inventory_items(session)
            session.commit()
        _mark_user_synced(database_name, user_snapshot)


async def _wait_for_provisioned_database(tenant_id: int, database_name: str) -> bool:
    for _ in range(20):
        await asyncio.sleep(0.5)
        async with AsyncSessionLocal() as central_db:
            tenant = await central_db.get(Tenant, tenant_id)
            if tenant is None:
                return False
            if tenant.operational_db_name != database_name:
                return False
            if tenant.operational_db_status == "ready":
                return True
            if tenant.operational_db_status == "failed":
                return False
    return False


async def _ensure_operational_database_ready(current_user: User) -> str:
    if _is_platform_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Platform administrators do not operate inside a tenant database context.",
        )

    tenant_id = int(current_user.tenant_id or 0)
    if tenant_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not assigned to a tenant.",
        )

    async with AsyncSessionLocal() as central_db:
        tenant = await central_db.get(Tenant, tenant_id)
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant account was not found.",
            )

        database_name = tenant.operational_db_name or operational_db_name_for_tenant(tenant.id)
        if tenant.operational_db_status == "ready" and _is_user_already_synced(database_name, int(current_user.id)):
            return database_name
        if tenant.operational_db_status == "provisioning" and tenant.operational_db_name == database_name:
            if await _wait_for_provisioned_database(tenant_id, database_name):
                await central_db.refresh(tenant)
                if tenant.operational_db_status == "ready" and _is_user_already_synced(database_name, int(current_user.id)):
                    return database_name
        if tenant.operational_db_status != "ready" or tenant.operational_db_name != database_name:
            tenant.operational_db_name = database_name
            tenant.operational_db_status = "provisioning"
            tenant.operational_db_last_error = None
            await central_db.commit()

        tenant_snapshot = _build_tenant_snapshot(tenant)
        user_snapshot = _build_user_snapshot(current_user)

        try:
            await run_in_threadpool(
                _ensure_tenant_database_sync,
                database_name=database_name,
                tenant_snapshot=tenant_snapshot,
                user_snapshot=user_snapshot,
            )
        except SQLAlchemyError as exc:
            tenant.operational_db_status = "failed"
            tenant.operational_db_last_error = str(exc)[:2000]
            await central_db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to provision the tenant operational database.",
            ) from exc
        except Exception as exc:
            tenant.operational_db_status = "failed"
            tenant.operational_db_last_error = str(exc)[:2000]
            await central_db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize the tenant operational database.",
            ) from exc

        tenant.operational_db_status = "ready"
        tenant.operational_db_last_error = None
        if tenant.operational_db_ready_at is None:
            tenant.operational_db_ready_at = datetime.now(UTC)
        await central_db.commit()
        return database_name


async def provision_tenant_operational_database(tenant: Tenant, tenant_admin: User | None = None) -> None:
    database_name = tenant.operational_db_name or operational_db_name_for_tenant(int(tenant.id))
    tenant_snapshot = _build_tenant_snapshot(tenant)
    user_snapshot = _build_user_snapshot(tenant_admin)

    try:
        await run_in_threadpool(
            _ensure_tenant_database_sync,
            database_name=database_name,
            tenant_snapshot=tenant_snapshot,
            user_snapshot=user_snapshot,
        )
    except Exception as exc:
        tenant.operational_db_name = database_name
        tenant.operational_db_status = "failed"
        tenant.operational_db_last_error = str(exc)[:2000]
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tenant operational database provisioning failed.",
        ) from exc

    tenant.operational_db_name = database_name
    tenant.operational_db_status = "ready"
    tenant.operational_db_ready_at = tenant.operational_db_ready_at or datetime.now(UTC)
    tenant.operational_db_last_error = None
    _mark_user_synced(database_name, user_snapshot)


async def get_tenant_db(current_user: User = Depends(get_current_user)):
    if _is_platform_admin(current_user) or not current_user.tenant_id:
        async with AsyncSessionLocal() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
        return

    database_name = await _ensure_operational_database_ready(current_user)
    _, session_factory = _get_or_create_async_runtime(database_name)
    async with session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_tenant_sync_db(current_user: User = Depends(get_current_user)):
    if _is_platform_admin(current_user) or not current_user.tenant_id:
        session = SyncSessionLocal()
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
        return

    database_name = await _ensure_operational_database_ready(current_user)
    _engine, session_factory, _created_runtime = _get_or_create_sync_runtime(database_name)
    session = session_factory()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


async def dispose_tenant_engines() -> None:
    async_engines = list(_tenant_async_engines.values())
    sync_engines = list(_tenant_sync_engines.values())

    for engine in async_engines:
        await engine.dispose()
    for engine in sync_engines:
        engine.dispose()
