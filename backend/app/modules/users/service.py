"""
User service: business logic for user management.
"""

import math
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.auth import Role
from app.modules.users.repository import UserRepository
from app.modules.users.schemas import (
    UserCreateRequest, UserUpdateRequest, ChangePasswordRequest,
    UserOut, UserListResponse
)


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = UserRepository(db)
        self.db = db

    def _is_platform_admin(self, current_user) -> bool:
        return bool(current_user.role and current_user.role.name in {"super_manager", "developer_admin"})

    async def _get_role_name(self, role_id: int) -> str | None:
        result = await self.db.execute(select(Role).where(Role.id == role_id))
        role = result.scalar_one_or_none()
        return role.name if role else None

    async def list_users(self, page: int, size: int, search: str | None, role_id: int | None, is_active: bool | None, current_user) -> UserListResponse:
        tenant_scope = None if self._is_platform_admin(current_user) else current_user.tenant_id
        users, total = await self.repo.list_users(page, size, search, role_id, is_active, tenant_scope)
        pages = math.ceil(total / size) if size else 1
        return UserListResponse(
            items=[UserOut.model_validate(u) for u in users],
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

    async def get_user(self, user_id: int) -> UserOut:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return UserOut.model_validate(user)

    async def create_user(self, payload: UserCreateRequest, current_user) -> UserOut:
        existing = await self.repo.get_by_email(payload.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A user with email '{payload.email}' already exists.",
            )
        tenant_id = payload.tenant_id if self._is_platform_admin(current_user) else current_user.tenant_id
        if not self._is_platform_admin(current_user) and tenant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your account is not attached to a tenant.",
            )
        role_name = await self._get_role_name(payload.role_id)
        if not role_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected role was not found.")
        if not self._is_platform_admin(current_user) and role_name in {"super_manager", "developer_admin"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform roles cannot be assigned inside a tenant.")
        user = await self.repo.create(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            phone=payload.phone,
            role_id=payload.role_id,
            tenant_id=tenant_id,
            is_active=True,
        )
        await self.db.commit()
        refreshed = await self.repo.get_by_id(user.id)
        return UserOut.model_validate(refreshed)

    async def update_user(self, user_id: int, payload: UserUpdateRequest, requestor_id: int, current_user) -> UserOut:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        if not self._is_platform_admin(current_user):
            if current_user.tenant_id is None or user.tenant_id != current_user.tenant_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only manage users in your tenant.")
        updates = payload.model_dump(exclude_none=True)
        if "role_id" in updates:
            role_name = await self._get_role_name(updates["role_id"])
            if not role_name:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected role was not found.")
            if not self._is_platform_admin(current_user) and role_name in {"super_manager", "developer_admin"}:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform roles cannot be assigned inside a tenant.")
        if "tenant_id" in updates and not self._is_platform_admin(current_user):
            updates.pop("tenant_id")
        await self.repo.update(user, **updates)
        await self.db.commit()
        refreshed = await self.repo.get_by_id(user_id)
        return UserOut.model_validate(refreshed)

    async def delete_user(self, user_id: int, requestor_id: int, current_user) -> None:
        if user_id == requestor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot delete your own account.",
            )
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        if not self._is_platform_admin(current_user):
            if current_user.tenant_id is None or user.tenant_id != current_user.tenant_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only manage users in your tenant.")
        await self.repo.soft_delete(user)
        await self.db.commit()

    async def change_password(self, user_id: int, payload: ChangePasswordRequest) -> None:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        if not verify_password(payload.current_password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
        await self.repo.update(user, hashed_password=hash_password(payload.new_password))
        await self.db.commit()

    async def get_roles(self):
        return await self.repo.get_roles()
