from datetime import datetime, timezone
import enum

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.enums import db_enum


class IncidentType(str, enum.Enum):
    INJURY = "injury"
    ACCIDENT = "accident"
    BIOSECURITY_BREACH = "biosecurity_breach"
    HAZARD = "hazard"
    OTHER = "other"


class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(str, enum.Enum):
    REPORTED = "reported"
    UNDER_INVESTIGATION = "under_investigation"
    RESOLVED = "resolved"
    CLOSED = "closed"


class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id = Column(Integer, primary_key=True, index=True)
    incident_number = Column(String(50), unique=True, index=True, nullable=False)
    incident_date = Column(Date, nullable=False)
    incident_type = Column(db_enum(IncidentType, name="incidenttype"), nullable=False, default=IncidentType.OTHER)
    severity = Column(db_enum(SeverityLevel, name="severitylevel"), nullable=False, default=SeverityLevel.LOW)
    location = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    reported_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(db_enum(IncidentStatus, name="incidentstatus"), nullable=False, default=IncidentStatus.REPORTED)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    reported_by = relationship("User")


class InspectionType(str, enum.Enum):
    PPE = "ppe"
    SANITATION = "sanitation"
    BIOSECURITY = "biosecurity"
    GENERAL = "general"


class InspectionStatus(str, enum.Enum):
    PLANNED = "planned"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SafetyInspection(Base):
    __tablename__ = "safety_inspections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_number = Column(String(50), unique=True, index=True, nullable=False)
    inspection_date = Column(Date, nullable=False)
    inspection_type = Column(db_enum(InspectionType, name="inspectiontype"), nullable=False, default=InspectionType.GENERAL)
    inspected_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    score = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(db_enum(InspectionStatus, name="inspectionstatus"), nullable=False, default=InspectionStatus.PLANNED)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    inspected_by = relationship("User")
    items = relationship("SafetyInspectionItem", back_populates="safety_inspection", cascade="all, delete-orphan")


class InspectionResult(str, enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    NA = "na"


class SafetyInspectionItem(Base):
    __tablename__ = "safety_inspection_items"

    id = Column(Integer, primary_key=True, index=True)
    safety_inspection_id = Column(Integer, ForeignKey("safety_inspections.id"), nullable=False)
    check_item = Column(String(200), nullable=False)
    result = Column(db_enum(InspectionResult, name="inspectionresult"), nullable=False, default=InspectionResult.NA)
    comments = Column(Text, nullable=True)

    safety_inspection = relationship("SafetyInspection", back_populates="items")


class ActionStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"


class CorrectiveAction(Base):
    __tablename__ = "corrective_actions"

    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String(50), nullable=False)  # incident, inspection
    source_id = Column(Integer, nullable=False)
    action_required = Column(Text, nullable=False)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    due_date = Column(Date, nullable=False)
    status = Column(db_enum(ActionStatus, name="actionstatus"), nullable=False, default=ActionStatus.PENDING)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    assignee = relationship("User")
