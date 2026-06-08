from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import settings
from app.utils.domains import normalize_host, is_platform_host


@dataclass
class CloudflareResult:
    ok: bool
    status: str
    message: str | None = None
    record_id: str | None = None
    record_type: str | None = None
    target: str | None = None


def _setting_value(system_settings: Any | None, name: str, fallback):
    value = getattr(system_settings, name, None) if system_settings is not None else None
    if isinstance(value, str):
        value = value.strip()
        return value or fallback
    return fallback if value is None else value


async def create_tenant_dns_record(host: str, system_settings: Any | None = None) -> CloudflareResult:
    automation_enabled = _setting_value(
        system_settings,
        "enable_cloudflare_dns_automation",
        settings.ENABLE_CLOUDFLARE_DNS_AUTOMATION,
    )
    if not automation_enabled:
        return CloudflareResult(ok=True, status="skipped", message="Cloudflare automation is disabled.")

    api_token = _setting_value(system_settings, "cloudflare_api_token", settings.CLOUDFLARE_API_TOKEN)
    zone_id = _setting_value(system_settings, "cloudflare_zone_id", settings.CLOUDFLARE_ZONE_ID)

    normalized = normalize_host(host)
    if is_platform_host(normalized):
        return CloudflareResult(ok=False, status="failed", message="Host is a reserved platform host and cannot be auto-provisioned.")
    if not api_token or not zone_id:
        return CloudflareResult(
            ok=False,
            status="failed",
            message="Cloudflare credentials are not configured.",
        )

    record_type = (settings.TENANT_DNS_TARGET_TYPE or settings.CLOUDFLARE_DNS_RECORD_TYPE).upper()
    if record_type == "CNAME":
        target = settings.TENANT_DNS_TARGET_VALUE or _setting_value(
            system_settings,
            "platform_domain",
            settings.PRIMARY_PLATFORM_DOMAIN,
        )
    else:
        record_type = "A"
        target = settings.TENANT_DNS_TARGET_VALUE or _setting_value(
            system_settings,
            "tenant_domain_target_ip",
            settings.TENANT_DOMAIN_TARGET_IP,
        )
        if not target:
            return CloudflareResult(
                ok=False,
                status="failed",
                message="TENANT_DOMAIN_TARGET_IP or TENANT_DNS_TARGET_VALUE is not configured.",
            )

    payload = {
        "type": record_type,
        "name": host,
        "content": target,
        "ttl": settings.TENANT_DNS_TTL,
        "proxied": settings.TENANT_DNS_PROXIED,
    }
    base_url = f"https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records"
    headers = {"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"}

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
