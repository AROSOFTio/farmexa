from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission, get_current_user
from app.core.branch_deps import get_branch_context, BranchContext
from app.db.tenant_db import get_tenant_sync_db
from app.models.inventory import StockCategory, TransferStatus, GIVStatus, GRNStatus
from app.modules.inventory import schemas, service

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/items", response_model=List[schemas.StockItemOut])
def list_items(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
    branch_ctx: BranchContext = Depends(get_branch_context),
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
    branch_ctx: BranchContext = Depends(get_branch_context),
):
    branch_id = item.branch_id or (branch_ctx.active_branch_id if branch_ctx else None)
    return service.inventory_service.create_item(db, item, branch_id=branch_id)


@router.post("/medicine/items", response_model=schemas.StockItemOut)
def create_medicine_item(
    item: schemas.StockItemCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
    branch_ctx: BranchContext = Depends(get_branch_context),
):
    payload = item.model_copy(update={"category": StockCategory.MEDICINE})
    branch_id = item.branch_id or (branch_ctx.active_branch_id if branch_ctx else None)
    return service.inventory_service.create_item(db, payload, branch_id=branch_id)


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


# Store Location endpoints
@router.get("/store-locations", response_model=List[schemas.StoreLocationOut])
def list_store_locations(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_store_locations(db, skip, limit, active_only)


@router.get("/store-locations/{location_id}", response_model=schemas.StoreLocationOut)
def get_store_location(
    location_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    return service.inventory_service.get_store_location(db, location_id)


@router.post("/store-locations", response_model=schemas.StoreLocationOut)
def create_store_location(
    location: schemas.StoreLocationCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.create_store_location(db, location)


@router.put("/store-locations/{location_id}", response_model=schemas.StoreLocationOut)
def update_store_location(
    location_id: int,
    location: schemas.StoreLocationUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.update_store_location(db, location_id, location)


@router.delete("/store-locations/{location_id}")
def delete_store_location(
    location_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.inventory_service.delete_store_location(db, location_id)


# GIV (Goods Issue Voucher) endpoints
@router.get("/giv", response_model=List[schemas.GIVOut])
def list_givs(
    skip: int = 0,
    limit: int = 100,
    status_filter: GIVStatus | None = None,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("giv:read")),
):
    return service.inventory_service.get_givs(db, skip, limit, status_filter)


@router.get("/giv/{giv_id}", response_model=schemas.GIVOut)
def get_giv(
    giv_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("giv:read")),
):
    return service.inventory_service.get_giv(db, giv_id)


@router.post("/giv", response_model=schemas.GIVOut)
def create_giv(
    giv: schemas.GIVCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(get_current_user),
):
    return service.inventory_service.create_giv(db, giv, current_user.id)


@router.patch("/giv/{giv_id}/status", response_model=schemas.GIVOut)
def update_giv_status(
    giv_id: int,
    payload: schemas.GIVStatusUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(get_current_user),
):
    return service.inventory_service.update_giv_status(db, giv_id, payload, current_user.id)


# GRN (Goods Received Note) endpoints
@router.get("/grn", response_model=List[schemas.GRNOut])
def list_grns(
    skip: int = 0,
    limit: int = 100,
    status_filter: GRNStatus | None = None,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("grn:read")),
):
    return service.inventory_service.get_grns(db, skip, limit, status_filter)


@router.get("/grn/{grn_id}", response_model=schemas.GRNOut)
def get_grn(
    grn_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("grn:read")),
):
    return service.inventory_service.get_grn(db, grn_id)


@router.post("/grn", response_model=schemas.GRNOut)
def create_grn(
    grn: schemas.GRNCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(get_current_user),
):
    return service.inventory_service.create_grn(db, grn, current_user.id)


@router.patch("/grn/{grn_id}/status", response_model=schemas.GRNOut)
def update_grn_status(
    grn_id: int,
    payload: schemas.GRNStatusUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(get_current_user),
):
    return service.inventory_service.update_grn_status(db, grn_id, payload, current_user.id)
