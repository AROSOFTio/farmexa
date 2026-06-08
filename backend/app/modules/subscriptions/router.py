from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_permission

from .schemas import (
    CheckoutStartOut,
    CustomDomainRequestCreate,
    CustomDomainRequestOut,
    DomainRequestMessageCreate,
    ModuleUpgradeRequestCreate,
    ModuleUpgradeRequestOut,
    PaymentCallbackIn,
    TenantUpgradeOverviewOut,
)
from .service import SubscriptionUpgradeService

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])


@router.get("/modules", response_model=TenantUpgradeOverviewOut)
async def get_module_upgrade_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await SubscriptionUpgradeService(db).get_overview(current_user)


@router.post("/modules/requests", response_model=ModuleUpgradeRequestOut, status_code=status.HTTP_201_CREATED)
async def create_module_upgrade_request(
    payload: ModuleUpgradeRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await SubscriptionUpgradeService(db).create_request(current_user, payload)


@router.post("/domains/requests", response_model=CustomDomainRequestOut, status_code=status.HTTP_201_CREATED)
async def create_custom_domain_request(
    payload: CustomDomainRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await SubscriptionUpgradeService(db).create_domain_request(current_user, payload)


@router.post("/domains/requests/{request_id}/messages", response_model=CustomDomainRequestOut)
async def add_custom_domain_request_message(
    request_id: int,
    payload: DomainRequestMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await SubscriptionUpgradeService(db).add_domain_request_message(
        request_id,
        current_user,
        payload.message,
        admin_message=False,
    )


@router.post("/payments/invoices/{invoice_id}/checkout", response_model=CheckoutStartOut)
async def start_invoice_checkout(
    invoice_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return await SubscriptionUpgradeService(db).start_invoice_checkout(current_user, invoice_id, request)


@router.get("/payments/pesapal/callback")
async def process_pesapal_callback(
    request: Request,
    OrderTrackingId: str | None = None,
    OrderMerchantReference: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if OrderTrackingId:
        await SubscriptionUpgradeService(db).process_pesapal_notification(
            order_tracking_id=OrderTrackingId,
            merchant_reference=OrderMerchantReference,
            source_ip=request.client.host if request.client else None,
            raw_payload=dict(request.query_params),
        )
    return RedirectResponse(url="/account/billing")


@router.api_route("/payments/pesapal/ipn", methods=["GET", "POST"])
async def process_pesapal_ipn(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    payload = dict(request.query_params)
    if request.method == "POST":
        try:
            body = await request.json()
            if isinstance(body, dict):
                payload.update(body)
        except Exception:
            form = await request.form()
            payload.update(dict(form))
    order_tracking_id = payload.get("OrderTrackingId") or payload.get("orderTrackingId")
    merchant_reference = payload.get("OrderMerchantReference") or payload.get("orderMerchantReference")
    notification_type = payload.get("OrderNotificationType") or payload.get("orderNotificationType") or "IPNCHANGE"
    if order_tracking_id:
        await SubscriptionUpgradeService(db).process_pesapal_notification(
            order_tracking_id=order_tracking_id,
            merchant_reference=merchant_reference,
            source_ip=request.client.host if request.client else None,
            raw_payload=payload,
        )
    return {
        "orderNotificationType": notification_type,
        "orderTrackingId": order_tracking_id,
        "orderMerchantReference": merchant_reference,
        "status": 200,
    }


@router.post("/admin/domain-requests/{request_id}/verify", response_model=CustomDomainRequestOut)
async def verify_custom_domain_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await SubscriptionUpgradeService(db).verify_domain_request(request_id, current_user)


@router.post("/admin/domain-requests/{request_id}/activate", response_model=CustomDomainRequestOut)
async def activate_custom_domain_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await SubscriptionUpgradeService(db).activate_domain_request(request_id, current_user)


@router.post("/admin/domain-requests/{request_id}/reject", response_model=CustomDomainRequestOut)
async def reject_custom_domain_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await SubscriptionUpgradeService(db).reject_domain_request(request_id, current_user)


@router.post("/admin/domain-requests/{request_id}/messages", response_model=CustomDomainRequestOut)
async def add_admin_domain_request_message(
    request_id: int,
    payload: DomainRequestMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await SubscriptionUpgradeService(db).add_domain_request_message(
        request_id,
        current_user,
        payload.message,
        admin_message=True,
    )


@router.post("/module-upgrades/callback", status_code=status.HTTP_204_NO_CONTENT)
async def process_module_upgrade_callback(
    payload: PaymentCallbackIn,
    request: Request,
    x_payment_callback_secret: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    await SubscriptionUpgradeService(db).process_payment_callback(
        payload,
        request.client.host if request.client else None,
        x_payment_callback_secret,
    )
