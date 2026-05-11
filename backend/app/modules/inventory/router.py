from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.models.inventory import StockCategory, TransferStatus, TransferType
from app.modules.inventory import schemas, service

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/items", response_model=List[schemas.StockItemOut])
def list_items(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_items(db, skip, limit)


@router.get("/medicine/items", response_model=List[schemas.StockItemOut])
def list_medicine_items(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_items(db, skip, limit, category=StockCategory.MEDICINE)


@router.get("/movements", response_model=List[schemas.StockMovementOut])
def list_movements(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_movements(db, skip, limit)


@router.get("/medicine/movements", response_model=List[schemas.StockMovementOut])
def list_medicine_movements(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_movements(db, skip, limit, category=StockCategory.MEDICINE)


@router.post("/items", response_model=schemas.StockItemOut)
def create_item(
    item: schemas.StockItemCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.create_item(db, item)


@router.post("/medicine/items", response_model=schemas.StockItemOut)
def create_medicine_item(
    item: schemas.StockItemCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    payload = item.model_copy(update={"category": StockCategory.MEDICINE})
    return service.inventory_service.create_item(db, payload)


@router.put("/items/{item_id}", response_model=schemas.StockItemOut)
def update_item(
    item_id: int,
    item: schemas.StockItemUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.update_item(db, item_id, item)


@router.put("/medicine/items/{item_id}", response_model=schemas.StockItemOut)
def update_medicine_item(
    item_id: int,
    item: schemas.StockItemUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    payload = item.model_copy(update={"category": StockCategory.MEDICINE})
    return service.inventory_service.update_item(db, item_id, payload)


@router.post("/movements", response_model=schemas.StockMovementOut)
def create_movement(
    movement: schemas.StockMovementCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.create_movement(db, movement)


@router.get("/transfers", response_model=List[schemas.StockTransferOut])
def list_transfers(
    status_filter: TransferStatus | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_transfers(db, skip, limit, status_filter)


@router.get("/giv", response_model=List[schemas.StockTransferOut])
def list_giv(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return [item for item in service.inventory_service.get_transfers(db, skip, limit) if item.transfer_type == TransferType.GIV]


@router.get("/grn", response_model=List[schemas.StockTransferOut])
def list_grn(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return [
        item
        for item in service.inventory_service.get_transfers(db, skip, limit)
        if item.status in {TransferStatus.ISSUED, TransferStatus.RECEIVED}
    ]


@router.post("/transfers", response_model=schemas.StockTransferOut)
def create_transfer(
    transfer: schemas.StockTransferCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.create_transfer(db, transfer)


@router.patch("/transfers/{transfer_id}/status", response_model=schemas.StockTransferOut)
def update_transfer_status(
    transfer_id: int,
    payload: schemas.StockTransferStatusUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.update_transfer_status(db, transfer_id, payload)
