"""
Auth repository: database operations for auth flows.
"""

from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.auth import RefreshToken, Role, RolePermission, Permission
from app.models.user import User
from app.core.security import hash_refresh_token


def _user_with_permissions():
    """Reusable eager-load option: user → role → permissions."""
    return selectinload(User.role).selectinload(
        Role.role_permissions
    ).selectinload(RolePermission.permission)


class AuthRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_user_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User)
            .where(User.email == email, User.deleted_at.is_(None))
            .options(_user_with_permissions())
        )
        return result.scalar_one_or_none()

    async def store_refresh_token(
        self,
        user_id: int,
        raw_token: str,
        expires_at: datetime,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> RefreshToken:
        token = RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(raw_token),
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        self.db.add(token)
        await self.db.flush()
        return token

    async def get_refresh_token(self, raw_token: str) -> RefreshToken | None:
        result = await self.db.execute(
            select(RefreshToken)
            .where(RefreshToken.token_hash == hash_refresh_token(raw_token))
            .options(
                selectinload(RefreshToken.user).options(_user_with_permissions())
            )
        )
        return result.scalar_one_or_none()

    async def revoke_refresh_token(self, token_hash: str) -> None:
        await self.db.execute(
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hash)
            .values(revoked_at=datetime.now(timezone.utc))
        )

    async def revoke_all_user_tokens(self, user_id: int) -> None:
        await self.db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(timezone.utc))
        )
