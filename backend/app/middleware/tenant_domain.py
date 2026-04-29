from __future__ import annotations

from fastapi import Request
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware

from app.db.session import AsyncSessionLocal
from app.models.tenant import DomainStatus, TenantDomain
from app.utils.domains import is_platform_host, normalize_host


class TenantDomainResolverMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.tenant_id = None
        request.state.tenant_domain_id = None
        request.state.tenant_host = normalize_host(request.headers.get("host"))

        resolved_host = request.state.tenant_host
        if resolved_host and not is_platform_host(resolved_host):
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(TenantDomain).where(
                        TenantDomain.normalized_host == resolved_host,
                        TenantDomain.status == DomainStatus.ACTIVE,
                    )
                )
                domain = result.scalar_one_or_none()
                if domain:
                    request.state.tenant_id = domain.tenant_id
                    request.state.tenant_domain_id = domain.id

        return await call_next(request)
