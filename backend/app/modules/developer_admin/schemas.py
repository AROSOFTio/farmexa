"""
Developer Admin schemas for tenant onboarding, SaaS catalog, and billing control.
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
    plan: str = "basic"
    billing_cycle: str = "monthly"
    subscription_start: Optional[date] = None
    subscription_expiry: Optional[date] = None
    enabled_modules: List[str] = Field(default_factory=list)
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
    status: Optional[str] = None
    notes: Optional[str] = None


class ModuleToggle(BaseModel):
    module_key: str
    is_enabled: bool


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


class ModulePriceUpdate(BaseModel):
    billing_cycle: str
    price: Decimal
    currency: str = "UGX"
    notes: Optional[str] = None


class TenantModuleOut(BaseModel):
    id: int
    module_key: str
    is_enabled: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantDomainOut(BaseModel):
    id: int
    host: str
    is_primary: bool
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


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
    created_at: datetime
    modules: List[TenantModuleOut] = Field(default_factory=list)
    domains: List[TenantDomainOut] = Field(default_factory=list)
    subscriptions: List[SubscriptionOut] = Field(default_factory=list)

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
    is_included: bool

    model_config = {"from_attributes": True}


class PlanOut(BaseModel):
    code: str
    name: str
    description: Optional[str]
    billing_cycle: str
    is_custom: bool
    is_active: bool
    modules: List[PlanModuleOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


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
