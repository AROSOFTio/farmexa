from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.modules.affiliates.schemas import (
    AffiliateOut,
    AffiliateOverviewOut,
    AffiliateRegisterRequest,
    AffiliateRegistrationOut,
    AffiliateStatusUpdate,
    CommissionOut,
    CommissionRuleOut,
    CommissionRuleUpdate,
    MarkCommissionPaidRequest,
    ReferralOut,
)
from app.modules.affiliates.service import AffiliateService


router = APIRouter(prefix="/affiliates", tags=["Affiliates"])


@router.post("/register", response_model=AffiliateRegistrationOut, status_code=status.HTTP_201_CREATED)
async def register_affiliate(
    payload: AffiliateRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    return await AffiliateService(db).register(payload, request)


@router.get("/admin/overview", response_model=AffiliateOverviewOut)
async def affiliate_overview(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await AffiliateService(db).overview()


@router.get("/admin/affiliates", response_model=list[AffiliateOut])
async def list_affiliates(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await AffiliateService(db).list_affiliates()


@router.post("/admin/affiliates/{affiliate_id}/status", response_model=AffiliateOut)
async def update_affiliate_status(
    affiliate_id: int,
    payload: AffiliateStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await AffiliateService(db).update_status(affiliate_id, payload, current_user)


@router.get("/admin/rules", response_model=list[CommissionRuleOut])
async def list_commission_rules(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await AffiliateService(db).list_rules()


@router.put("/admin/rules/{plan_code}", response_model=CommissionRuleOut)
async def update_commission_rule(
    plan_code: str,
    payload: CommissionRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await AffiliateService(db).update_rule(plan_code, payload)


@router.get("/admin/referrals", response_model=list[ReferralOut])
async def list_referrals(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await AffiliateService(db).list_referrals()


@router.get("/admin/commissions", response_model=list[CommissionOut])
async def list_commissions(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:read")),
):
    return await AffiliateService(db).list_commissions()


@router.post("/admin/commissions/{commission_id}/paid", response_model=CommissionOut)
async def mark_commission_paid(
    commission_id: int,
    payload: MarkCommissionPaidRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dev_admin:write")),
):
    return await AffiliateService(db).mark_paid(commission_id, payload)
