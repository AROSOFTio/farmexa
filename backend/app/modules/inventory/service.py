from datetime import datetime, timezone
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.inventory import (
    MovementType, StockCategory, StockItem, StockMovement, StockTransfer, TransferStatus,
    StoreLocation, GoodsIssueVoucher, GoodsReceivedNote, GIVStatus, GRNStatus
)
from app.services.inventory_coordinator import InventoryCoordinator, ReferenceType

from . import schemas


class InventoryService:
    def get_items(self, db: Session, skip: int = 0, limit: int = 100, category: StockCategory | None = None):
        query = db.query(StockItem)
        if category is not None:
            query = query.filter(StockItem.category == category)
        return query.offset(skip).limit(limit).all()

    def get_movements(self, db: Session, skip: int = 0, limit: int = 100, category: StockCategory | None = None):
        query = db.query(StockMovement)
        if category is not None:
            query = query.join(StockItem, StockItem.id == StockMovement.item_id).filter(StockItem.category == category)
        return query.order_by(StockMovement.created_at.desc()).offset(skip).limit(limit).all()

    def get_item(self, db: Session, item_id: int):
        return db.query(StockItem).filter(StockItem.id == item_id).first()

    def create_item(self, db: Session, item: schemas.StockItemCreate):
        db_item = StockItem(
            name=item.name,
            sku=item.sku,
            category=item.category,
            unit_of_measure=item.unit_of_measure,
            reorder_level=item.reorder_level,
            unit_price=item.unit_price,
            description=item.description,
            is_active=item.is_active,
            current_quantity=0.0,
            average_cost=item.initial_unit_cost,
        )
        db.add(db_item)
        db.flush()

        if item.initial_quantity > 0:
            coordinator = InventoryCoordinator(db)
            coordinator.record_in(
                item_id=db_item.id,
                quantity=item.initial_quantity,
                reference_type=ReferenceType.INITIAL_STOCK.value,
                reference_id=db_item.id,
                unit_cost=item.initial_unit_cost,
                notes="Initial stock entry",
            )

        db.commit()
        db.refresh(db_item)
        return db_item

    def update_item(self, db: Session, item_id: int, item: schemas.StockItemUpdate):
        db_item = db.query(StockItem).filter(StockItem.id == item_id).first()
        if not db_item:
            raise HTTPException(status_code=404, detail="Stock item not found")

        updates = item.model_dump(exclude_none=True)
        for field, value in updates.items():
            setattr(db_item, field, value)

        db.commit()
        db.refresh(db_item)
        return db_item

    def create_movement(self, db: Session, movement: schemas.StockMovementCreate):
        coordinator = InventoryCoordinator(db)
        try:
            if movement.movement_type == MovementType.IN:
                db_movement = coordinator.record_in(
                    item_id=movement.item_id,
                    quantity=movement.quantity,
                    reference_type=movement.reference_type,
                    reference_id=movement.reference_id,
                    unit_cost=movement.unit_cost,
                    notes=movement.notes,
                )
            elif movement.movement_type == MovementType.OUT:
                db_movement = coordinator.record_out(
                    item_id=movement.item_id,
                    quantity=movement.quantity,
                    reference_type=movement.reference_type,
                    reference_id=movement.reference_id,
                    notes=movement.notes,
                )
            else:
                db_movement = coordinator.record_adjustment(
                    item_id=movement.item_id,
                    quantity=movement.quantity,
                    reference_type=movement.reference_type,
                    reference_id=movement.reference_id,
                    notes=movement.notes,
                )
            db.commit()
            db.refresh(db_movement)
            return db_movement
        except HTTPException:
            db.rollback()
            raise
        except Exception:
            db.rollback()
            raise

    def get_transfers(self, db: Session, skip: int = 0, limit: int = 100, status_filter: TransferStatus | None = None):
        query = db.query(StockTransfer)
        if status_filter is not None:
            query = query.filter(StockTransfer.status == status_filter)
        return query.order_by(StockTransfer.created_at.desc()).offset(skip).limit(limit).all()

    def create_transfer(self, db: Session, transfer: schemas.StockTransferCreate):
        item = db.query(StockItem).filter(StockItem.id == transfer.item_id, StockItem.is_active.is_(True)).first()
        if not item:
            raise HTTPException(status_code=404, detail="Stock item not found")
        if transfer.quantity <= 0:
            raise HTTPException(status_code=422, detail="Transfer quantity must be greater than zero")

        db_transfer = StockTransfer(
            reference_number=f"{transfer.transfer_type.value.upper()}-{uuid.uuid4().hex[:8].upper()}",
            transfer_type=transfer.transfer_type,
            item_id=transfer.item_id,
            quantity=transfer.quantity,
            unit=transfer.unit,
            from_location=transfer.from_location,
            to_location=transfer.to_location,
            status=TransferStatus.DRAFT,
            notes=transfer.notes,
        )
        db.add(db_transfer)
        db.commit()
        db.refresh(db_transfer)

        if transfer.status == TransferStatus.ISSUED:
            return self.update_transfer_status(db, db_transfer.id, schemas.StockTransferStatusUpdate(status=TransferStatus.ISSUED))
        return db_transfer

    def update_transfer_status(self, db: Session, transfer_id: int, payload: schemas.StockTransferStatusUpdate):
        transfer = db.query(StockTransfer).filter(StockTransfer.id == transfer_id).first()
        if not transfer:
            raise HTTPException(status_code=404, detail="Transfer not found")
        item = db.query(StockItem).filter(StockItem.id == transfer.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Transfer stock item not found")

        if transfer.status == payload.status:
            return transfer
        if transfer.status == TransferStatus.CANCELLED:
            raise HTTPException(status_code=409, detail="Cancelled transfers cannot be changed")
        if transfer.status == TransferStatus.RECEIVED:
            raise HTTPException(status_code=409, detail="Received transfers cannot be changed")

        now = datetime.now(timezone.utc)
        if payload.status == TransferStatus.ISSUED:
            if transfer.status != TransferStatus.DRAFT:
                raise HTTPException(status_code=409, detail="Only draft transfers can be issued")
            coordinator = InventoryCoordinator(db)
            coordinator.record_out(
                item_id=transfer.item_id,
                quantity=transfer.quantity,
                reference_type=ReferenceType.STOCK_TRANSFER.value,
                reference_id=transfer.id,
                notes=f"{transfer.reference_number}: {transfer.from_location} to {transfer.to_location}",
            )
            transfer.status = TransferStatus.ISSUED
            transfer.issued_at = now
        elif payload.status == TransferStatus.RECEIVED:
            if transfer.status != TransferStatus.ISSUED:
                raise HTTPException(status_code=409, detail="Only issued transfers can be received")
            coordinator = InventoryCoordinator(db)
            coordinator.record_in(
                item_id=transfer.item_id,
                quantity=transfer.quantity,
                reference_type=ReferenceType.STOCK_TRANSFER.value,
                reference_id=transfer.id,
                unit_cost=item.average_cost,
                notes=f"{transfer.reference_number}: received at {transfer.to_location}",
            )
            transfer.status = TransferStatus.RECEIVED
            transfer.received_at = now
        elif payload.status == TransferStatus.CANCELLED:
            if transfer.status != TransferStatus.DRAFT:
                raise HTTPException(status_code=409, detail="Only draft transfers can be cancelled")
            transfer.status = TransferStatus.CANCELLED
        elif payload.status == TransferStatus.DRAFT:
            raise HTTPException(status_code=409, detail="Transfers cannot be moved back to draft")

        db.commit()
        db.refresh(transfer)
        return transfer

    def reconcile_item(self, db: Session, item_id: int) -> dict:
        from sqlalchemy import func, case
        item = db.query(StockItem).filter(StockItem.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Stock item not found")

        net = db.query(
            func.sum(
                case(
                    (StockMovement.movement_type == MovementType.IN, StockMovement.quantity),
                    (StockMovement.movement_type == MovementType.OUT, -StockMovement.quantity),
                    (StockMovement.movement_type == MovementType.ADJUSTMENT, StockMovement.quantity),
                    else_=0,
                )
            )
        ).filter(StockMovement.item_id == item_id).scalar() or 0.0

        calculated = float(net)
        difference = float(item.current_quantity) - calculated
        return {
            "item_id": item.id,
            "item_name": item.name,
            "actual_quantity": float(item.current_quantity),
            "calculated_quantity": calculated,
            "difference": difference,
            "is_reconciled": abs(difference) < 0.01,
        }

    # StoreLocation CRUD methods
    def get_store_locations(self, db: Session, skip: int = 0, limit: int = 100, active_only: bool = False):
        query = db.query(StoreLocation)
        if active_only:
            query = query.filter(StoreLocation.is_active.is_(True))
        return query.order_by(StoreLocation.name).offset(skip).limit(limit).all()

    def get_store_location(self, db: Session, location_id: int):
        return db.query(StoreLocation).filter(StoreLocation.id == location_id).first()

    def create_store_location(self, db: Session, location: schemas.StoreLocationCreate):
        # Check for duplicate name or code
        existing = db.query(StoreLocation).filter(
            (StoreLocation.name == location.name) | (StoreLocation.code == location.code)
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Store location with this name or code already exists")

        db_location = StoreLocation(**location.model_dump())
        db.add(db_location)
        db.commit()
        db.refresh(db_location)
        return db_location

    def update_store_location(self, db: Session, location_id: int, location: schemas.StoreLocationUpdate):
        db_location = db.query(StoreLocation).filter(StoreLocation.id == location_id).first()
        if not db_location:
            raise HTTPException(status_code=404, detail="Store location not found")

        updates = location.model_dump(exclude_none=True)
        for field, value in updates.items():
            setattr(db_location, field, value)

        db.commit()
        db.refresh(db_location)
        return db_location

    def delete_store_location(self, db: Session, location_id: int):
        db_location = db.query(StoreLocation).filter(StoreLocation.id == location_id).first()
        if not db_location:
            raise HTTPException(status_code=404, detail="Store location not found")

        # Check if location is referenced by GIV or GRN
        giv_ref = db.query(GoodsIssueVoucher).filter(GoodsIssueVoucher.from_store_location_id == location_id).first()
        grn_ref = db.query(GoodsReceivedNote).filter(GoodsReceivedNote.received_into_store_location_id == location_id).first()
        if giv_ref or grn_ref:
            raise HTTPException(status_code=409, detail="Cannot delete store location referenced by documents")

        db.delete(db_location)
        db.commit()
        return {"message": "Store location deleted successfully"}

    # GIV workflow methods
    def get_givs(self, db: Session, skip: int = 0, limit: int = 100, status_filter: GIVStatus | None = None):
        query = db.query(GoodsIssueVoucher)
        if status_filter is not None:
            query = query.filter(GoodsIssueVoucher.status == status_filter)
        return query.order_by(GoodsIssueVoucher.created_at.desc()).offset(skip).limit(limit).all()

    def get_giv(self, db: Session, giv_id: int):
        return db.query(GoodsIssueVoucher).filter(GoodsIssueVoucher.id == giv_id).first()

    def create_giv(self, db: Session, giv: schemas.GIVCreate, user_id: int):
        # Validate item exists
        item = db.query(StockItem).filter(StockItem.id == giv.item_id, StockItem.is_active.is_(True)).first()
        if not item:
            raise HTTPException(status_code=404, detail="Stock item not found")

        # Validate store location exists
        location = db.query(StoreLocation).filter(StoreLocation.id == giv.from_store_location_id, StoreLocation.is_active.is_(True)).first()
        if not location:
            raise HTTPException(status_code=404, detail="Store location not found")

        if giv.quantity <= 0:
            raise HTTPException(status_code=422, detail="Quantity must be greater than zero")

        # Generate GIV number
        giv_number = f"GIV-{uuid.uuid4().hex[:8].upper()}"

        db_giv = GoodsIssueVoucher(
            giv_number=giv_number,
            item_id=giv.item_id,
            quantity=giv.quantity,
            unit=giv.unit,
            from_store_location_id=giv.from_store_location_id,
            destination=giv.destination,
            purpose=giv.purpose,
            notes=giv.notes,
            status=GIVStatus.DRAFT,
            issued_by_id=user_id,
        )
        db.add(db_giv)
        db.commit()
        db.refresh(db_giv)
        return db_giv

    def update_giv_status(self, db: Session, giv_id: int, payload: schemas.GIVStatusUpdate, user_id: int):
        giv = db.query(GoodsIssueVoucher).filter(GoodsIssueVoucher.id == giv_id).first()
        if not giv:
            raise HTTPException(status_code=404, detail="Goods Issue Voucher not found")

        if giv.status == payload.status:
            return giv
        if giv.status == GIVStatus.CANCELLED:
            raise HTTPException(status_code=409, detail="Cancelled GIV cannot be changed")
        if giv.status == GIVStatus.ISSUED:
            raise HTTPException(status_code=409, detail="Issued GIV cannot be changed")

        now = datetime.now(timezone.utc)

        if payload.status == GIVStatus.APPROVED:
            if giv.status != GIVStatus.DRAFT:
                raise HTTPException(status_code=409, detail="Only draft GIV can be approved")
            giv.status = GIVStatus.APPROVED
            giv.approved_by_id = user_id
        elif payload.status == GIVStatus.ISSUED:
            if giv.status != GIVStatus.APPROVED:
                raise HTTPException(status_code=409, detail="Only approved GIV can be issued")
            # Record stock movement
            coordinator = InventoryCoordinator(db)
            coordinator.record_out(
                item_id=giv.item_id,
                quantity=giv.quantity,
                reference_type=ReferenceType.GIV_ISSUE.value,
                reference_id=giv.id,
                notes=f"{giv.giv_number}: {giv.destination or 'Issue'} from {giv.from_store_location.code}",
                location_id=giv.from_store_location_id,
            )
            giv.status = GIVStatus.ISSUED
            giv.issued_at = now
        elif payload.status == GIVStatus.CANCELLED:
            if giv.status not in [GIVStatus.DRAFT, GIVStatus.APPROVED]:
                raise HTTPException(status_code=409, detail="Only draft or approved GIV can be cancelled")
            giv.status = GIVStatus.CANCELLED
        elif payload.status == GIVStatus.DRAFT:
            raise HTTPException(status_code=409, detail="GIV cannot be moved back to draft")

        db.commit()
        db.refresh(giv)
        return giv

    # GRN workflow methods
    def get_grns(self, db: Session, skip: int = 0, limit: int = 100, status_filter: GRNStatus | None = None):
        query = db.query(GoodsReceivedNote)
        if status_filter is not None:
            query = query.filter(GoodsReceivedNote.status == status_filter)
        return query.order_by(GoodsReceivedNote.created_at.desc()).offset(skip).limit(limit).all()

    def get_grn(self, db: Session, grn_id: int):
        return db.query(GoodsReceivedNote).filter(GoodsReceivedNote.id == grn_id).first()

    def create_grn(self, db: Session, grn: schemas.GRNCreate, user_id: int):
        # Validate item exists
        item = db.query(StockItem).filter(StockItem.id == grn.item_id, StockItem.is_active.is_(True)).first()
        if not item:
            raise HTTPException(status_code=404, detail="Stock item not found")

        # Validate store location exists
        location = db.query(StoreLocation).filter(StoreLocation.id == grn.received_into_store_location_id, StoreLocation.is_active.is_(True)).first()
        if not location:
            raise HTTPException(status_code=404, detail="Store location not found")

        if grn.quantity <= 0:
            raise HTTPException(status_code=422, detail="Quantity must be greater than zero")

        # Generate GRN number
        grn_number = f"GRN-{uuid.uuid4().hex[:8].upper()}"

        db_grn = GoodsReceivedNote(
            grn_number=grn_number,
            item_id=grn.item_id,
            quantity=grn.quantity,
            unit=grn.unit,
            received_into_store_location_id=grn.received_into_store_location_id,
            source_type=grn.source_type,
            supplier_reference=grn.supplier_reference,
            unit_cost=grn.unit_cost,
            notes=grn.notes,
            status=GRNStatus.DRAFT,
            received_by_id=user_id,
        )
        db.add(db_grn)
        db.commit()
        db.refresh(db_grn)
        return db_grn

    def update_grn_status(self, db: Session, grn_id: int, payload: schemas.GRNStatusUpdate, user_id: int):
        grn = db.query(GoodsReceivedNote).filter(GoodsReceivedNote.id == grn_id).first()
        if not grn:
            raise HTTPException(status_code=404, detail="Goods Received Note not found")

        if grn.status == payload.status:
            return grn
        if grn.status == GRNStatus.CANCELLED:
            raise HTTPException(status_code=409, detail="Cancelled GRN cannot be changed")
        if grn.status == GRNStatus.RECEIVED:
            raise HTTPException(status_code=409, detail="Received GRN cannot be changed")

        now = datetime.now(timezone.utc)

        if payload.status == GRNStatus.APPROVED:
            if grn.status != GRNStatus.DRAFT:
                raise HTTPException(status_code=409, detail="Only draft GRN can be approved")
            grn.status = GRNStatus.APPROVED
            grn.approved_by_id = user_id
        elif payload.status == GRNStatus.RECEIVED:
            if grn.status != GRNStatus.APPROVED:
                raise HTTPException(status_code=409, detail="Only approved GRN can be received")
            # Record stock movement
            coordinator = InventoryCoordinator(db)
            coordinator.record_in(
                item_id=grn.item_id,
                quantity=grn.quantity,
                reference_type=ReferenceType.GRN_RECEIPT.value,
                reference_id=grn.id,
                unit_cost=grn.unit_cost,
                notes=f"{grn.grn_number}: {grn.source_type} into {grn.received_into_store_location.code}",
                location_id=grn.received_into_store_location_id,
            )
            grn.status = GRNStatus.RECEIVED
            grn.received_at = now
        elif payload.status == GRNStatus.CANCELLED:
            if grn.status not in [GRNStatus.DRAFT, GRNStatus.APPROVED]:
                raise HTTPException(status_code=409, detail="Only draft or approved GRN can be cancelled")
            grn.status = GRNStatus.CANCELLED
        elif payload.status == GRNStatus.DRAFT:
            raise HTTPException(status_code=409, detail="GRN cannot be moved back to draft")

        db.commit()
        db.refresh(grn)
        return grn


inventory_service = InventoryService()
