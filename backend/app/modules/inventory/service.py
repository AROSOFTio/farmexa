from datetime import datetime, timezone
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.inventory import MovementType, StockCategory, StockItem, StockMovement, StockTransfer, TransferStatus

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
            self.create_movement(
                db,
                schemas.StockMovementCreate(
                    item_id=db_item.id,
                    movement_type=MovementType.IN,
                    quantity=item.initial_quantity,
                    reference_type="initial_stock",
                    unit_cost=item.initial_unit_cost,
                    notes="Initial stock entry",
                ),
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
        item = db.query(StockItem).filter(StockItem.id == movement.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Stock item not found")

        prev_qty = item.current_quantity
        new_qty = prev_qty

        if movement.movement_type == MovementType.IN:
            new_qty += movement.quantity
            if new_qty > 0 and movement.unit_cost is not None:
                total_value = (prev_qty * item.average_cost) + (movement.quantity * movement.unit_cost)
                item.average_cost = total_value / new_qty
        elif movement.movement_type == MovementType.OUT:
            if prev_qty < movement.quantity:
                raise HTTPException(status_code=400, detail="Insufficient stock")
            new_qty -= movement.quantity
        elif movement.movement_type == MovementType.ADJUSTMENT:
            new_qty += movement.quantity
            if new_qty < 0:
                raise HTTPException(status_code=400, detail="Adjustment results in negative stock")

        db_movement = StockMovement(
            item_id=item.id,
            movement_type=movement.movement_type,
            quantity=abs(movement.quantity),
            previous_quantity=prev_qty,
            new_quantity=new_qty,
            reference_type=movement.reference_type,
            reference_id=movement.reference_id,
            unit_cost=movement.unit_cost or item.average_cost,
            notes=movement.notes,
        )

        item.current_quantity = new_qty

        db.add(db_movement)
        db.commit()
        db.refresh(db_movement)
        return db_movement

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
            self.create_movement(
                db,
                schemas.StockMovementCreate(
                    item_id=transfer.item_id,
                    movement_type=MovementType.OUT,
                    quantity=transfer.quantity,
                    reference_type="GIV",
                    reference_id=transfer.id,
                    unit_cost=item.average_cost,
                    notes=f"{transfer.reference_number}: {transfer.from_location} to {transfer.to_location}",
                ),
            )
            transfer.status = TransferStatus.ISSUED
            transfer.issued_at = now
        elif payload.status == TransferStatus.RECEIVED:
            if transfer.status != TransferStatus.ISSUED:
                raise HTTPException(status_code=409, detail="Only issued transfers can be received")
            self.create_movement(
                db,
                schemas.StockMovementCreate(
                    item_id=transfer.item_id,
                    movement_type=MovementType.IN,
                    quantity=transfer.quantity,
                    reference_type="GRN",
                    reference_id=transfer.id,
                    unit_cost=item.average_cost,
                    notes=f"{transfer.reference_number}: received at {transfer.to_location}",
                ),
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


inventory_service = InventoryService()
