"""
Affiliate marketing models for public referrals and commission tracking.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Affiliate(Base):
    __tablename__ = "affiliates"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    organization: Mapped[Optional[str]] = mapped_column(String(180), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", server_default="pending", index=True)
    referral_code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    referrals: Mapped[list["AffiliateReferral"]] = relationship(
        "AffiliateReferral", back_populates="affiliate", cascade="all, delete-orphan"
    )
    commissions: Mapped[list["AffiliateCommission"]] = relationship(
        "AffiliateCommission", back_populates="affiliate", cascade="all, delete-orphan"
    )


class AffiliateCommissionRule(Base):
    __tablename__ = "affiliate_commission_rules"
    __table_args__ = (UniqueConstraint("plan_code", name="uq_affiliate_commission_plan"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    commission_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=20, server_default="20")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    recurring: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    effective_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AffiliateReferral(Base):
    __tablename__ = "affiliate_referrals"
    __table_args__ = (UniqueConstraint("affiliate_id", "tenant_id", name="uq_affiliate_referral_tenant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    affiliate_id: Mapped[int] = mapped_column(ForeignKey("affiliates.id", ondelete="CASCADE"), index=True)
    referral_code: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    referred_email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    tenant_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tenants.id", ondelete="SET NULL"), index=True, nullable=True)
    landing_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    converted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    affiliate: Mapped[Affiliate] = relationship("Affiliate", back_populates="referrals")


class AffiliateCommission(Base):
    __tablename__ = "affiliate_commissions"
    __table_args__ = (UniqueConstraint("affiliate_id", "tenant_id", "plan_code", name="uq_affiliate_commission_tenant_plan"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    affiliate_id: Mapped[int] = mapped_column(ForeignKey("affiliates.id", ondelete="CASCADE"), index=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    plan_code: Mapped[str] = mapped_column(String(50), index=True)
    subscription_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    currency: Mapped[str] = mapped_column(String(10), default="UGX", server_default="UGX")
    commission_percent_snapshot: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    commission_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending", server_default="pending", index=True)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    affiliate: Mapped[Affiliate] = relationship("Affiliate", back_populates="commissions")


class AffiliateActivityLog(Base):
    __tablename__ = "affiliate_activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    affiliate_id: Mapped[Optional[int]] = mapped_column(ForeignKey("affiliates.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
