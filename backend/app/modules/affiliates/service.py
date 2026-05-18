from __future__ import annotations

import secrets
import string
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.affiliate import (
    Affiliate,
    AffiliateActivityLog,
    AffiliateCommission,
    AffiliateCommissionRule,
    AffiliateReferral,
)
from app.models.tenant import PlanDefinition, Subscription, Tenant
from app.modules.affiliates.schemas import (
    AffiliateOverviewOut,
    AffiliateRegisterRequest,
    AffiliateRegistrationOut,
    AffiliateStatusUpdate,
    CommissionRuleUpdate,
    MarkCommissionPaidRequest,
)
from app.services.email_service import log_and_send_email


DEFAULT_COMMISSION_PERCENT = Decimal("20")


class AffiliateService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, payload: AffiliateRegisterRequest, request: Request) -> AffiliateRegistrationOut:
        if not payload.accepted_terms:
            raise HTTPException(status_code=422, detail="You must accept the affiliate terms to continue.")

        email = str(payload.email).strip().lower()
        existing = (await self.db.execute(select(Affiliate).where(func.lower(Affiliate.email) == email))).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="An affiliate application already exists for this email.")

        affiliate = Affiliate(
            full_name=payload.full_name.strip(),
            email=email,
            phone=payload.phone,
            country=payload.country,
            organization=payload.organization,
            website_url=payload.website_url,
            referral_code=await self._unique_referral_code(payload.full_name),
            status="pending",
        )
        self.db.add(affiliate)
        await self.db.flush()
        self.db.add(AffiliateActivityLog(affiliate_id=affiliate.id, action="affiliate_registered", details=email))

        await log_and_send_email(
            self.db,
            recipient=email,
            subject="Farmexa affiliate application received",
            body=(
                f"Hello {affiliate.full_name},\n\n"
                "We received your Farmexa affiliate application. A platform administrator will review it.\n\n"
                f"Your referral code will be: {affiliate.referral_code}\n\n"
                "Regards,\nFarmexa Team"
            ),
            email_type="Affiliate Signup",
        )
        await self.db.commit()
        await self.db.refresh(affiliate)
        return AffiliateRegistrationOut(message="Affiliate application received.", affiliate=affiliate)

    async def list_affiliates(self) -> list[Affiliate]:
        return list((await self.db.execute(select(Affiliate).order_by(Affiliate.created_at.desc()))).scalars().all())

    async def overview(self) -> AffiliateOverviewOut:
        total = await self._count(Affiliate)
        pending = await self._count(Affiliate, Affiliate.status == "pending")
        approved = await self._count(Affiliate, Affiliate.status == "approved")
        suspended = await self._count(Affiliate, Affiliate.status == "suspended")
        referrals = await self._count(AffiliateReferral)
        converted = await self._count(AffiliateReferral, AffiliateReferral.converted_at.is_not(None))
        pending_amount = await self._sum_commissions("pending")
        paid_amount = await self._sum_commissions("paid")
        return AffiliateOverviewOut(
            total_affiliates=total,
            pending_affiliates=pending,
            approved_affiliates=approved,
            suspended_affiliates=suspended,
            total_referrals=referrals,
            converted_referrals=converted,
            pending_commission_amount=pending_amount,
            paid_commission_amount=paid_amount,
        )

    async def update_status(self, affiliate_id: int, payload: AffiliateStatusUpdate, actor) -> Affiliate:
        affiliate = await self._get_affiliate(affiliate_id)
        affiliate.status = payload.status
        affiliate.notes = payload.notes or affiliate.notes
        if payload.status == "approved":
            affiliate.approved_at = datetime.now(UTC)
            affiliate.approved_by_user_id = actor.id
        self.db.add(
            AffiliateActivityLog(
                affiliate_id=affiliate.id,
                action=f"affiliate_{payload.status}",
                details=payload.notes,
            )
        )
        if payload.send_email:
            await log_and_send_email(
                self.db,
                recipient=affiliate.email,
                subject=f"Farmexa affiliate status: {payload.status}",
                body=(
                    f"Hello {affiliate.full_name},\n\n"
                    f"Your Farmexa affiliate account status is now: {payload.status}.\n\n"
                    f"Referral link: https://{settings.PRIMARY_PLATFORM_DOMAIN}/?ref={affiliate.referral_code}\n\n"
                    "Regards,\nFarmexa Team"
                ),
                email_type=f"Affiliate {payload.status.title()}",
            )
        await self.db.commit()
        await self.db.refresh(affiliate)
        return affiliate

    async def list_rules(self) -> list[AffiliateCommissionRule]:
        await self.seed_default_rules()
        result = await self.db.execute(select(AffiliateCommissionRule).order_by(AffiliateCommissionRule.plan_code))
        return list(result.scalars().all())

    async def update_rule(self, plan_code: str, payload: CommissionRuleUpdate) -> AffiliateCommissionRule:
        await self.seed_default_rules()
        rule = (
            await self.db.execute(select(AffiliateCommissionRule).where(AffiliateCommissionRule.plan_code == plan_code))
        ).scalar_one_or_none()
        if not rule:
            rule = AffiliateCommissionRule(plan_code=plan_code)
            self.db.add(rule)
        rule.commission_percent = payload.commission_percent
        rule.is_active = payload.is_active
        rule.recurring = payload.recurring
        await self.db.commit()
        await self.db.refresh(rule)
        return rule

    async def list_referrals(self) -> list[AffiliateReferral]:
        result = await self.db.execute(select(AffiliateReferral).order_by(AffiliateReferral.first_seen_at.desc()))
        return list(result.scalars().all())

    async def list_commissions(self) -> list[AffiliateCommission]:
        result = await self.db.execute(select(AffiliateCommission).order_by(AffiliateCommission.created_at.desc()))
        return list(result.scalars().all())

    async def mark_paid(self, commission_id: int, payload: MarkCommissionPaidRequest) -> AffiliateCommission:
        commission = (
            await self.db.execute(select(AffiliateCommission).where(AffiliateCommission.id == commission_id))
        ).scalar_one_or_none()
        if not commission:
            raise HTTPException(status_code=404, detail="Commission was not found.")
        commission.status = "paid"
        commission.payment_reference = payload.payment_reference
        commission.paid_at = datetime.now(UTC)
        affiliate = await self._get_affiliate(commission.affiliate_id)
        await log_and_send_email(
            self.db,
            recipient=affiliate.email,
            subject="Farmexa affiliate payout marked paid",
            body=(
                f"Hello {affiliate.full_name},\n\n"
                f"A commission payout of {commission.currency} {commission.commission_amount} has been marked paid.\n\n"
                "Regards,\nFarmexa Team"
            ),
            email_type="Affiliate Payout Paid",
        )
        await self.db.commit()
        await self.db.refresh(commission)
        return commission

    async def seed_default_rules(self) -> None:
        plans = (await self.db.execute(select(PlanDefinition.code))).scalars().all()
        for plan_code in plans:
            statement = (
                insert(AffiliateCommissionRule)
                .values(plan_code=plan_code, commission_percent=DEFAULT_COMMISSION_PERCENT, is_active=True, recurring=False)
                .on_conflict_do_nothing(index_elements=["plan_code"])
            )
            await self.db.execute(statement)
        await self.db.flush()

    async def record_registration_referral(self, *, referral_code: str | None, tenant: Tenant, request: Request) -> None:
        code = (referral_code or "").strip().upper()
        if not code:
            return
        affiliate = (
            await self.db.execute(
                select(Affiliate).where(Affiliate.referral_code == code, Affiliate.status == "approved")
            )
        ).scalar_one_or_none()
        if not affiliate:
            return
        existing = (
            await self.db.execute(
                select(AffiliateReferral).where(
                    AffiliateReferral.affiliate_id == affiliate.id,
                    AffiliateReferral.tenant_id == tenant.id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return
        self.db.add(
            AffiliateReferral(
                affiliate_id=affiliate.id,
                referral_code=code,
                referred_email=tenant.email,
                tenant_id=tenant.id,
                landing_url=str(request.url),
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                converted_at=datetime.now(UTC),
            )
        )
        self.db.add(AffiliateActivityLog(affiliate_id=affiliate.id, action="tenant_referred", details=tenant.email))
        await self.create_commission_for_tenant(affiliate=affiliate, tenant=tenant)

    async def create_commission_for_tenant(self, *, affiliate: Affiliate, tenant: Tenant) -> None:
        plan_code = tenant.plan or "full_trial"
        subscription = (
            await self.db.execute(
                select(Subscription).where(Subscription.tenant_id == tenant.id).order_by(Subscription.created_at.desc()).limit(1)
            )
        ).scalar_one_or_none()
        amount = Decimal(str(subscription.amount or 0)) if subscription else Decimal("0")
        currency = subscription.currency if subscription else "UGX"
        rule = (
            await self.db.execute(
                select(AffiliateCommissionRule).where(
                    AffiliateCommissionRule.plan_code == plan_code,
                    AffiliateCommissionRule.is_active.is_(True),
                )
            )
        ).scalar_one_or_none()
        percent = Decimal(str(rule.commission_percent if rule else DEFAULT_COMMISSION_PERCENT))
        commission_amount = (amount * percent / Decimal("100")).quantize(Decimal("0.01"))
        if amount <= 0:
            return
        existing = (
            await self.db.execute(
                select(AffiliateCommission).where(
                    AffiliateCommission.affiliate_id == affiliate.id,
                    AffiliateCommission.tenant_id == tenant.id,
                    AffiliateCommission.plan_code == plan_code,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return
        commission = AffiliateCommission(
            affiliate_id=affiliate.id,
            tenant_id=tenant.id,
            plan_code=plan_code,
            subscription_amount=amount,
            currency=currency,
            commission_percent_snapshot=percent,
            commission_amount=commission_amount,
            status="pending",
        )
        self.db.add(commission)
        await log_and_send_email(
            self.db,
            recipient=affiliate.email,
            subject="Farmexa affiliate commission earned",
            body=(
                f"Hello {affiliate.full_name},\n\n"
                f"You earned a Farmexa affiliate commission: {currency} {commission_amount}.\n\n"
                "It will be reviewed for payout by the platform team.\n\n"
                "Regards,\nFarmexa Team"
            ),
            email_type="Affiliate Commission Earned",
        )

    async def create_commission_for_referred_tenant(self, tenant: Tenant) -> None:
        referral = (
            await self.db.execute(
                select(AffiliateReferral)
                .where(AffiliateReferral.tenant_id == tenant.id)
                .order_by(AffiliateReferral.first_seen_at.asc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if not referral:
            return
        affiliate = await self._get_affiliate(referral.affiliate_id)
        if affiliate.status != "approved":
            return
        await self.create_commission_for_tenant(affiliate=affiliate, tenant=tenant)

    async def _unique_referral_code(self, full_name: str) -> str:
        alphabet = string.ascii_uppercase + string.digits
        prefix = "".join(ch for ch in full_name.upper() if ch.isalnum())[:6] or "FARMEX"
        for _ in range(20):
            code = f"{prefix}{''.join(secrets.choice(alphabet) for _ in range(4))}"
            existing = (await self.db.execute(select(Affiliate.id).where(Affiliate.referral_code == code))).scalar_one_or_none()
            if not existing:
                return code
        return secrets.token_urlsafe(8).replace("-", "").replace("_", "").upper()[:12]

    async def _get_affiliate(self, affiliate_id: int) -> Affiliate:
        affiliate = (await self.db.execute(select(Affiliate).where(Affiliate.id == affiliate_id))).scalar_one_or_none()
        if not affiliate:
            raise HTTPException(status_code=404, detail="Affiliate was not found.")
        return affiliate

    async def _count(self, model, *criteria) -> int:
        statement = select(func.count()).select_from(model)
        for condition in criteria:
            statement = statement.where(condition)
        return int((await self.db.execute(statement)).scalar_one() or 0)

    async def _sum_commissions(self, status: str) -> Decimal:
        value = (
            await self.db.execute(
                select(func.coalesce(func.sum(AffiliateCommission.commission_amount), 0)).where(AffiliateCommission.status == status)
            )
        ).scalar_one()
        return Decimal(str(value or 0))
