"""
Users router: /api/v1/users endpoints (super_manager only for most operations).
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user, require_permission
from app.modules.users.schemas import (
    UserCreateRequest, UserUpdateRequest, ChangePasswordRequest,
    UserOut, UserListResponse, RoleOut
)
from app.modules.users.service import UserService
from app.models.auth import Role, RolePermission

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=UserListResponse, summary="List users")
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user=Depends(require_permission("users:read")),
    db: AsyncSession = Depends(get_db),
):
    return await UserService(db).list_users(page, size, search, role_id, is_active, current_user)


@router.post("", response_model=UserOut, status_code=201, summary="Create a new user")
async def create_user(
    payload: UserCreateRequest,
    current_user=Depends(require_permission("users:write")),
    db: AsyncSession = Depends(get_db),
):
    return await UserService(db).create_user(payload, current_user)


@router.get("/roles", response_model=list[RoleOut], summary="Get all roles")
async def get_roles(
    current_user=Depends(require_permission("users:read")),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
        .order_by(Role.name)
    )
    roles = result.scalars().all()
    if current_user.role and current_user.role.name not in {"super_manager", "developer_admin"}:
        roles = [role for role in roles if role.name not in {"super_manager", "developer_admin"}]
    return [
        RoleOut(
            id=role.id,
            name=role.name,
            description=role.description,
            permissions=[
                RoleOut.PermissionOut(
                    code=rp.permission.code,
                    module=rp.permission.module,
                    description=rp.permission.description,
                )
                for rp in role.role_permissions
                if rp.permission
            ],
        )
        for role in roles
    ]


@router.get("/{user_id}", response_model=UserOut, summary="Get a specific user")
async def get_user(
    user_id: int,
    current_user=Depends(require_permission("users:read")),
    db: AsyncSession = Depends(get_db),
):
    return await UserService(db).get_user(user_id)


@router.patch("/{user_id}", response_model=UserOut, summary="Update a user")
async def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    current_user=Depends(require_permission("users:write")),
    db: AsyncSession = Depends(get_db),
):
    return await UserService(db).update_user(user_id, payload, current_user.id, current_user)


@router.delete("/{user_id}", status_code=204, summary="Soft-delete a user")
async def delete_user(
    user_id: int,
    current_user=Depends(require_permission("users:delete")),
    db: AsyncSession = Depends(get_db),
):
    await UserService(db).delete_user(user_id, current_user.id, current_user)


@router.post("/me/change-password", status_code=204, summary="Change own password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await UserService(db).change_password(current_user.id, payload)
