from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import settings


@dataclass
class CloudflareResult:
    ok: bool
    status: str
    message: str | None = None
    record_type: str | None = None
    target: str | None = None


async def create_tenant_dns_record(host: str) -> CloudflareResult:
    if not settings.ENABLE_CLOUDFLARE_DNS_AUTOMATION:
        return CloudflareResult(ok=True, status="skipped", message="Cloudflare automation is disabled.")
    if not settings.CLOUDFLARE_API_TOKEN or not settings.CLOUDFLARE_ZONE_ID:
        return CloudflareResult(
            ok=True,
            status="skipped",
            message="Cloudflare credentials are not configured; relying on wildcard DNS or manual setup.",
        )

    record_type = settings.CLOUDFLARE_DNS_RECORD_TYPE.upper()
    if record_type == "CNAME":
        target = settings.PRIMARY_PLATFORM_DOMAIN
        content_key = "content"
    else:
        record_type = "A"
        target = settings.TENANT_DOMAIN_TARGET_IP
        content_key = "content"
        if not target:
            return CloudflareResult(ok=False, status="failed", message="TENANT_DOMAIN_TARGET_IP is not configured.")

    payload = {
        "type": record_type,
        "name": host,
        content_key: target,
        "ttl": 1,
        "proxied": True,
    }
    url = f"https://api.cloudflare.com/client/v4/zones/{settings.CLOUDFLARE_ZONE_ID}/dns_records"
    headers = {"Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, json=payload, headers=headers)
        data = response.json()
        if response.status_code in {200, 201} and data.get("success"):
            return CloudflareResult(ok=True, status="active", record_type=record_type, target=target)
        errors = data.get("errors") or []
        message = "; ".join(str(error.get("message", error)) for error in errors) or response.text
        return CloudflareResult(ok=False, status="failed", message=message, record_type=record_type, target=target)
    except Exception as exc:  # pragma: no cover - network dependent
        return CloudflareResult(ok=False, status="failed", message=str(exc), record_type=record_type, target=target)
