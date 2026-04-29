from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ComplianceDocumentOut(BaseModel):
    id: int
    title: str
    document_type: str
    reference_number: Optional[str]
    issuing_authority: Optional[str]
    issue_date: Optional[date]
    expiry_date: Optional[date]
    renewal_date: Optional[date]
    responsible_person: Optional[str]
    file_url: Optional[str]
    notes: Optional[str]
    status: str
    days_to_expiry: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComplianceAlertOut(BaseModel):
    document_id: int
    title: str
    document_type: str
    expiry_date: Optional[date]
    status: str
    days_to_expiry: Optional[int]
    reminder_offsets: list[int] = Field(default_factory=list)


class ComplianceSummaryOut(BaseModel):
    total_documents: int
    active_documents: int
    expiring_documents: int
    expired_documents: int
    alerts: list[ComplianceAlertOut]
