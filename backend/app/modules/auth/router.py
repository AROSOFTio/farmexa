"""
Auth router: /api/v1/auth endpoints.
"""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user
from app.modules.auth.schemas import LoginRequest, RefreshRequest, TokenPair, MeResponse
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenPair, summary="Authenticate and receive token pair")
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    return await service.login(payload.email, payload.password, request)


@router.post("/refresh", response_model=TokenPair, summary="Rotate refresh token")
async def refresh_token(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    return await service.refresh(payload.refresh_token)


@router.post("/logout", status_code=204, summary="Revoke refresh token")
async def logout(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    await service.logout(payload.refresh_token)


@router.get("/me", response_model=MeResponse, summary="Get current authenticated user")
async def get_me(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    return await service.get_me(current_user)
