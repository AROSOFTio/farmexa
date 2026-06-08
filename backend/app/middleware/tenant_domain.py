from __future__ import annotations

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.tenant import DomainStatus, TenantDomain, TenantStatus
from app.utils.domains import is_platform_host, normalize_host


WORKSPACE_NOT_FOUND = {
    "detail": "Workspace not found. This Farmexa workspace does not exist, is not active, or has not been mapped.",
    "code": "workspace_not_found",
}

HOST_NOT_SERVED = {
    "detail": "This hostname is not served by Farmexa.",
    "code": "host_not_served",
}


def _is_tenant_subdomain_candidate(host: str) -> bool:
    """
    Return True only when the host *could* be a Farmexa tenant sub‑domain,
    i.e. it is a sub‑domain of the configured tenant domain suffix.
    Hosts that belong to a completely different domain or are known
    infrastructure sub‑domains fall through to a 404 here so that nginx
    or another upstream handler can deal with them correctly.
    """
    suffix = settings.tenant_domain_suffix
    if not suffix or not host:
        return False
    # host must end with ".{suffix}" (a direct sub‑domain, not the apex itself)
    return host != suffix and host.endswith(f".{suffix}")


class TenantDomainResolverMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.tenant_id = None
        request.state.tenant_domain_id = None
        request.state.is_platform_host = False
        request.state.tenant_host = normalize_host(request.headers.get("host"))

        resolved_host = request.state.tenant_host

        # Always allow health‑checks and requests with no host header through.
        if not resolved_host or request.url.path == "/health":
            return await call_next(request)

        # ── 1. Platform hosts (farm.arosoftlabs.com, localhost, …) ──────────
        if is_platform_host(resolved_host):
            request.state.is_platform_host = True
            return await call_next(request)

        # ── 2. Tenant sub‑domain lookup ──────────────────────────────────────
        # Only perform the DB round‑trip when the host looks like it could be a
        # provisioned tenant sub‑domain (i.e. *.arosoftlabs.com).  Unknown
        # sub‑domains such as cp.*, mail.*, courses.* etc. are rejected with a
        # clear 404 *before* hitting the database, which also prevents Farmexa
        # content leaking onto infrastructure sub‑domains.
        if _is_tenant_subdomain_candidate(resolved_host):
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

            # Sub‑domain of our suffix but not a registered tenant.
            return JSONResponse(WORKSPACE_NOT_FOUND, status_code=404)

        # ── 3. Custom domains (non‑*.arosoftlabs.com) ────────────────────────
        # Could be a customer's custom domain (e.g. erp.myfarm.com).
        # Check the TenantDomain table for a custom‑domain mapping.
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

        # The host is completely unknown to Farmexa — return a plain 404 that
        # does NOT render Farmexa UI so it doesn't pollute other services.
        return JSONResponse(HOST_NOT_SERVED, status_code=404)
