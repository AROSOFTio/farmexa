from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.modules.health_safety import schemas, service

router = APIRouter(prefix="/health-safety", tags=["Health & Safety"])


# Safety Incidents
@router.get("/incidents", response_model=List[schemas.SafetyIncidentOut])
def list_safety_incidents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:read")),
):
    return service.health_safety_service.get_safety_incidents(db, skip, limit)


@router.get("/incidents/{incident_id}", response_model=schemas.SafetyIncidentOut)
def get_safety_incident(
    incident_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:read")),
):
    return service.health_safety_service.get_safety_incident(db, incident_id)


@router.post("/incidents", response_model=schemas.SafetyIncidentOut)
def create_safety_incident(
    incident: schemas.SafetyIncidentCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:write")),
):
    return service.health_safety_service.create_safety_incident(db, incident)


@router.patch("/incidents/{incident_id}", response_model=schemas.SafetyIncidentOut)
def update_safety_incident(
    incident_id: int,
    incident: schemas.SafetyIncidentUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:write")),
):
    return service.health_safety_service.update_safety_incident(db, incident_id, incident)


# Safety Inspections
@router.get("/inspections", response_model=List[schemas.SafetyInspectionOut])
def list_safety_inspections(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:read")),
):
    return service.health_safety_service.get_safety_inspections(db, skip, limit)


@router.get("/inspections/{inspection_id}", response_model=schemas.SafetyInspectionOut)
def get_safety_inspection(
    inspection_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:read")),
):
    return service.health_safety_service.get_safety_inspection(db, inspection_id)


@router.post("/inspections", response_model=schemas.SafetyInspectionOut)
def create_safety_inspection(
    inspection: schemas.SafetyInspectionCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:write")),
):
    return service.health_safety_service.create_safety_inspection(db, inspection)


@router.patch("/inspections/{inspection_id}", response_model=schemas.SafetyInspectionOut)
def update_safety_inspection(
    inspection_id: int,
    inspection: schemas.SafetyInspectionUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:write")),
):
    return service.health_safety_service.update_safety_inspection(db, inspection_id, inspection)


@router.get("/inspections/{inspection_id}/items", response_model=List[schemas.SafetyInspectionItemOut])
def list_inspection_items(
    inspection_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:read")),
):
    return service.health_safety_service.get_inspection_items(db, inspection_id)


@router.post("/inspections/{inspection_id}/items", response_model=schemas.SafetyInspectionItemOut)
def create_inspection_item(
    inspection_id: int,
    item: schemas.SafetyInspectionItemCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:write")),
):
    item.safety_inspection_id = inspection_id
    return service.health_safety_service.create_inspection_item(db, item)


@router.patch("/inspection-items/{item_id}", response_model=schemas.SafetyInspectionItemOut)
def update_inspection_item(
    item_id: int,
    item: schemas.SafetyInspectionItemUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:write")),
):
    return service.health_safety_service.update_inspection_item(db, item_id, item)


# Corrective Actions
@router.get("/corrective-actions", response_model=List[schemas.CorrectiveActionOut])
def list_corrective_actions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:read")),
):
    return service.health_safety_service.get_corrective_actions(db, skip, limit)


@router.post("/corrective-actions", response_model=schemas.CorrectiveActionOut)
def create_corrective_action(
    action: schemas.CorrectiveActionCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:write")),
):
    return service.health_safety_service.create_corrective_action(db, action)


@router.patch("/corrective-actions/{action_id}", response_model=schemas.CorrectiveActionOut)
def update_corrective_action(
    action_id: int,
    action: schemas.CorrectiveActionUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("health_safety:write")),
):
    return service.health_safety_service.update_corrective_action(db, action_id, action)
