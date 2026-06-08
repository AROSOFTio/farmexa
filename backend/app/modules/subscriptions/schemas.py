from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class ModuleUpgradeRequestCreate(BaseModel):
    module_keys: list[str] = Field(min_length=1)
    billing_cycle: str | None = None
    notes: str | None = None


class CustomDomainRequestCreate(BaseModel):
    host: str = Field(min_length=3, max_length=255)
    is_primary: bool = True


class DomainRequestMessageCreate(BaseModel):
    message: str = Field(min_length=2, max_length=4000)


class ModuleCatalogItemOut(BaseModel):
    key: str
    name: str
    category: str
    description: str | None = None
    is_core: bool
    is_enabled: bool
    monthly_price: Decimal | None = None
    currency: str = "UGX"


class UpgradeRequestItemOut(BaseModel):
    id: int
    module_key: str
    price: Decimal
    currency: str

    model_config = {"from_attributes": True}


class BillingInvoiceOut(BaseModel):
    id: int
    invoice_number: str
    amount: Decimal
    currency: str
    status: str
    due_date: Optional[date]
    payment_reference: Optional[str]
    payment_url: Optional[str]
    paid_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ModuleUpgradeRequestOut(BaseModel):
    id: int
    status: str
    billing_cycle: str
    total_amount: Decimal
    currency: str
    notes: str | None = None
    paid_at: Optional[datetime]
    activated_at: Optional[datetime]
    created_at: datetime
    items: list[UpgradeRequestItemOut] = Field(default_factory=list)
    invoice: BillingInvoiceOut | None = None

    model_config = {"from_attributes": True}


class CustomDomainRequestOut(BaseModel):
    id: int
    host: str
    normalized_host: str
    status: str
    price_amount: Decimal
    currency: str
    billing_period: str
    dns_record_type: Optional[str] = None
    dns_record_name: Optional[str] = None
    dns_record_value: Optional[str] = None
    wants_primary: bool
    admin_notes: Optional[str] = None
    last_error: Optional[str] = None
    paid_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    activated_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    created_at: datetime
    invoice: BillingInvoiceOut | None = None
    messages: list["DomainRequestMessageOut"] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class DomainRequestMessageOut(BaseModel):
    id: int
    sender_role: str
    message: str
    email_sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


CustomDomainRequestOut.model_rebuild()


class TenantUpgradeOverviewOut(BaseModel):
    tenant_id: int
    tenant_name: str
    current_plan: str
    billing_cycle: str
    enabled_modules: list[str]
    catalog: list[ModuleCatalogItemOut]
    requests: list[ModuleUpgradeRequestOut]
    domain_requests: list[CustomDomainRequestOut] = Field(default_factory=list)
    custom_domain_price: Decimal
    custom_domain_currency: str
    custom_domain_allowed_tlds: list[str]
    platform_domain: str


class CheckoutStartOut(BaseModel):
    invoice_id: int
    invoice_number: str
    redirect_url: str
    order_tracking_id: Optional[str] = None
    merchant_reference: str


class PaymentCallbackIn(BaseModel):
    invoice_number: str
    status: str
    amount: Decimal | None = None
    currency: str | None = None
    provider: str | None = None
    reference: str | None = None
    payload: dict | None = None
