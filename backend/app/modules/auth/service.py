"""
Auth service: business logic for login, token refresh, and logout.
"""

from datetime import timezone
from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    verify_password,
    create_access_token,
    generate_refresh_token,
    refresh_token_expiry,
    hash_refresh_token,
)
from app.core.config import settings
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import MeResponse, TenantSessionOut, TokenPair, UserOut


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = AuthRepository(db)
        self.db = db

    async def login(self, email: str, password: str, request: Request) -> TokenPair:
        user = await self.repo.get_user_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Contact an administrator.",
            )

        access_token = create_access_token(
            subject=str(user.id),
            extra_claims={"role": user.role.name if user.role else None},
        )
        raw_refresh = generate_refresh_token()
        await self.repo.store_refresh_token(
            user_id=user.id,
            raw_token=raw_refresh,
            expires_at=refresh_token_expiry(),
            user_agent=request.headers.get("user-agent"),
            ip_address=request.client.host if request.client else None,
        )
        await self.db.commit()

        return TokenPair(
            access_token=access_token,
            refresh_token=raw_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def refresh(self, raw_token: str) -> TokenPair:
        token_record = await self.repo.get_refresh_token(raw_token)
        if not token_record or not token_record.is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token is invalid or expired.",
            )

        # Token rotation: revoke old, issue new
        await self.repo.revoke_refresh_token(hash_refresh_token(raw_token))

        user = token_record.user
        access_token = create_access_token(
            subject=str(user.id),
            extra_claims={"role": user.role.name if user.role else None},
        )
        new_raw_refresh = generate_refresh_token()
        await self.repo.store_refresh_token(
            user_id=user.id,
            raw_token=new_raw_refresh,
            expires_at=refresh_token_expiry(),
        )
        await self.db.commit()

        return TokenPair(
            access_token=access_token,
            refresh_token=new_raw_refresh,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def logout(self, raw_token: str) -> None:
        token_record = await self.repo.get_refresh_token(raw_token)
        if token_record:
            await self.repo.revoke_refresh_token(token_record.token_hash)
            await self.db.commit()

    async def get_me(self, user) -> MeResponse:
        permissions = []
        if user.role and user.role.role_permissions:
            permissions = [rp.permission.code for rp in user.role.role_permissions if rp.permission]
        enabled_modules: list[str] = []
        tenant = None
        if user.tenant:
            enabled_modules = [module.module_key for module in user.tenant.modules if module.is_enabled]
            tenant = TenantSessionOut(
                id=user.tenant.id,
                name=user.tenant.name,
                slug=user.tenant.slug,
                plan=user.tenant.plan.value if hasattr(user.tenant.plan, "value") else str(user.tenant.plan),
                is_suspended=user.tenant.is_suspended,
                subscription_expiry=user.tenant.subscription_expiry,
            )
        return MeResponse(
            user=UserOut.model_validate(user),
            permissions=permissions,
            enabled_modules=enabled_modules,
            tenant=tenant,
        )
