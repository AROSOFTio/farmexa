"""
Tenant operational database provisioning and per-tenant session dependencies.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from threading import RLock
from typing import Any

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy import create_engine, inspect, text
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
from app.models.feed import FeedCategory, FeedItem
from app.models.farm import PoultryHouse, PoultryHouseSection  # noqa: F401
from app.models.inventory import MovementType, StockCategory, StockItem, StockMovement
from app.models.tenant import Tenant
from app.models.branch import Branch, BranchType
from app.models.user import User
import app.models  # noqa: F401
from app.services.inventory_coordinator import ReferenceType
from app.seeds.chart_of_accounts_seed import seed_chart_of_accounts, create_default_fiscal_year
from app.services.stock_sku import generate_unique_sku

from sqlalchemy import event
from sqlalchemy.orm import with_loader_criteria

_branch_scoped_classes: list[type] | None = None


def _get_branch_scoped_classes() -> list[type]:
    """Mapped classes that carry a branch_id column (computed once, post-configuration)."""
    global _branch_scoped_classes
    if _branch_scoped_classes is None:
        _branch_scoped_classes = [
            mapper.class_
            for mapper in Base.registry.mappers
            if hasattr(mapper.class_, "branch_id")
        ]
    return _branch_scoped_classes


@event.listens_for(Session, "do_orm_execute")
def _add_branch_filter(execute_state):
    if execute_state.is_select or execute_state.is_update or execute_state.is_delete:
        branch_ids = execute_state.session.info.get("branch_ids")
        if branch_ids is not None:
            # Concrete per-class criteria (not a lambda over Base): a closure over a
            # plain list is not cacheable as a SQL element and raises InvalidRequestError.
            execute_state.statement = execute_state.statement.options(
                *[
                    with_loader_criteria(cls, (cls.branch_id.in_(branch_ids)) | (cls.branch_id.is_(None)), include_aliases=True)
                    for cls in _get_branch_scoped_classes()
                ]
            )



PLATFORM_ADMIN_ROLES = {"super_manager", "developer_admin"}

DEFAULT_PRODUCTION_STOCK_ITEMS: list[dict[str, str]] = []

DEFAULT_FEED_RAW_MATERIALS: list[tuple[str, float]] = []

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
        "job_title": user.job_title,
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
    _apply_runtime_schema_patches(engine)
    return factory


def _apply_runtime_schema_patches(engine: Engine) -> None:
    Base.metadata.tables["stock_items"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["stock_movements"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["reference_items"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["poultry_houses"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["poultry_house_sections"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["batches"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["mortality_logs"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["vaccination_logs"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["growth_logs"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["feed_formulations"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["feed_formulation_ingredients"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["feed_production_batches"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["stock_transfers"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["email_logs"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["master_data_requests"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["invoice_balance_reminders"].create(bind=engine, checkfirst=True)
    # Phase 1: Enterprise Accounting tables
    Base.metadata.tables["accounts"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["account_templates"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["template_accounts"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["fiscal_years"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["opening_balances"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["journal_entries"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["journal_lines"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["system_account_mappings"].create(bind=engine, checkfirst=True)
    # Phase 2: Multi-Branch Enterprise Architecture
    Base.metadata.tables["branches"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["user_branch_access"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["branch_transfers"].create(bind=engine, checkfirst=True)
    Base.metadata.tables["branch_transfer_items"].create(bind=engine, checkfirst=True)
    inspector = inspect(engine)
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        type_exists = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'referencedatatype'")).scalar()
        if type_exists:
            values = ['bird_type', 'house_section_type', 'feed_type', 'medicine_type', 'egg_grade', 'slaughter_part', 'byproduct_type', 'expense_category', 'payment_method', 'unit_of_measure', 'customer_type']
            for val in values:
                try:
                    conn.execute(text(f"ALTER TYPE referencedatatype ADD VALUE IF NOT EXISTS '{val}'"))
                except Exception:
                    pass

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'tenants'
                          AND column_name = 'plan'
                          AND udt_name = 'subscriptionplan'
                    ) THEN
                        ALTER TABLE tenants ALTER COLUMN plan TYPE VARCHAR(50) USING plan::text;
                    END IF;
                END $$;
                """
            )
        )
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(120)"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(80)"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS products_supplied TEXT"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_officer VARCHAR(100)"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(50)"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_id VARCHAR(80)"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(120)"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS lead_time_days INTEGER"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS notes TEXT"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true"))
        connection.execute(text("ALTER TABLE batches ADD COLUMN IF NOT EXISTS section_id INTEGER"))
        connection.execute(text("ALTER TABLE batches ADD COLUMN IF NOT EXISTS stock_item_id INTEGER"))
        connection.execute(text("ALTER TABLE feed_items ADD COLUMN IF NOT EXISTS stock_item_id INTEGER"))
        connection.execute(text("ALTER TABLE tenant_modules ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN NOT NULL DEFAULT false"))
        # Phase 2 Branch ID patches
        connection.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
        connection.execute(text("ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
        connection.execute(text("ALTER TABLE store_locations ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
        connection.execute(text("ALTER TABLE poultry_houses ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
        connection.execute(text("ALTER TABLE batches ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
        connection.execute(text("ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
        connection.execute(text("ALTER TABLE feed_purchases ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
        connection.execute(text("ALTER TABLE feed_production_batches ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_batches_section_id ON batches (section_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_batches_stock_item_id ON batches (stock_item_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_feed_items_stock_item_id ON feed_items (stock_item_id)"))
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_batches_section_id'
                    ) THEN
                        ALTER TABLE batches
                        ADD CONSTRAINT fk_batches_section_id
                        FOREIGN KEY (section_id) REFERENCES poultry_house_sections(id) ON DELETE SET NULL;
                    END IF;
                END $$;
                """
            )
        )
        connection.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_batches_stock_item_id'
                    ) THEN
                        ALTER TABLE batches
                        ADD CONSTRAINT fk_batches_stock_item_id
                        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE SET NULL;
                    END IF;
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_constraint
                        WHERE conname = 'fk_feed_items_stock_item_id'
                    ) THEN
                        ALTER TABLE feed_items
                        ADD CONSTRAINT fk_feed_items_stock_item_id
                        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE SET NULL;
                    END IF;
                END $$;
                """
            )
        )
        # ---------------------------------------------------------------
        # Phase 1 — Enterprise Accounting column migrations
        # ---------------------------------------------------------------
        # accounts: add new enterprise columns
        connection.execute(text("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tenant_id INTEGER"))
        connection.execute(text("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS description TEXT"))
        connection.execute(text("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS allow_manual_entries BOOLEAN NOT NULL DEFAULT true"))
        connection.execute(text("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false"))
        # Add normal_balance column (enum must be created first safely)
        connection.execute(
            text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'normalbalance') THEN
                    CREATE TYPE normalbalance AS ENUM ('debit', 'credit');
                END IF;
            END $$;
            """)
        )
        connection.execute(
            text("""
            ALTER TABLE accounts ADD COLUMN IF NOT EXISTS normal_balance normalbalance NOT NULL DEFAULT 'debit';
            """)
        )
        # Add fiscalyearstatus enum
        connection.execute(
            text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fiscalyearstatus') THEN
                    CREATE TYPE fiscalyearstatus AS ENUM ('open', 'closed', 'locked');
                END IF;
            END $$;
            """)
        )
        # accounts: migrate unique constraint from global to per-tenant
        connection.execute(
            text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_account_code_key'
                ) THEN
                    ALTER TABLE accounts DROP CONSTRAINT accounts_account_code_key;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_account_code_tenant'
                ) THEN
                    ALTER TABLE accounts ADD CONSTRAINT uq_account_code_tenant
                        UNIQUE (account_code, tenant_id);
                END IF;
            END $$;
            """)
        )
        # journal_entries: add missing audit columns that AccountingService references
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS tenant_id INTEGER"))
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50)"))
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_id INTEGER"))
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS notes TEXT"))
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER"))
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ"))
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_by_user_id INTEGER"))
        # Indexes for new columns
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_accounts_tenant_id ON accounts (tenant_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_journal_entries_tenant_id ON journal_entries (tenant_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_journal_entries_reference_type ON journal_entries (reference_type)"))
        # ---------------------------------------------------------------
        # Phase 2 — Multi-Branch Enterprise Data Isolation
        # ---------------------------------------------------------------
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        connection.execute(text("ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        connection.execute(text("ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        connection.execute(text("ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        connection.execute(text("ALTER TABLE batches ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        connection.execute(text("ALTER TABLE feed_purchases ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        connection.execute(text("ALTER TABLE feed_consumptions ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        connection.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        connection.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        connection.execute(text("ALTER TABLE poultry_houses ADD COLUMN IF NOT EXISTS branch_id INTEGER"))
        
        # Add index for branch_id on heavy operational tables
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_journal_entries_branch_id ON journal_entries (branch_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_branch_id ON stock_movements (branch_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_batches_branch_id ON batches (branch_id)"))
        
        # ---------------------------------------------------------------
        # Phase 4 — Poultry Accounting Automation
        # ---------------------------------------------------------------
        connection.execute(text("ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS batch_id INTEGER"))
        connection.execute(text("ALTER TABLE orders ADD COLUMN IF NOT EXISTS batch_id INTEGER"))
        connection.execute(text("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS batch_id INTEGER"))
        connection.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS batch_id INTEGER"))
        connection.execute(text("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS batch_id INTEGER"))
        
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_movements_batch_id ON stock_movements (batch_id)"))

        # Note: We don't automatically backfill branch_id here because head office might not be created yet.
        # A separate service handles default branch assignment on initialization.

        # ---------------------------------------------------------------
        # Reconcile missing columns and views for dynamic tenant databases
        # ---------------------------------------------------------------
        connection.execute(text("ALTER TABLE batches ADD COLUMN IF NOT EXISTS chick_cost NUMERIC(18, 4) DEFAULT 0"))
        connection.execute(text("ALTER TABLE batches ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL"))
        connection.execute(text("ALTER TABLE egg_production_logs ADD COLUMN IF NOT EXISTS price_per_tray NUMERIC(18, 4)"))
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN NOT NULL DEFAULT false"))
        connection.execute(text("ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversal_of_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL"))
        connection.execute(text("ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE"))
        connection.execute(text("ALTER TABLE slaughter_records ADD COLUMN IF NOT EXISTS direct_labour_cost NUMERIC(18, 4)"))
        connection.execute(text("ALTER TABLE slaughter_records ADD COLUMN IF NOT EXISTS overhead_cost NUMERIC(18, 4)"))
        connection.execute(text("ALTER TABLE slaughter_records ADD COLUMN IF NOT EXISTS total_production_cost NUMERIC(18, 4)"))
        connection.execute(text("ALTER TABLE slaughter_records ADD COLUMN IF NOT EXISTS cost_per_kg NUMERIC(18, 4)"))
        connection.execute(text("ALTER TABLE slaughter_records ADD COLUMN IF NOT EXISTS production_journal_id INTEGER"))
        connection.execute(text("ALTER TABLE slaughter_records ADD COLUMN IF NOT EXISTS chick_cost_override NUMERIC(18, 4)"))
        # branch_transfers.status was historically bound to the stock_transfers
        # 'transferstatus' type, whose values don't match — convert to its own type.
        connection.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'branchtransferstatus') THEN
                    CREATE TYPE branchtransferstatus AS ENUM ('pending', 'in_transit', 'completed', 'rejected', 'cancelled');
                END IF;
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'branch_transfers' AND column_name = 'status' AND udt_name = 'transferstatus'
                ) THEN
                    ALTER TABLE branch_transfers ALTER COLUMN status DROP DEFAULT;
                    ALTER TABLE branch_transfers
                        ALTER COLUMN status TYPE branchtransferstatus
                        USING (CASE status::text
                            WHEN 'draft' THEN 'pending'
                            WHEN 'issued' THEN 'in_transit'
                            WHEN 'received' THEN 'completed'
                            ELSE 'cancelled'
                        END)::branchtransferstatus;
                END IF;
            END $$;
        """))
        connection.execute(text("ALTER TABLE expense_categories ADD COLUMN IF NOT EXISTS default_account_code VARCHAR(20)"))
        connection.execute(text("ALTER TABLE income_categories ADD COLUMN IF NOT EXISTS default_account_code VARCHAR(20)"))
        connection.execute(text("ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL"))
        connection.execute(text("""
            CREATE OR REPLACE VIEW customer_balances AS
            SELECT
                c.id AS customer_id,
                COALESCE(
                    SUM(
                        CASE
                            WHEN i.status::text <> 'cancelled'
                            THEN i.total_amount - i.paid_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS balance
            FROM customers c
            LEFT JOIN invoices i ON i.customer_id = c.id
            GROUP BY c.id
        """))


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
            job_title=user_snapshot["job_title"],
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
    user.job_title = user_snapshot["job_title"]
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

    raw_category = session.query(FeedCategory).filter(FeedCategory.name == "Raw Materials").first()
    if raw_category is None:
        raw_category = FeedCategory(name="Raw Materials", description="Feed mill raw material stock.")
        session.add(raw_category)
        session.flush()

    for name, opening_stock in DEFAULT_FEED_RAW_MATERIALS:
        existing_feed = session.query(FeedItem).filter(FeedItem.name == name).first()
        existing_stock = (
            session.get(StockItem, existing_feed.stock_item_id)
            if existing_feed is not None and existing_feed.stock_item_id is not None
            else None
        )
        if existing_feed is not None and existing_stock is not None:
            continue

        stock_item = StockItem(
            sku=generate_unique_sku(session, "FEED", name),
            name=name,
            category=StockCategory.RAW_MATERIAL,
            unit_of_measure="kg",
            current_quantity=0.0,
            reorder_level=500.0,
            unit_price=0.0,
            average_cost=0.0,
            description=f"Default feed raw material: {name}",
            is_active=True,
        )
        session.add(stock_item)
        session.flush()

        if existing_feed is None:
            existing_feed = FeedItem(
                name=name,
                category_id=raw_category.id,
                unit="kg",
                current_stock=0.0,
                reorder_threshold=500.0,
            )
            session.add(existing_feed)
            session.flush()
        else:
            existing_feed.category_id = raw_category.id
            existing_feed.unit = existing_feed.unit or "kg"
            existing_feed.reorder_threshold = existing_feed.reorder_threshold or 500.0
        existing_feed.stock_item_id = stock_item.id

        if opening_stock > 0:
            session.add(
                StockMovement(
                    item_id=stock_item.id,
                    movement_type=MovementType.IN,
                    quantity=opening_stock,
                    previous_quantity=0.0,
                    new_quantity=opening_stock,
                    reference_type=ReferenceType.INITIAL_STOCK.value,
                    reference_id=existing_feed.id,
                    unit_cost=0.0,
                    notes=f"Tenant seed opening stock for {name}",
                )
            )
            stock_item.current_quantity = opening_stock


def _seed_default_branch(session: Session, tenant_snapshot: dict[str, Any]) -> None:
    # Create Head Office if no branch exists
    branch = session.query(Branch).filter(Branch.branch_code == "HQ").first()
    if branch is None:
        branch = Branch(
            tenant_id=tenant_snapshot["id"],
            name="Head Office",
            branch_code="HQ",
            type=BranchType.HEAD_OFFICE,
            address=tenant_snapshot.get("address") or "Headquarters",
            is_active=True,
            is_default=True,
        )
        session.add(branch)
        session.flush()

        # Update all operational records to belong to HQ branch if their branch_id is NULL
        tables_to_update = [
            "stock_items", "stock_movements", "store_locations",
            "poultry_houses", "batches", "suppliers",
            "feed_purchases", "feed_production_batches"
        ]
        for table in tables_to_update:
            session.execute(text(f"UPDATE {table} SET branch_id = :branch_id WHERE branch_id IS NULL"), {"branch_id": branch.id})


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
            _seed_default_branch(session, tenant_snapshot)
            _seed_default_inventory_items(session)
            # Seed Chart of Accounts + fiscal year if not already present
            seed_chart_of_accounts(session, tenant_id=tenant_snapshot["id"])
            create_default_fiscal_year(session, tenant_id=tenant_snapshot["id"])
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
            await run_in_threadpool(_ensure_schema_ready_sync, database_name)
            return database_name
        if tenant.operational_db_status == "provisioning" and tenant.operational_db_name == database_name:
            if await _wait_for_provisioned_database(tenant_id, database_name):
                await central_db.refresh(tenant)
                if tenant.operational_db_status == "ready" and _is_user_already_synced(database_name, int(current_user.id)):
                    await run_in_threadpool(_ensure_schema_ready_sync, database_name)
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


async def get_tenant_db(request: Request, current_user: User = Depends(get_current_user)):
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
        requested_branch = request.headers.get("x-branch-id")
        requested_branch_id = int(requested_branch) if requested_branch and requested_branch.isdigit() else None

        if current_user.role and current_user.role.name not in PLATFORM_ADMIN_ROLES.union({"manager", "tenant_admin"}):
            from app.models.branch import UserBranchAccess
            from sqlalchemy import select
            result = await session.execute(
                select(UserBranchAccess.branch_id).where(UserBranchAccess.user_id == current_user.id)
            )
            branch_ids = list(result.scalars().all())
            if not branch_ids:
                raise HTTPException(status_code=403, detail="No branch access.")
            
            if requested_branch_id:
                if requested_branch_id not in branch_ids:
                    raise HTTPException(status_code=403, detail="You do not have access to this branch.")
                session.info["branch_ids"] = [requested_branch_id]
            else:
                session.info["branch_ids"] = branch_ids
        else:
            session.info["branch_ids"] = [requested_branch_id] if requested_branch_id else None
            
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_tenant_sync_db(request: Request, current_user: User = Depends(get_current_user)):
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
    
    requested_branch = request.headers.get("x-branch-id")
    requested_branch_id = int(requested_branch) if requested_branch and requested_branch.isdigit() else None
    
    if current_user.role and current_user.role.name not in PLATFORM_ADMIN_ROLES.union({"manager", "tenant_admin"}):
        from app.models.branch import UserBranchAccess
        from sqlalchemy import select
        result = session.execute(
            select(UserBranchAccess.branch_id).where(UserBranchAccess.user_id == current_user.id)
        )
        branch_ids = list(result.scalars().all())
        if not branch_ids:
            session.close()
            raise HTTPException(status_code=403, detail="No branch access.")
            
        if requested_branch_id:
            if requested_branch_id not in branch_ids:
                session.close()
                raise HTTPException(status_code=403, detail="You do not have access to this branch.")
            session.info["branch_ids"] = [requested_branch_id]
        else:
            session.info["branch_ids"] = branch_ids
    else:
        session.info["branch_ids"] = [requested_branch_id] if requested_branch_id else None

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
