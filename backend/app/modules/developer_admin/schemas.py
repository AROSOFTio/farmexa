"""
Tenant / Developer Admin schemas.
"""
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


class TenantCreate(BaseModel):
    name: str
    slug: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    plan: str = "basic"
    billing_cycle: str = "monthly"
    subscription_start: Optional[date] = None
    subscription_expiry: Optional[date] = None
    notes: Optional[str] = None


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    plan: Optional[str] = None
    billing_cycle: Optional[str] = None
    subscription_start: Optional[date] = None
    subscription_expiry: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class TenantModuleOut(BaseModel):
    id: int
    module_key: str
    is_enabled: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantOut(BaseModel):
    id: int
    name: str
    slug: str
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
    modules: List[TenantModuleOut] = []

    model_config = {"from_attributes": True}


class ModuleToggle(BaseModel):
    module_key: str
    is_enabled: bool


class PlanChange(BaseModel):
    plan: str
    notes: Optional[str] = None


class SuspendRequest(BaseModel):
    reason: Optional[str] = None


class SubscriptionHistoryOut(BaseModel):
    id: int
    tenant_id: int
    event_type: str
    old_plan: Optional[str]
    new_plan: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
