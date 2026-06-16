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

from app.core.limiter import limiter

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
    from app.models.user import User
    from app.models.settings import SystemSettings
    from app.core.security import create_password_reset_token
    from app.services.email_service import log_and_send_email, branded_email_html

    email_str = str(payload.email).strip().lower()
    result = await db.execute(select(User).where(User.email == email_str, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()

    if user:
        token = create_password_reset_token(user.id, user.email)
        
        # Load system settings
        settings_result = await db.execute(select(SystemSettings).order_by(SystemSettings.id).limit(1))
        system_settings = settings_result.scalar_one_or_none()
        system_name = system_settings.system_name if system_settings else "Farmexa"

        body = (
            f"Hello {user.full_name or 'there'},\n\n"
            f"We received a request to reset your {system_name} password.\n"
            f"Please use the following reset token to set a new password:\n\n"
            f"{token}\n\n"
            "This token is valid for 15 minutes. If you did not make this request, you can safely ignore this email.\n"
        )

        html_body = branded_email_html(
            title="Reset your password",
            intro="We received a request to reset your password.",
            body_html=(
                "<p>Please copy the reset token below and paste it into the application reset form:</p>"
                f"<p style='font-size: 14px; font-family: monospace; font-weight: bold; background-color: #f1f5f9; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; word-break: break-all; text-align: center; color: #0f172a;'>{token}</p>"
                "<p>This token is valid for 15 minutes. If you did not request a password reset, please ignore this email.</p>"
            ),
            system_settings=system_settings,
        )

        await log_and_send_email(
            db,
            recipient=user.email,
            subject=f"Reset your {system_name} password",
            body=body,
            html_body=html_body,
            email_type="Password Reset",
            system_settings=system_settings,
        )
        await db.commit()

    return {"message": "If the email exists, a password reset message has been sent."}


@router.post("/reset-password", response_model=MessageOut)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    from app.core.security import decode_password_reset_token, hash_password
    from app.models.user import User
    from jwt.exceptions import InvalidTokenError

    try:
        token_data = decode_password_reset_token(payload.token)
    except (InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset token is invalid or expired."
        )

    user_id = int(token_data["sub"])
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user.hashed_password = hash_password(payload.password)
    await db.commit()
    return {"message": "Your password has been successfully reset."}


@router.post("/verify-email", response_model=MessageOut)
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    from app.core.security import decode_email_verification_token
    from app.models.user import User
    from jwt.exceptions import InvalidTokenError

    try:
        token_data = decode_email_verification_token(payload.token)
    except (InvalidTokenError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The email verification token is invalid or expired."
        )

    user_id = int(token_data["sub"])
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    # Email is verified successfully
    return {"message": "Email verified."}


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
