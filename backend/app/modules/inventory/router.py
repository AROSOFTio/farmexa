from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_sync_db
from . import schemas, service

router = APIRouter(prefix="/inventory", tags=["Inventory"])

@router.get("/items", response_model=List[schemas.StockItemOut])
def list_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_sync_db)):
    return service.inventory_service.get_items(db, skip, limit)

@router.get("/movements", response_model=List[schemas.StockMovementOut])
def list_movements(skip: int = 0, limit: int = 100, db: Session = Depends(get_sync_db)):
    return service.inventory_service.get_movements(db, skip, limit)

@router.post("/items", response_model=schemas.StockItemOut)
def create_item(item: schemas.StockItemCreate, db: Session = Depends(get_sync_db)):
    return service.inventory_service.create_item(db, item)

@router.post("/movements", response_model=schemas.StockMovementOut)
def create_movement(movement: schemas.StockMovementCreate, db: Session = Depends(get_sync_db)):
    return service.inventory_service.create_movement(db, movement)
