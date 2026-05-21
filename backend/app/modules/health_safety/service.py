from datetime import datetime, timezone
from typing import List
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.safety import (
    CorrectiveAction,
    IncidentReport,
    SafetyInspection,
    SafetyInspectionItem,
)

from . import schemas


class HealthSafetyService:
    """Service for Health & Safety operations."""
    
    def get_safety_incidents(self, db: Session, skip: int = 0, limit: int = 100) -> List[IncidentReport]:
        """Get all safety incidents."""
        return (
            db.query(IncidentReport)
            .order_by(IncidentReport.incident_date.desc(), IncidentReport.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_safety_incident(self, db: Session, incident_id: int) -> IncidentReport:
        """Get a single safety incident by ID."""
        incident = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
        if not incident:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Safety incident not found")
        return incident
    
    def create_safety_incident(self, db: Session, incident: schemas.SafetyIncidentCreate) -> IncidentReport:
        """Create a new safety incident."""
        db_incident = IncidentReport(
            incident_number=f"INC-{uuid4().hex[:8].upper()}",
            **incident.model_dump(),
        )
        db.add(db_incident)
        db.commit()
        db.refresh(db_incident)
        return db_incident
    
    def update_safety_incident(self, db: Session, incident_id: int, incident: schemas.SafetyIncidentUpdate) -> IncidentReport:
        """Update an existing safety incident."""
        db_incident = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
        if not db_incident:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Safety incident not found")
        
        update_data = incident.model_dump(exclude_unset=True, exclude_none=True)
        for key, value in update_data.items():
            setattr(db_incident, key, value)
        
        db.commit()
        db.refresh(db_incident)
        return db_incident
    
    def get_safety_inspections(self, db: Session, skip: int = 0, limit: int = 100) -> List[SafetyInspection]:
        """Get all safety inspections."""
        return (
            db.query(SafetyInspection)
            .order_by(SafetyInspection.inspection_date.desc(), SafetyInspection.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def get_safety_inspection(self, db: Session, inspection_id: int) -> SafetyInspection:
        """Get a single safety inspection by ID."""
        inspection = db.query(SafetyInspection).filter(SafetyInspection.id == inspection_id).first()
        if not inspection:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Safety inspection not found")
        return inspection
    
    def create_safety_inspection(self, db: Session, inspection: schemas.SafetyInspectionCreate) -> SafetyInspection:
        """Create a new safety inspection."""
        db_inspection = SafetyInspection(
            inspection_number=f"INS-{uuid4().hex[:8].upper()}",
            **inspection.model_dump(),
        )
        db.add(db_inspection)
        db.commit()
        db.refresh(db_inspection)
        return db_inspection
    
    def update_safety_inspection(self, db: Session, inspection_id: int, inspection: schemas.SafetyInspectionUpdate) -> SafetyInspection:
        """Update an existing safety inspection."""
        db_inspection = db.query(SafetyInspection).filter(SafetyInspection.id == inspection_id).first()
        if not db_inspection:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Safety inspection not found")
        
        update_data = inspection.model_dump(exclude_unset=True, exclude_none=True)
        for key, value in update_data.items():
            setattr(db_inspection, key, value)
        
        db.commit()
        db.refresh(db_inspection)
        return db_inspection
    
    def get_inspection_items(self, db: Session, inspection_id: int) -> List[SafetyInspectionItem]:
        """Get inspection items for a specific inspection."""
        return db.query(SafetyInspectionItem).filter(SafetyInspectionItem.safety_inspection_id == inspection_id).all()
    
    def create_inspection_item(self, db: Session, item: schemas.SafetyInspectionItemCreate) -> SafetyInspectionItem:
        """Create a new inspection item."""
        db_item = SafetyInspectionItem(**item.model_dump())
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item
    
    def update_inspection_item(self, db: Session, item_id: int, item: schemas.SafetyInspectionItemUpdate) -> SafetyInspectionItem:
        """Update an existing inspection item."""
        db_item = db.query(SafetyInspectionItem).filter(SafetyInspectionItem.id == item_id).first()
        if not db_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspection item not found")
        
        update_data = item.model_dump(exclude_unset=True, exclude_none=True)
        for key, value in update_data.items():
            setattr(db_item, key, value)
        
        db.commit()
        db.refresh(db_item)
        return db_item
    
    def get_corrective_actions(self, db: Session, skip: int = 0, limit: int = 100) -> List[CorrectiveAction]:
        """Get all corrective actions."""
        return (
            db.query(CorrectiveAction)
            .order_by(CorrectiveAction.due_date.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    
    def create_corrective_action(self, db: Session, action: schemas.CorrectiveActionCreate) -> CorrectiveAction:
        """Create a new corrective action."""
        db_action = CorrectiveAction(**action.model_dump())
        db.add(db_action)
        db.commit()
        db.refresh(db_action)
        return db_action
    
    def update_corrective_action(self, db: Session, action_id: int, action: schemas.CorrectiveActionUpdate) -> CorrectiveAction:
        """Update an existing corrective action."""
        db_action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
        if not db_action:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrective action not found")
        
        update_data = action.model_dump(exclude_unset=True, exclude_none=True)
        for key, value in update_data.items():
            setattr(db_action, key, value)
        
        db.commit()
        db.refresh(db_action)
        return db_action


health_safety_service = HealthSafetyService()
