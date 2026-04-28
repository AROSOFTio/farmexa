"""
Tenant / Company / Subscription models for Developer Admin and multi-tenancy control.
"""

import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import db_enum


class SubscriptionPlan(str, enum.Enum):
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"
    CUSTOM = "custom"


class TenantStatus(str, enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    EXPIRED = "expired"


class BillingCycle(str, enum.Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class Tenant(Base):
    """Represents a customer company / farm using FARMEXA."""

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    status: Mapped[TenantStatus] = mapped_column(
        db_enum(TenantStatus, name="tenantstatus"), default=TenantStatus.TRIAL
    )
    plan: Mapped[SubscriptionPlan] = mapped_column(
        db_enum(SubscriptionPlan, name="subscriptionplan"), default=SubscriptionPlan.BASIC
    )
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        db_enum(BillingCycle, name="billingcycle"), default=BillingCycle.MONTHLY
    )

    subscription_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    subscription_expiry: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    modules: Mapped[list["TenantModule"]] = relationship(
        "TenantModule", back_populates="tenant", cascade="all, delete-orphan"
    )
    subscription_history: Mapped[list["SubscriptionHistory"]] = relationship(
        "SubscriptionHistory", back_populates="tenant", cascade="all, delete-orphan"
    )


class TenantModule(Base):
    """Per-tenant module enable/disable toggle."""

    __tablename__ = "tenant_modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    module_key: Mapped[str] = mapped_column(String(100), index=True)  # e.g. "egg_production"
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="modules")


class SubscriptionHistory(Base):
    """Audit log of plan changes, suspensions, and reactivations."""

    __tablename__ = "subscription_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    changed_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(100))  # plan_change, suspend, reactivate, expiry
    old_plan: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_plan: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="subscription_history")
