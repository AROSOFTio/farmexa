"""
Tenant, SaaS subscription, plan, and module models.
"""

import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
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


class SubscriptionStatus(str, enum.Enum):
    TRIAL = "trial"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    EXPIRED = "expired"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class DomainStatus(str, enum.Enum):
    PENDING_DNS = "pending_dns"
    DNS_VERIFIED = "dns_verified"
    SSL_PENDING = "ssl_pending"
    ACTIVE = "active"
    FAILED = "failed"
    DISABLED = "disabled"


class DomainType(str, enum.Enum):
    PLATFORM_SUBDOMAIN = "platform_subdomain"
    CUSTOM = "custom"


class ModuleRequestStatus(str, enum.Enum):
    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    ACTIVATED = "activated"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Tenant(Base):
    """Represents a customer company / farm using FARMEXA."""

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    business_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
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
    users: Mapped[list["User"]] = relationship("User", back_populates="tenant")
    subscription_history: Mapped[list["SubscriptionHistory"]] = relationship(
        "SubscriptionHistory", back_populates="tenant", cascade="all, delete-orphan"
    )
    domains: Mapped[list["TenantDomain"]] = relationship(
        "TenantDomain", back_populates="tenant", cascade="all, delete-orphan"
    )
    subscriptions: Mapped[list["Subscription"]] = relationship(
        "Subscription", back_populates="tenant", cascade="all, delete-orphan"
    )
    compliance_documents: Mapped[list["ComplianceDocument"]] = relationship(
        "ComplianceDocument", back_populates="tenant", cascade="all, delete-orphan"
    )
    module_requests: Mapped[list["TenantModuleRequest"]] = relationship(
        "TenantModuleRequest", back_populates="tenant", cascade="all, delete-orphan"
    )
    billing_invoices: Mapped[list["BillingInvoice"]] = relationship(
        "BillingInvoice", back_populates="tenant", cascade="all, delete-orphan"
    )
    billing_payments: Mapped[list["BillingPayment"]] = relationship(
        "BillingPayment", back_populates="tenant", cascade="all, delete-orphan"
    )
    payment_callbacks: Mapped[list["PaymentCallbackLog"]] = relationship(
        "PaymentCallbackLog", back_populates="tenant", cascade="all, delete-orphan"
    )


class PlatformModule(Base):
    """Catalog of modules that can be sold/enabled per tenant."""

    __tablename__ = "modules"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_core: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    plan_modules: Mapped[list["PlanModule"]] = relationship(
        "PlanModule", back_populates="module", cascade="all, delete-orphan"
    )
    tenant_modules: Mapped[list["TenantModule"]] = relationship("TenantModule", back_populates="module")
    prices: Mapped[list["ModulePrice"]] = relationship(
        "ModulePrice", back_populates="module", cascade="all, delete-orphan"
    )


class PlanDefinition(Base):
    """Configurable subscription plans."""

    __tablename__ = "plans"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        db_enum(BillingCycle, name="billingcycle"), default=BillingCycle.MONTHLY
    )
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    modules: Mapped[list["PlanModule"]] = relationship(
        "PlanModule", back_populates="plan", cascade="all, delete-orphan"
    )
    subscriptions: Mapped[list["Subscription"]] = relationship("Subscription", back_populates="plan")


