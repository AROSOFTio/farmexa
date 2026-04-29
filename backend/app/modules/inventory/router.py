from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.session import get_sync_db
from app.models.inventory import StockCategory
from app.modules.inventory import schemas, service

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/items", response_model=List[schemas.StockItemOut])
def list_items(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_items(db, skip, limit)


@router.get("/medicine/items", response_model=List[schemas.StockItemOut])
def list_medicine_items(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_items(db, skip, limit, category=StockCategory.MEDICINE)


@router.get("/movements", response_model=List[schemas.StockMovementOut])
def list_movements(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_movements(db, skip, limit)


@router.get("/medicine/movements", response_model=List[schemas.StockMovementOut])
def list_medicine_movements(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_movements(db, skip, limit, category=StockCategory.MEDICINE)


@router.post("/items", response_model=schemas.StockItemOut)
def create_item(
    item: schemas.StockItemCreate,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.create_item(db, item)


@router.post("/medicine/items", response_model=schemas.StockItemOut)
def create_medicine_item(
    item: schemas.StockItemCreate,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    payload = item.model_copy(update={"category": StockCategory.MEDICINE})
    return service.inventory_service.create_item(db, payload)


@router.post("/movements", response_model=schemas.StockMovementOut)
def create_movement(
    movement: schemas.StockMovementCreate,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.create_movement(db, movement)
