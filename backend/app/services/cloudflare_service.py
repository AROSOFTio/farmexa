from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import settings


@dataclass
class CloudflareResult:
    ok: bool
    status: str
    message: str | None = None
    record_id: str | None = None
    record_type: str | None = None
    target: str | None = None


async def create_tenant_dns_record(host: str) -> CloudflareResult:
    if not settings.ENABLE_CLOUDFLARE_DNS_AUTOMATION:
        return CloudflareResult(ok=True, status="skipped", message="Cloudflare automation is disabled.")
    if not settings.CLOUDFLARE_API_TOKEN or not settings.CLOUDFLARE_ZONE_ID:
        return CloudflareResult(
            ok=False,
            status="failed",
            message="Cloudflare credentials are not configured.",
        )

    record_type = (settings.TENANT_DNS_TARGET_TYPE or settings.CLOUDFLARE_DNS_RECORD_TYPE).upper()
    if record_type == "CNAME":
        target = settings.TENANT_DNS_TARGET_VALUE or settings.PRIMARY_PLATFORM_DOMAIN
    else:
        record_type = "A"
        target = settings.TENANT_DNS_TARGET_VALUE or settings.TENANT_DOMAIN_TARGET_IP
        if not target:
            return CloudflareResult(ok=False, status="failed", message="TENANT_DNS_TARGET_VALUE is not configured.")

    payload = {
        "type": record_type,
        "name": host,
        "content": target,
        "ttl": settings.TENANT_DNS_TTL,
        "proxied": settings.TENANT_DNS_PROXIED,
    }
    base_url = f"https://api.cloudflare.com/client/v4/zones/{settings.CLOUDFLARE_ZONE_ID}/dns_records"
    headers = {"Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            list_response = await client.get(
                base_url,
                params={"name": host, "type": record_type, "per_page": 50},
                headers=headers,
            )
            list_data = list_response.json()
            if not list_response.is_success or not list_data.get("success"):
                return _failure_from_response(list_response, list_data, record_type, target)

            existing_records = list_data.get("result") or []
            matching = next((record for record in existing_records if record.get("content") == target), None)
            if matching:
                proxied_matches = bool(matching.get("proxied")) == bool(settings.TENANT_DNS_PROXIED)
                ttl_matches = matching.get("ttl") in {settings.TENANT_DNS_TTL, 1}
                if proxied_matches and ttl_matches:
                    return CloudflareResult(
                        ok=True,
                        status="active",
                        record_id=matching.get("id"),
                        record_type=record_type,
                        target=target,
                    )

            record_to_update = matching or (existing_records[0] if existing_records else None)
            if record_to_update:
                response = await client.put(
                    f"{base_url}/{record_to_update['id']}",
                    json=payload,
                    headers=headers,
                )
            else:
                response = await client.post(base_url, json=payload, headers=headers)

            data = response.json()
            if response.status_code in {200, 201} and data.get("success"):
                record = data.get("result") or {}
                return CloudflareResult(
                    ok=True,
                    status="active",
                    record_id=record.get("id"),
                    record_type=record_type,
                    target=target,
                )
            return _failure_from_response(response, data, record_type, target)
    except Exception as exc:  # pragma: no cover - network dependent
        return CloudflareResult(ok=False, status="failed", message=str(exc), record_type=record_type, target=target)


def _failure_from_response(
    response: httpx.Response,
    data: dict,
    record_type: str,
    target: str,
) -> CloudflareResult:
    errors = data.get("errors") or []
    message = "; ".join(str(error.get("message", error)) for error in errors) or response.text
    return CloudflareResult(ok=False, status="failed", message=message, record_type=record_type, target=target)
