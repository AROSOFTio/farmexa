"""
Auth router: /api/v1/auth endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.tenant import Tenant
from app.modules.auth.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageOut,
    MeResponse,
    RefreshRequest,
    ResetPasswordRequest,
    TenantRegistrationOut,
    TenantRegistrationRequest,
    TenantProfileOut,
    TenantProfileUpdate,
    TokenPair,
    VerifyEmailRequest,
)
from app.modules.auth.service import AuthService
from app.modules.developer_admin.service import DeveloperAdminService
from app.services.email_service import log_and_send_email

from app.main import limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenPair, summary="Authenticate and receive token pair")
@limiter.limit("10/minute")
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


@router.post(
    "/register-tenant",
    response_model=TenantRegistrationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Self-register a new tenant workspace",
)
@limiter.limit("5/minute")
async def register_tenant(
    payload: TenantRegistrationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    service = DeveloperAdminService(db)
    return await service.register_tenant(payload, request)


@router.post(
    "/register-vendor",
    response_model=TenantRegistrationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Backward-compatible tenant self-registration endpoint",
)
@limiter.limit("5/minute")
async def register_vendor(
    payload: TenantRegistrationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    service = DeveloperAdminService(db)
    return await service.register_tenant(payload, request)


@router.post("/logout", status_code=204, summary="Revoke refresh token")
async def logout(
    payload: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    await service.logout(payload.refresh_token)


@router.post("/forgot-password", response_model=MessageOut)
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await log_and_send_email(
        db,
        recipient=str(payload.email),
        subject="Reset your Farmexa password",
        body="A password reset was requested for your Farmexa account. Use the secure reset link provided by your administrator.",
        email_type="Password Reset",
    )
    await db.commit()
    return {"message": "If the email exists, a password reset message has been sent."}


@router.post("/reset-password", response_model=MessageOut)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    return {"message": "Password reset token accepted for processing."}


@router.post("/verify-email", response_model=MessageOut)
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    return {"message": "Email verification token accepted for processing."}


@router.get("/me", response_model=MeResponse, summary="Get current authenticated user")
async def get_me(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = AuthService(db)
    return await service.get_me(current_user)


def _tenant_profile_out(tenant: Tenant) -> TenantProfileOut:
    primary_domain = next((domain.host for domain in tenant.domains if domain.is_primary), None)
    return TenantProfileOut(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        business_name=tenant.business_name,
        contact_person=tenant.contact_person,
        email=tenant.email,
        phone=tenant.phone,
        address=tenant.address,
        country=tenant.country,
        plan=tenant.plan,
        subscription_status=tenant.subscription_status.value if hasattr(tenant.subscription_status, "value") else str(tenant.subscription_status),
        primary_domain=primary_domain,
        trial_started_at=tenant.trial_started_at,
        trial_ends_at=tenant.trial_ends_at,
    )


@router.get("/tenant-profile", response_model=TenantProfileOut)
async def get_tenant_profile(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Your account is not assigned to a tenant.")
    tenant = (
        await db.execute(
            select(Tenant).where(Tenant.id == current_user.tenant_id).options(selectinload(Tenant.domains))
        )
    ).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant was not found.")
    return _tenant_profile_out(tenant)


@router.put("/tenant-profile", response_model=TenantProfileOut)
async def update_tenant_profile(
    payload: TenantProfileUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Your account is not assigned to a tenant.")
    tenant = (
        await db.execute(
            select(Tenant).where(Tenant.id == current_user.tenant_id).options(selectinload(Tenant.domains))
        )
    ).scalar_one_or_none()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant was not found.")

    tenant.name = payload.name
    tenant.business_name = payload.business_name
    tenant.contact_person = payload.contact_person
    tenant.email = str(payload.email)
    tenant.phone = payload.phone
    tenant.address = payload.address
    tenant.country = payload.country
    await db.commit()
    await db.refresh(tenant)
    return _tenant_profile_out(tenant)
