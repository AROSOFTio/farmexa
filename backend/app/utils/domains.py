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


def infer_domain_type(host: str | None) -> str:
    clean = normalize_host(host)
    suffix = normalize_host(settings.DEFAULT_TENANT_DOMAIN_SUFFIX)
    if clean and suffix and (clean == suffix or clean.endswith(f".{suffix}")):
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
