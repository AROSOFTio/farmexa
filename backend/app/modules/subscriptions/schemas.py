from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class ModuleUpgradeRequestCreate(BaseModel):
    module_keys: list[str] = Field(min_length=1)
    billing_cycle: str | None = None
    notes: str | None = None


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


class TenantUpgradeOverviewOut(BaseModel):
    tenant_id: int
    tenant_name: str
    current_plan: str
    billing_cycle: str
    enabled_modules: list[str]
    catalog: list[ModuleCatalogItemOut]
    requests: list[ModuleUpgradeRequestOut]


class PaymentCallbackIn(BaseModel):
    invoice_number: str
    status: str
    amount: Decimal | None = None
    currency: str | None = None
    provider: str | None = None
    reference: str | None = None
    payload: dict | None = None
