from __future__ import annotations

from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db

from .schemas import ModuleUpgradeRequestCreate, ModuleUpgradeRequestOut, PaymentCallbackIn, TenantUpgradeOverviewOut
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
