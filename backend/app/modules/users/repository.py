"""
User repository: data access for user management.
"""

import math
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.auth import Role, RolePermission, Permission


def _user_with_role():
    return selectinload(User.role).selectinload(
        Role.role_permissions
    ).selectinload(RolePermission.permission)


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.db.execute(
            select(User)
            .where(User.id == user_id, User.deleted_at.is_(None))
            .options(_user_with_role())
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User)
            .where(User.email == email, User.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def list_users(
        self,
        page: int = 1,
        size: int = 20,
        search: str | None = None,
        role_id: int | None = None,
        is_active: bool | None = None,
    ) -> tuple[list[User], int]:
        base_filter = User.deleted_at.is_(None)
        query = select(User).where(base_filter).options(selectinload(User.role))
        count_query = select(func.count(User.id)).where(base_filter)

        if search:
            like = f"%{search}%"
            search_filter = or_(User.full_name.ilike(like), User.email.ilike(like))
            query = query.where(search_filter)
            count_query = count_query.where(search_filter)
        if role_id is not None:
            query = query.where(User.role_id == role_id)
            count_query = count_query.where(User.role_id == role_id)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
            count_query = count_query.where(User.is_active == is_active)

        total = (await self.db.execute(count_query)).scalar_one()
        offset = (page - 1) * size
        users = (
            await self.db.execute(
                query.order_by(User.created_at.desc()).offset(offset).limit(size)
            )
        ).scalars().all()
        return list(users), total

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.db.add(user)
        await self.db.flush()
        return user

    async def update(self, user: User, **kwargs) -> User:
        for key, value in kwargs.items():
            setattr(user, key, value)
        await self.db.flush()
        return user

    async def soft_delete(self, user: User) -> None:
        user.soft_delete()
        await self.db.flush()

    async def get_roles(self) -> list[Role]:
        result = await self.db.execute(select(Role).order_by(Role.name))
        return list(result.scalars().all())
