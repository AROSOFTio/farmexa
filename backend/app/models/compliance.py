"""
Compliance document and reminder models.
"""

import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import db_enum


class ComplianceDocumentType(str, enum.Enum):
    URA_TAX_DOCUMENT = "ura_tax_document"
    TRADING_LICENCE = "trading_licence"
    VETERINARY_PERMIT = "veterinary_permit"
    TAX_CLEARANCE = "tax_clearance"
    FARM_REGISTRATION = "farm_registration"
    NSSF_PAYE = "nssf_paye"
    CONTRACT = "contract"
    INSURANCE = "insurance"
    INSPECTION_REPORT = "inspection_report"
    OTHER = "other"


class ComplianceDocumentStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"
    RENEWAL_DUE = "renewal_due"
    MISSING = "missing"


class ReminderStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    DISMISSED = "dismissed"


class ComplianceDocument(Base):
    __tablename__ = "compliance_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    document_type: Mapped[ComplianceDocumentType] = mapped_column(
        db_enum(ComplianceDocumentType, name="compliancedocumenttype"), index=True
    )
    reference_number: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    issuing_authority: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    issue_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    renewal_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    responsible_person: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ComplianceDocumentStatus] = mapped_column(
        db_enum(ComplianceDocumentStatus, name="compliancedocumentstatus"),
        default=ComplianceDocumentStatus.ACTIVE,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="compliance_documents")
    reminders: Mapped[list["DocumentReminder"]] = relationship(
        "DocumentReminder", back_populates="document", cascade="all, delete-orphan"
    )


class DocumentReminder(Base):
    __tablename__ = "document_reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("compliance_documents.id", ondelete="CASCADE"), index=True
    )
    reminder_type: Mapped[str] = mapped_column(String(30), nullable=False)
    scheduled_for: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[ReminderStatus] = mapped_column(
        db_enum(ReminderStatus, name="documentreminderstatus"),
        default=ReminderStatus.PENDING,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    document: Mapped["ComplianceDocument"] = relationship("ComplianceDocument", back_populates="reminders")

