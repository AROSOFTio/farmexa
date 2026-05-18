from __future__ import annotations

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.db.session import AsyncSessionLocal
from app.models.tenant import DomainStatus, TenantDomain, TenantStatus
from app.utils.domains import is_platform_host, normalize_host


WORKSPACE_NOT_FOUND = {
    "detail": "Workspace not found. This Farmexa workspace does not exist, is not active, or has not been mapped.",
    "code": "workspace_not_found",
}


class TenantDomainResolverMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.tenant_id = None
        request.state.tenant_domain_id = None
        request.state.is_platform_host = False
        request.state.tenant_host = normalize_host(request.headers.get("host"))

        resolved_host = request.state.tenant_host
        if not resolved_host or request.url.path == "/health":
            return await call_next(request)

        if is_platform_host(resolved_host):
            request.state.is_platform_host = True
            return await call_next(request)

        if resolved_host:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(TenantDomain)
                    .where(
                        TenantDomain.normalized_host == resolved_host,
                        TenantDomain.status == DomainStatus.ACTIVE,
                    )
                    .options(selectinload(TenantDomain.tenant))
                )
                domain = result.scalar_one_or_none()
                tenant = domain.tenant if domain else None
                if (
                    domain
                    and tenant
                    and not tenant.is_suspended
                    and tenant.status != TenantStatus.SUSPENDED
                ):
                    request.state.tenant_id = domain.tenant_id
                    request.state.tenant_domain_id = domain.id
                    return await call_next(request)

        return JSONResponse(WORKSPACE_NOT_FOUND, status_code=404)
