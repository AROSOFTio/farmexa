"""
Pydantic v2 schemas for authentication endpoints.
"""

from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field, model_validator


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Password confirmation does not match.")
        return self


class VerifyEmailRequest(BaseModel):
    token: str


class MessageOut(BaseModel):
    message: str


class TenantRegistrationRequest(BaseModel):
    name: str = Field(min_length=2)
    business_name: str | None = None
    contact_person: str | None = None
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    country: str | None = None
    domain: str | None = None
    password: str = Field(min_length=8)
    confirm_password: str | None = None

    @model_validator(mode="after")
    def passwords_match(self):
        if self.confirm_password is not None and self.confirm_password != self.password:
            raise ValueError("Password confirmation does not match.")
        return self


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class PermissionOut(BaseModel):
    code: str
    module: str
    description: str | None = None

    model_config = {"from_attributes": True}


class RoleOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    permissions: list[PermissionOut] = []

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    phone: str | None = None
    job_title: str | None = None
    avatar_url: str | None = None
    is_active: bool
    role: RoleOut | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantSessionOut(BaseModel):
    id: int
    name: str
    slug: str
    plan: str
    subscription_status: str | None = None
    primary_domain: str | None = None
    is_suspended: bool
    is_profile_only: bool = False
    subscription_expiry: date | None = None
    trial_started_at: datetime | None = None
    trial_ends_at: datetime | None = None


class TenantRegistrationOut(BaseModel):
    tenant_id: int
    tenant_name: str
    admin_email: EmailStr
    login_host: str
    login_url: str
    primary_domain: str
    primary_domain_status: str
    trial_start_date: date | None = None
    trial_expiry_date: date | None = None
    fallback_domain: str | None = None
    custom_domain: str | None = None
    custom_domain_status: str | None = None


class MeResponse(BaseModel):
    user: UserOut
    permissions: list[str]  # flat list of permission codes for easy frontend use
    enabled_modules: list[str]
    tenant: TenantSessionOut | None = None


VendorRegistrationRequest = TenantRegistrationRequest
VendorRegistrationOut = TenantRegistrationOut


class TenantProfileOut(BaseModel):
    id: int
    name: str
    slug: str
    business_name: str | None = None
    contact_person: str | None = None
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    country: str | None = None
    plan: str
    subscription_status: str | None = None
    primary_domain: str | None = None
    trial_started_at: datetime | None = None
    trial_ends_at: datetime | None = None


class TenantProfileUpdate(BaseModel):
    name: str = Field(min_length=2)
    business_name: str | None = None
    contact_person: str | None = None
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    country: str | None = None
