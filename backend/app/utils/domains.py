from __future__ import annotations

import asyncio
import socket
from dataclasses import dataclass

from app.core.config import settings


def strip_port(host: str | None) -> str | None:
    if not host:
        return None
    host = host.strip().lower()
    if not host:
        return None
    if host.startswith("[") and "]" in host:
        return host[1:].split("]", 1)[0]
    if ":" in host and host.count(":") == 1:
        return host.split(":", 1)[0]
    return host


def normalize_host(host: str | None) -> str | None:
    clean = strip_port(host)
    if not clean:
        return None
    return clean[4:] if clean.startswith("www.") else clean


def is_platform_host(host: str | None) -> bool:
    clean = normalize_host(host)
    if not clean:
        return False
    platform_hosts = {normalize_host(item) for item in settings.platform_hosts}
    return clean in platform_hosts


# ---------------------------------------------------------------------------
# Infrastructure subdomains — Farmexa must NEVER serve these
# ---------------------------------------------------------------------------
# These slugs belong to non-Farmexa system services on the same DNS zone
# (Coolify CP, mail server, helpdesk, etc.).  Any first-level subdomain whose
# slug appears here is immediately rejected at both the Nginx layer (return 444)
# and the application middleware layer before any DB lookup or HTML is returned.
#
# IMPORTANT: Mirror any changes here into all three Nginx configs:
#   - nginx/nginx.conf            (Docker Compose proxy)
#   - docker/coolify-nginx.conf   (Coolify single-container)
#   - nginx/farmexa.arosoft.io.conf (aaPanel reference)
INFRASTRUCTURE_SUBDOMAINS: frozenset[str] = frozenset({
    "cp",        # Coolify control panel   (cp.arosoftlabs.com)
    "mail",      # Mail server             (mail.arosoftlabs.com)
    "courses",   # LMS / courses platform  (courses.arosoftlabs.com)
    "my",        # Reserved                (my.arosoftlabs.com)
    "arofi",     # Reserved                (arofi.arosoftlabs.com)
    "api",       # Separate API gateway    (api.arosoftlabs.com)
    "admin",     # Reserved                (admin.arosoftlabs.com)
    "support",   # Helpdesk                (support.arosoftlabs.com)
})


def is_infrastructure_host(host: str | None) -> bool:
    """
    Return True if *host* is a known infrastructure subdomain that Farmexa
    must never serve.  Only direct first-level subdomains are matched:
      - cp.arosoftlabs.com   → True
      - foo.cp.arosoftlabs.com → False  (nested — not matched)
      - arosoftlabs.com      → False  (apex — not matched here)
    """
    clean = normalize_host(host)
    if not clean:
        return False
    suffix = tenant_domain_suffix()
    if suffix and clean.endswith(f".{suffix}"):
        subdomain = clean[: -(len(suffix) + 1)]   # strip ".arosoftlabs.com"
        if "." not in subdomain:                   # direct subdomain only
            return subdomain in INFRASTRUCTURE_SUBDOMAINS
    return False


# Reserved slugs that must not be used for tenant workspaces or customer slugs.
RESERVED_SLUGS = {
    "cp",
    "farm",
    "mail",
    "www",
    "courses",
    "demo",
    "my",
    "arofi",
    "api",
    "admin",
    "support",
    "myfarm",    # CNAME target subdomain — must not be a tenant slug
}


def is_reserved_slug(slug: str | None) -> bool:
    if not slug:
        return False
    return (slug.strip().lower() in RESERVED_SLUGS)


def tenant_domain_suffix() -> str:
    return normalize_host(settings.tenant_domain_suffix) or "arosoftlabs.com"


def default_platform_domain(slug: str) -> str:
    return f"{normalize_host(slug) or slug}.{tenant_domain_suffix()}"


def infer_domain_type(host: str | None) -> str:
    clean = normalize_host(host)
    suffix = tenant_domain_suffix()
    # Hosts under the tenant suffix (eg: slug.arosoftlabs.com) are treated as platform subdomains
    # unless they match a reserved/platform host (like cp.arosoftlabs.com, www.arosoftlabs.com)
    if clean and suffix and (clean == suffix or clean.endswith(f".{suffix}")):
        if not is_platform_host(clean):
            return "platform_subdomain"
    return "custom"


@dataclass(slots=True)
class DnsVerificationResult:
    matches_target: bool
    resolved_ips: list[str]
    target_ip: str | None
    error: str | None = None


async def verify_domain_points_to_target(host: str) -> DnsVerificationResult:
    normalized = normalize_host(host)
    target_ip = settings.TENANT_DOMAIN_TARGET_IP
    if not normalized:
        return DnsVerificationResult(matches_target=False, resolved_ips=[], target_ip=target_ip, error="Invalid host.")

    loop = asyncio.get_running_loop()
    try:
        _, _, ip_addresses = await asyncio.wait_for(
            loop.run_in_executor(None, socket.gethostbyname_ex, normalized),
            timeout=settings.DOMAIN_VERIFY_TIMEOUT_SECONDS,
        )
    except Exception as exc:  # pragma: no cover - network-dependent branch
        return DnsVerificationResult(matches_target=False, resolved_ips=[], target_ip=target_ip, error=str(exc))

    resolved = sorted(set(ip_addresses))
    matches_target = bool(target_ip and target_ip in resolved)
    return DnsVerificationResult(
        matches_target=matches_target,
        resolved_ips=resolved,
        target_ip=target_ip,
        error=None if resolved else "No A records were returned.",
    )

