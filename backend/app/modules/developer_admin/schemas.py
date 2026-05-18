"""
Developer Admin schemas for tenancy, plans, domains, activity, and platform settings.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class TenantCreate(BaseModel):
    name: str = Field(min_length=2)
    slug: Optional[str] = None
    business_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    domain: Optional[str] = None
    plan: str = Field(min_length=1)
    billing_cycle: str = "monthly"
    subscription_start: Optional[date] = None
    subscription_expiry: Optional[date] = None
    notes: Optional[str] = None


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    business_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    domain: Optional[str] = None
    plan: Optional[str] = None
    billing_cycle: Optional[str] = None
    subscription_start: Optional[date] = None
    subscription_expiry: Optional[date] = None
    is_suspended: Optional[bool] = None
    notes: Optional[str] = None


class PlanChange(BaseModel):
    plan: str
    billing_cycle: Optional[str] = None
    subscription_expiry: Optional[date] = None
    notes: Optional[str] = None


class SuspendRequest(BaseModel):
    reason: Optional[str] = None


class DomainAssignRequest(BaseModel):
    host: str
    is_primary: bool = False


class ModuleToggle(BaseModel):
    module_key: str
    is_enabled: bool


class ModulePriceUpdate(BaseModel):
    billing_cycle: str
    price: Decimal
    currency: str = "UGX"
    notes: Optional[str] = None


class PlanBase(BaseModel):
    name: str = Field(min_length=2)
    code: str = Field(min_length=2, max_length=50)
    description: Optional[str] = None
    billing_cycle: str = "monthly"
    monthly_price: Decimal = Field(default=Decimal("0"))
    quarterly_price: Decimal = Field(default=Decimal("0"))
    annual_price: Decimal = Field(default=Decimal("0"))
    currency: str = Field(default="UGX", min_length=1, max_length=10)
    trial_days: int = Field(default=0, ge=0)
    is_active: bool = True
    modules: list[str] = Field(default_factory=list)


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2)
    code: Optional[str] = Field(default=None, min_length=2, max_length=50)
    description: Optional[str] = None
    billing_cycle: Optional[str] = None
    monthly_price: Optional[Decimal] = Field(default=None)
    quarterly_price: Optional[Decimal] = Field(default=None)
    annual_price: Optional[Decimal] = Field(default=None)
    currency: Optional[str] = Field(default=None, min_length=1, max_length=10)
    trial_days: Optional[int] = Field(default=None, ge=0)
    is_active: Optional[bool] = None
    modules: Optional[list[str]] = None


class PlanStatusUpdate(BaseModel):
    is_active: bool


class TenantModuleOut(BaseModel):
    id: int
    module_key: str
    is_enabled: bool
    is_manual_override: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantDomainOut(BaseModel):
    id: int
    host: str
    normalized_host: str
    domain_type: str
    is_primary: bool
    status: str
    verification_target: Optional[str] = None
    cloudflare_record_id: Optional[str] = None
    cloudflare_provision_status: Optional[str] = None
    cloudflare_last_error: Optional[str] = None
    cloudflare_provisioned_at: Optional[datetime] = None
    dns_verified_at: Optional[datetime] = None
    ssl_requested_at: Optional[datetime] = None
    ssl_issued_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    disabled_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantAdminCredentialOut(BaseModel):
    email: str
    full_name: str
    temporary_password: str
    must_change_password: bool = True


class SubscriptionOut(BaseModel):
    id: int
    plan_code: str
    status: str
    billing_cycle: str
    start_date: date
    expiry_date: Optional[date]
    next_invoice_date: Optional[date]
    amount: Optional[Decimal]
    currency: str

    model_config = {"from_attributes": True}


class TenantOut(BaseModel):
    id: int
    name: str
    slug: str
    business_name: Optional[str]
    contact_person: Optional[str]
    email: str
    phone: Optional[str]
    address: Optional[str]
    country: Optional[str]
    status: str
    plan: str
    billing_cycle: str
    subscription_start: Optional[date]
    subscription_expiry: Optional[date]
    is_suspended: bool
    notes: Optional[str]
    operational_db_name: Optional[str] = None
    operational_db_status: str = "pending"
    operational_db_ready_at: Optional[datetime] = None
    operational_db_last_error: Optional[str] = None
    created_at: datetime
    modules: List[TenantModuleOut] = Field(default_factory=list)
    domains: List[TenantDomainOut] = Field(default_factory=list)
    subscriptions: List[SubscriptionOut] = Field(default_factory=list)
    onboarding_admin: TenantAdminCredentialOut | None = None

    model_config = {"from_attributes": True}


class PlatformModuleOut(BaseModel):
    key: str
    name: str
    category: str
    description: Optional[str]
    is_core: bool
    is_active: bool

    model_config = {"from_attributes": True}


class PlanModuleOut(BaseModel):
    module_key: str
    module_name: str
    category: str
    description: Optional[str]
    is_core: bool
    is_included: bool


class PlanOut(BaseModel):
    code: str
    name: str
    description: Optional[str]
    billing_cycle: str
    monthly_price: Decimal
    quarterly_price: Decimal
    annual_price: Decimal
    currency: str
    trial_days: int
    is_custom: bool
    is_active: bool
    module_count: int = 0
    tenant_count: int = 0
    modules: List[PlanModuleOut] = Field(default_factory=list)


class ModulePriceOut(BaseModel):
    id: int
    module_key: str
    billing_cycle: str
    price: Decimal
    currency: str
    notes: Optional[str]

    model_config = {"from_attributes": True}


class SaaSCatalogOut(BaseModel):
    modules: List[PlatformModuleOut]
    plans: List[PlanOut]
    module_prices: List[ModulePriceOut]


class BillingTenantOut(BaseModel):
    tenant_id: int
    tenant_name: str
    plan: str
    status: str
    billing_cycle: str
    expiry_date: Optional[date]
    amount: Optional[Decimal]
    currency: str
    domains: List[str]


class BillingOverviewOut(BaseModel):
    total_tenants: int
    active_tenants: int
    suspended_tenants: int
    expiring_soon: int
    tenants: List[BillingTenantOut]


class SubscriptionHistoryOut(BaseModel):
    id: int
    tenant_id: int
    event_type: str
    old_plan: Optional[str]
    new_plan: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class DeveloperAdminOverviewOut(BaseModel):
    total_tenants: int
    active_domains: int
    active_plans: int
    monthly_revenue: Decimal
    pending_setup: int
    suspended_tenants: int


class ActivityLogOut(BaseModel):
    id: int
    action: str
    entity: str
    entity_id: Optional[int]
    meta: Optional[str]
    created_at: datetime
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None


class DeveloperAdminSettingsOut(BaseModel):
    primary_platform_domain: str
    default_tenant_domain_suffix: str
    automatic_ssl_provisioning: bool
    certbot_enabled: bool
    mandatory_module_keys: list[str]
    total_modules: int
    total_plans: int
