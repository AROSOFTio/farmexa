from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx
from fastapi import HTTPException, Request

from app.core.config import settings


@dataclass(slots=True)
class PesapalCheckoutResult:
    redirect_url: str
    order_tracking_id: str | None
    merchant_reference: str


@dataclass(slots=True)
class PesapalStatusResult:
    merchant_reference: str | None
    order_tracking_id: str | None
    status: str
    status_code: int | None
    amount: Decimal | None
    currency: str | None
    payment_method: str | None
    confirmation_code: str | None
    raw: dict[str, Any]


class PesapalService:
    def __init__(self, system_settings: Any | None = None):
        self.system_settings = system_settings

    @property
    def base_url(self) -> str:
        environment = self._value("pesapal_environment", settings.PESAPAL_ENVIRONMENT).lower()
        if environment in {"sandbox", "demo", "test"}:
            return "https://cybqa.pesapal.com/pesapalv3"
        return "https://pay.pesapal.com/v3"

    def _value(self, name: str, fallback: Any = None) -> Any:
        value = getattr(self.system_settings, name, None) if self.system_settings is not None else None
        if isinstance(value, str):
            value = value.strip()
            return value or fallback
        return fallback if value is None else value

    def _credentials(self) -> tuple[str, str]:
        key = self._value("pesapal_consumer_key", settings.PESAPAL_CONSUMER_KEY)
        secret = self._value("pesapal_consumer_secret", settings.PESAPAL_CONSUMER_SECRET)
        if not key or not secret:
            raise HTTPException(status_code=409, detail="Pesapal consumer key and secret are not configured.")
        return key, secret

    async def _token(self) -> str:
        key, secret = self._credentials()
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"{self.base_url}/api/Auth/RequestToken",
                json={"consumer_key": key, "consumer_secret": secret},
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
        data = response.json()
        token = data.get("token")
        if not response.is_success or not token:
            raise HTTPException(status_code=502, detail=self._error_message(data, "Pesapal authentication failed."))
        return token

    async def _request_headers(self) -> dict[str, str]:
        token = await self._token()
        return {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        }

    async def resolve_ipn_id(self, ipn_url: str) -> str:
        configured = self._value("pesapal_ipn_id", settings.PESAPAL_IPN_ID)
        if configured:
            return configured

        headers = await self._request_headers()
        async with httpx.AsyncClient(timeout=20) as client:
            list_response = await client.get(f"{self.base_url}/api/URLSetup/GetIpnList", headers=headers)
            if list_response.is_success:
                registered = list_response.json()
                if isinstance(registered, list):
                    for item in registered:
                        if str(item.get("url", "")).rstrip("/") == ipn_url.rstrip("/") and item.get("ipn_id"):
                            return item["ipn_id"]

            response = await client.post(
                f"{self.base_url}/api/URLSetup/RegisterIPN",
                json={"url": ipn_url, "ipn_notification_type": "GET"},
                headers=headers,
            )
        data = response.json()
        ipn_id = data.get("ipn_id")
        if not response.is_success or not ipn_id:
            raise HTTPException(status_code=502, detail=self._error_message(data, "Pesapal IPN registration failed."))
        return ipn_id

    async def submit_order(
        self,
        *,
        invoice_number: str,
        amount: Decimal | float,
        currency: str,
        description: str,
        callback_url: str,
        cancellation_url: str,
        ipn_url: str,
        customer_email: str,
        customer_phone: str | None,
        customer_name: str,
    ) -> PesapalCheckoutResult:
        headers = await self._request_headers()
        ipn_id = await self.resolve_ipn_id(ipn_url)
        first_name, last_name = self._split_name(customer_name)
        payload = {
            "id": invoice_number,
            "currency": currency,
            "amount": float(amount),
            "description": description[:100],
            "callback_url": callback_url,
            "cancellation_url": cancellation_url,
            "notification_id": ipn_id,
            "redirect_mode": "TOP_WINDOW",
            "billing_address": {
                "email_address": customer_email,
                "phone_number": customer_phone or "",
                "country_code": "",
                "first_name": first_name,
                "middle_name": "",
                "last_name": last_name,
                "line_1": "",
                "line_2": "",
                "city": "",
                "state": "",
                "postal_code": "",
                "zip_code": "",
            },
        }
        async with httpx.AsyncClient(timeout=25) as client:
            response = await client.post(
                f"{self.base_url}/api/Transactions/SubmitOrderRequest",
                json=payload,
                headers=headers,
            )
        data = response.json()
        redirect_url = data.get("redirect_url")
        if not response.is_success or not redirect_url:
            raise HTTPException(status_code=502, detail=self._error_message(data, "Pesapal checkout creation failed."))
        return PesapalCheckoutResult(
            redirect_url=redirect_url,
            order_tracking_id=data.get("order_tracking_id"),
            merchant_reference=data.get("merchant_reference") or invoice_number,
        )

    async def get_transaction_status(self, order_tracking_id: str) -> PesapalStatusResult:
        headers = await self._request_headers()
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/api/Transactions/GetTransactionStatus",
                params={"orderTrackingId": order_tracking_id},
                headers=headers,
            )
        data = response.json()
        if not response.is_success:
            raise HTTPException(status_code=502, detail=self._error_message(data, "Pesapal transaction lookup failed."))
        status_text = str(data.get("payment_status_description") or data.get("status") or "").lower()
        try:
            status_code = int(data.get("status_code")) if data.get("status_code") is not None else None
        except (TypeError, ValueError):
            status_code = None
        amount = data.get("amount")
        return PesapalStatusResult(
            merchant_reference=data.get("merchant_reference"),
            order_tracking_id=order_tracking_id,
            status=self._map_status(status_text, status_code),
            status_code=status_code,
            amount=Decimal(str(amount)) if amount is not None else None,
            currency=data.get("currency"),
            payment_method=data.get("payment_method"),
            confirmation_code=data.get("confirmation_code"),
            raw=data,
        )

    def build_url(self, request: Request, path: str) -> str:
        configured_base = self._value("platform_domain", settings.PRIMARY_PLATFORM_DOMAIN)
        scheme = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip()
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if settings.is_production:
            host = configured_base
        return f"{scheme}://{host}{path}"

    @staticmethod
    def _map_status(status_text: str, status_code: int | None) -> str:
        if status_code == 1 or status_text == "completed":
            return "successful"
        if status_code == 2 or status_text == "failed":
            return "failed"
        if status_code == 3 or status_text == "reversed":
            return "cancelled"
        return "pending"

    @staticmethod
    def _split_name(value: str) -> tuple[str, str]:
        parts = [part for part in value.strip().split() if part]
        if not parts:
            return "Farmexa", "Customer"
        if len(parts) == 1:
            return parts[0], "Customer"
        return parts[0], " ".join(parts[1:])

    @staticmethod
    def _error_message(data: dict[str, Any], fallback: str) -> str:
        error = data.get("error") if isinstance(data, dict) else None
        if isinstance(error, dict) and error.get("message"):
            return str(error["message"])
        if isinstance(data, dict) and data.get("message"):
            return str(data["message"])
        return fallback
