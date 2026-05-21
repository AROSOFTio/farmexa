from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.safety import (
    ActionStatus,
    CorrectiveAction,
    IncidentReport,
    IncidentStatus,
    IncidentType,
    InspectionResult,
    InspectionStatus,
    InspectionType,
    SafetyInspection,
    SafetyInspectionItem,
    SeverityLevel,
)


class SafetyIncidentBase(BaseModel):
    incident_date: date
    incident_type: IncidentType
    severity: SeverityLevel
    location: str
    description: str
    status: IncidentStatus = IncidentStatus.REPORTED


class SafetyIncidentCreate(SafetyIncidentBase):
    reported_by_id: int


class SafetyIncidentUpdate(BaseModel):
    incident_date: Optional[date] = None
    incident_type: Optional[IncidentType] = None
    severity: Optional[SeverityLevel] = None
    location: Optional[str] = None
    description: Optional[str] = None
    status: Optional[IncidentStatus] = None


class SafetyIncidentOut(SafetyIncidentBase):
    id: int
    incident_number: str
    reported_by_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SafetyInspectionBase(BaseModel):
    inspection_date: date
    inspection_type: InspectionType
    inspected_by_id: int
    score: Optional[float] = None
    notes: Optional[str] = None
    status: InspectionStatus = InspectionStatus.PLANNED


class SafetyInspectionCreate(SafetyInspectionBase):
    pass


class SafetyInspectionUpdate(BaseModel):
    inspection_date: Optional[date] = None
    inspection_type: Optional[InspectionType] = None
    inspected_by_id: Optional[int] = None
    score: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[InspectionStatus] = None


class SafetyInspectionOut(SafetyInspectionBase):
    id: int
    inspection_number: str
    created_at: datetime

    class Config:
        from_attributes = True


class SafetyInspectionItemBase(BaseModel):
    safety_inspection_id: int
    check_item: str
    result: InspectionResult = InspectionResult.NA
    comments: Optional[str] = None


class SafetyInspectionItemCreate(SafetyInspectionItemBase):
    pass


class SafetyInspectionItemUpdate(BaseModel):
    check_item: Optional[str] = None
    result: Optional[InspectionResult] = None
    comments: Optional[str] = None


class SafetyInspectionItemOut(SafetyInspectionItemBase):
    id: int

    class Config:
        from_attributes = True


class CorrectiveActionBase(BaseModel):
    source_type: str
    source_id: int
    action_required: str
    assignee_id: int
    due_date: date
    status: ActionStatus = ActionStatus.PENDING


class CorrectiveActionCreate(CorrectiveActionBase):
    pass


class CorrectiveActionUpdate(BaseModel):
    action_required: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[ActionStatus] = None


class CorrectiveActionOut(CorrectiveActionBase):
    id: int
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
