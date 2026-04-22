from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_sync_db
from . import schemas, service

router = APIRouter(prefix="/slaughter", tags=["Slaughter"])

@router.get("/records", response_model=List[schemas.SlaughterRecordOut])
def list_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_sync_db)):
    return service.slaughter_service.get_records(db, skip, limit)

@router.post("/records", response_model=schemas.SlaughterRecordOut)
def create_record(record: schemas.SlaughterRecordCreate, db: Session = Depends(get_sync_db)):
    return service.slaughter_service.create_record(db, record)

@router.patch("/records/{record_id}", response_model=schemas.SlaughterRecordOut)
def update_record(record_id: int, updates: schemas.SlaughterRecordUpdate, db: Session = Depends(get_sync_db)):
    return service.slaughter_service.update_record(db, record_id, updates)

@router.post("/records/{record_id}/outputs", response_model=schemas.SlaughterOutputOut)
def add_output(record_id: int, output: schemas.SlaughterOutputCreate, db: Session = Depends(get_sync_db)):
    return service.slaughter_service.add_output(db, record_id, output)
