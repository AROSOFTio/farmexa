"""
User management schemas.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator
import re


class UserCreateRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=150)
    password: str = Field(min_length=8)
    phone: str | None = Field(default=None, max_length=20)
    role_id: int

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number.")
        return v


class UserUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    role_id: int | None = None
    is_active: bool | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number.")
        return v


class RoleOut(BaseModel):
    id: int
    name: str
    description: str | None = None
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
    updated_at: datetime
    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    size: int
    pages: int
