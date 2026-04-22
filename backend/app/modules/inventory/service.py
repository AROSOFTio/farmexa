from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.inventory import StockItem, StockMovement, MovementType
from . import schemas

class InventoryService:
    def get_items(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(StockItem).offset(skip).limit(limit).all()

    def get_movements(self, db: Session, skip: int = 0, limit: int = 100):
        return (
            db.query(StockMovement)
            .order_by(StockMovement.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

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
            average_cost=item.initial_unit_cost
        )
        db.add(db_item)
        db.flush()

        if item.initial_quantity > 0:
            self.create_movement(db, schemas.StockMovementCreate(
                item_id=db_item.id,
                movement_type=MovementType.IN,
                quantity=item.initial_quantity,
                reference_type="initial_stock",
                unit_cost=item.initial_unit_cost,
                notes="Initial stock entry"
            ))

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
                # Update moving average cost
                total_value = (prev_qty * item.average_cost) + (movement.quantity * movement.unit_cost)
                item.average_cost = total_value / new_qty
        elif movement.movement_type == MovementType.OUT:
            if prev_qty < movement.quantity:
                raise HTTPException(status_code=400, detail="Insufficient stock")
            new_qty -= movement.quantity
        elif movement.movement_type == MovementType.ADJUSTMENT:
            # For adjustment, quantity is the difference (can be negative)
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
            notes=movement.notes
        )
        
        item.current_quantity = new_qty
        
        db.add(db_movement)
        db.commit()
        db.refresh(db_movement)
        return db_movement

inventory_service = InventoryService()
