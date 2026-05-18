from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field, model_validator


class AffiliateRegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = None
    country: str | None = None
    organization: str | None = None
    website_url: str | None = None
    accepted_terms: bool

    @model_validator(mode="after")
    def terms_must_be_accepted(self):
        if not self.accepted_terms:
            raise ValueError("Accept the affiliate terms to continue.")
        return self


class AffiliateOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str | None = None
    country: str | None = None
    organization: str | None = None
    website_url: str | None = None
    status: str
    referral_code: str
    notes: str | None = None
    approved_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AffiliateRegistrationOut(BaseModel):
    message: str
    affiliate: AffiliateOut


class AffiliateStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|approved|rejected|suspended)$")
    notes: str | None = None
    send_email: bool = True


class CommissionRuleOut(BaseModel):
    id: int
    plan_code: str
    commission_percent: Decimal
    is_active: bool
    recurring: bool
    effective_from: datetime
    effective_to: datetime | None = None

    model_config = {"from_attributes": True}


class CommissionRuleUpdate(BaseModel):
    commission_percent: Decimal = Field(ge=0, le=100)
    is_active: bool = True
    recurring: bool = False


class ReferralOut(BaseModel):
    id: int
    affiliate_id: int
    referral_code: str
    referred_email: str | None = None
    tenant_id: int | None = None
    landing_url: str | None = None
    first_seen_at: datetime
    converted_at: datetime | None = None

    model_config = {"from_attributes": True}


class CommissionOut(BaseModel):
    id: int
    affiliate_id: int
    tenant_id: int
    plan_code: str
    subscription_amount: Decimal
    currency: str
    commission_percent_snapshot: Decimal
    commission_amount: Decimal
    status: str
    payment_reference: str | None = None
    paid_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MarkCommissionPaidRequest(BaseModel):
    payment_reference: str | None = None


class AffiliateOverviewOut(BaseModel):
    total_affiliates: int
    pending_affiliates: int
    approved_affiliates: int
    suspended_affiliates: int
    total_referrals: int
    converted_referrals: int
    pending_commission_amount: Decimal
    paid_commission_amount: Decimal