class PlanModule(Base):
    """Module inclusions for a plan."""

    __tablename__ = "plan_modules"
    __table_args__ = (
        UniqueConstraint("plan_code", "module_key", name="uq_plan_module"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_code: Mapped[str] = mapped_column(ForeignKey("plans.code", ondelete="CASCADE"), index=True)
    module_key: Mapped[str] = mapped_column(ForeignKey("modules.key", ondelete="CASCADE"), index=True)
    is_included: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    plan: Mapped["PlanDefinition"] = relationship("PlanDefinition", back_populates="modules")
    module: Mapped["PlatformModule"] = relationship("PlatformModule", back_populates="plan_modules")


class TenantModule(Base):
    """Per-tenant module enable/disable toggle."""

    __tablename__ = "tenant_modules"
    __table_args__ = (
        UniqueConstraint("tenant_id", "module_key", name="uq_tenant_module"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    module_key: Mapped[str] = mapped_column(ForeignKey("modules.key", ondelete="CASCADE"), index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="modules")
    module: Mapped["PlatformModule"] = relationship("PlatformModule", back_populates="tenant_modules")


class TenantDomain(Base):
    """Assigned domains or subdomains for a tenant."""

    __tablename__ = "tenant_domains"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    host: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    normalized_host: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    domain_type: Mapped[DomainType] = mapped_column(
        db_enum(DomainType, name="domaintype"), default=DomainType.PLATFORM_SUBDOMAIN
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[DomainStatus] = mapped_column(
        db_enum(DomainStatus, name="domainstatus"), default=DomainStatus.PENDING_DNS
    )
    verification_target: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dns_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ssl_requested_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ssl_issued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    disabled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="domains")


class Subscription(Base):
    """Subscription ledger for billing and access lifecycle."""

    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    plan_code: Mapped[str] = mapped_column(ForeignKey("plans.code", ondelete="RESTRICT"), index=True)
    status: Mapped[SubscriptionStatus] = mapped_column(
        db_enum(SubscriptionStatus, name="subscriptionstatus"), default=SubscriptionStatus.TRIAL
    )
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        db_enum(BillingCycle, name="billingcycle"), default=BillingCycle.MONTHLY
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    next_invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="UGX")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="subscriptions")
    plan: Mapped["PlanDefinition"] = relationship("PlanDefinition", back_populates="subscriptions")


class ModulePrice(Base):
    """Optional pricing overrides per module and billing cycle."""

    __tablename__ = "module_prices"
    __table_args__ = (
        UniqueConstraint("module_key", "billing_cycle", name="uq_module_price_cycle"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    module_key: Mapped[str] = mapped_column(ForeignKey("modules.key", ondelete="CASCADE"), index=True)
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        db_enum(BillingCycle, name="billingcycle"), default=BillingCycle.MONTHLY
    )
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="UGX")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    module: Mapped["PlatformModule"] = relationship("PlatformModule", back_populates="prices")


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


class TenantModuleRequest(Base):
    """Pending tenant module upgrade or downgrade request."""

    __tablename__ = "tenant_module_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    requested_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[ModuleRequestStatus] = mapped_column(
        db_enum(ModuleRequestStatus, name="modulerequeststatus"),
        default=ModuleRequestStatus.PENDING_PAYMENT,
        index=True,
    )
    billing_cycle: Mapped[BillingCycle] = mapped_column(
        db_enum(BillingCycle, name="billingcycle"), default=BillingCycle.MONTHLY
    )
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="UGX")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="module_requests")
    requested_by_user: Mapped[Optional["User"]] = relationship("User")
    items: Mapped[list["TenantModuleRequestItem"]] = relationship(
        "TenantModuleRequestItem", back_populates="request", cascade="all, delete-orphan"
    )
    invoice: Mapped[Optional["BillingInvoice"]] = relationship(
        "BillingInvoice", back_populates="request", uselist=False
    )


class TenantModuleRequestItem(Base):
    """Individual module line item in an upgrade request."""

    __tablename__ = "tenant_module_request_items"
    __table_args__ = (UniqueConstraint("request_id", "module_key", name="uq_tenant_module_request_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("tenant_module_requests.id", ondelete="CASCADE"), index=True)
    module_key: Mapped[str] = mapped_column(ForeignKey("modules.key", ondelete="CASCADE"), index=True)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="UGX")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    request: Mapped["TenantModuleRequest"] = relationship("TenantModuleRequest", back_populates="items")
    module: Mapped["PlatformModule"] = relationship("PlatformModule")


class BillingInvoice(Base):
    """Billing invoice generated from a tenant module request."""

    __tablename__ = "billing_invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("tenant_module_requests.id", ondelete="CASCADE"), unique=True, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="UGX")
    status: Mapped[PaymentStatus] = mapped_column(
        db_enum(PaymentStatus, name="paymentstatus"), default=PaymentStatus.PENDING, index=True
    )
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    payment_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="billing_invoices")
    request: Mapped["TenantModuleRequest"] = relationship("TenantModuleRequest", back_populates="invoice")
    payments: Mapped[list["BillingPayment"]] = relationship(
        "BillingPayment", back_populates="invoice", cascade="all, delete-orphan"
    )
    callbacks: Mapped[list["PaymentCallbackLog"]] = relationship(
        "PaymentCallbackLog", back_populates="invoice", cascade="all, delete-orphan"
    )


class BillingPayment(Base):
    """Payment record against a SaaS billing invoice."""

    __tablename__ = "billing_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("billing_invoices.id", ondelete="CASCADE"), index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="UGX")
    status: Mapped[PaymentStatus] = mapped_column(
        db_enum(PaymentStatus, name="paymentstatus"), default=PaymentStatus.PENDING, index=True
    )
    provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="billing_payments")
    invoice: Mapped["BillingInvoice"] = relationship("BillingInvoice", back_populates="payments")


class PaymentCallbackLog(Base):
    """Audit trail for inbound payment callbacks."""

    __tablename__ = "payment_callbacks"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=True)
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("billing_invoices.id", ondelete="CASCADE"), index=True, nullable=True)
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    status: Mapped[PaymentStatus] = mapped_column(
        db_enum(PaymentStatus, name="paymentstatus"), default=PaymentStatus.PENDING, index=True
    )
    source_ip: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant: Mapped[Optional["Tenant"]] = relationship("Tenant", back_populates="payment_callbacks")
    invoice: Mapped[Optional["BillingInvoice"]] = relationship("BillingInvoice", back_populates="callbacks")
