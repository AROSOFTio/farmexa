"""
Pydantic v2 schemas for authentication endpoints.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshRequest(BaseModel):
    refresh_token: str


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
    is_suspended: bool
    subscription_expiry: datetime | None = None


class MeResponse(BaseModel):
    user: UserOut
    permissions: list[str]  # flat list of permission codes for easy frontend use
    enabled_modules: list[str]
    tenant: TenantSessionOut | None = None
