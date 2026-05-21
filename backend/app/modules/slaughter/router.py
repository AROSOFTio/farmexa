from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.modules.slaughter import schemas, service
from app.core.deps import get_current_user

router = APIRouter(prefix="/slaughter", tags=["Slaughter"])


@router.get("/records", response_model=List[schemas.SlaughterRecordOut])
def list_records(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("slaughter:read")),
):
    return service.slaughter_service.get_records(db, current_user, skip, limit)


@router.post("/records", response_model=schemas.SlaughterRecordOut)
def create_record(
    record: schemas.SlaughterRecordCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("slaughter:write")),
):
    return service.slaughter_service.create_record(db, record, current_user)


@router.patch("/records/{record_id}", response_model=schemas.SlaughterRecordOut)
def update_record(
    record_id: int,
    updates: schemas.SlaughterRecordUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("slaughter:write")),
):
    return service.slaughter_service.update_record(db, record_id, updates, current_user)


@router.post("/records/{record_id}/outputs", response_model=schemas.SlaughterOutputOut)
def add_output(
    record_id: int,
    output: schemas.SlaughterOutputCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(get_current_user),
):
    return service.slaughter_service.add_output(db, record_id, output, current_user)


@router.get("/records/{record_id}/byproducts", response_model=List[schemas.SlaughterByProductOut])
def list_byproducts(
    record_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("slaughter:read")),
):
    return service.slaughter_service.get_byproducts(db, record_id, current_user)


@router.post("/records/{record_id}/byproducts", response_model=schemas.SlaughterByProductOut)
def add_byproduct(
    record_id: int,
    byproduct: schemas.SlaughterByProductCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(get_current_user),
):
    return service.slaughter_service.add_byproduct(db, record_id, byproduct, current_user)


@router.patch("/byproducts/{byproduct_id}", response_model=schemas.SlaughterByProductOut)
def update_byproduct(
    byproduct_id: int,
    updates: schemas.SlaughterByProductUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("slaughter:write")),
):
    return service.slaughter_service.update_byproduct(db, byproduct_id, updates, current_user)


@router.delete("/byproducts/{byproduct_id}")
def delete_byproduct(
    byproduct_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("slaughter:write")),
):
    return service.slaughter_service.delete_byproduct(db, byproduct_id, current_user)
