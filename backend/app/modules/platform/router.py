from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.tenant import DomainStatus, TenantDomain, TenantStatus
from app.utils.domains import is_platform_host, normalize_host

router = APIRouter(prefix="/platform", tags=["Platform"])


@router.get("/resolve-host")
async def resolve_host(
    request: Request,
    hostname: str | None = None,
    db: AsyncSession = Depends(_get_db),
):
    resolved_host = normalize_host(hostname or request.headers.get("host"))
    if not resolved_host:
        raise HTTPException(status_code=400, detail="Hostname is required for host resolution.")

    platform_host = is_platform_host(resolved_host)
    response = {
        "hostname": resolved_host,
        "is_platform_host": platform_host,
        "tenant_exists": False,
        "tenant_slug": None,
        "tenant_active": False,
    }

    if not platform_host:
        result = await db.execute(
            select(TenantDomain)
            .where(TenantDomain.normalized_host == resolved_host, TenantDomain.status == DomainStatus.ACTIVE)
            .options(selectinload(TenantDomain.tenant))
        )
        domain = result.scalar_one_or_none()
        tenant = domain.tenant if domain else None
        if domain and tenant and not tenant.is_suspended and tenant.status != TenantStatus.SUSPENDED:
            response["tenant_exists"] = True
            response["tenant_slug"] = tenant.slug
            response["tenant_active"] = True

    return response
