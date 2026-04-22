from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.slaughter import SlaughterRecord, SlaughterOutput, SlaughterStatus
from app.models.inventory import StockItem, StockMovement, MovementType
from . import schemas

class SlaughterService:
    def get_records(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(SlaughterRecord).offset(skip).limit(limit).all()

    def create_record(self, db: Session, record: schemas.SlaughterRecordCreate):
        db_record = SlaughterRecord(**record.model_dump())
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        return db_record

    def update_record(self, db: Session, record_id: int, updates: schemas.SlaughterRecordUpdate):
        db_record = db.query(SlaughterRecord).filter(SlaughterRecord.id == record_id).first()
        if not db_record:
            raise HTTPException(status_code=404, detail="Slaughter record not found")

        for k, v in updates.model_dump(exclude_unset=True).items():
            setattr(db_record, k, v)
        
        if db_record.total_dressed_weight and db_record.total_live_weight > 0:
            db_record.yield_percentage = (db_record.total_dressed_weight / db_record.total_live_weight) * 100

        db.commit()
        db.refresh(db_record)
        return db_record

    def add_output(self, db: Session, record_id: int, output: schemas.SlaughterOutputCreate):
        db_record = db.query(SlaughterRecord).filter(SlaughterRecord.id == record_id).first()
        if not db_record:
            raise HTTPException(status_code=404, detail="Record not found")
        
        item = db.query(StockItem).filter(StockItem.id == output.stock_item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Stock item not found")

        total_cost = (output.quantity * output.unit_cost) if output.unit_cost else 0.0

        db_output = SlaughterOutput(
            slaughter_record_id=record_id,
            stock_item_id=output.stock_item_id,
            quantity=output.quantity,
            unit_cost=output.unit_cost,
            total_cost=total_cost
        )
        db.add(db_output)

        # Update inventory
        prev_qty = item.current_quantity
        new_qty = prev_qty + output.quantity
        
        if new_qty > 0 and output.unit_cost is not None:
            total_value = (prev_qty * item.average_cost) + total_cost
            item.average_cost = total_value / new_qty
            
        item.current_quantity = new_qty

        movement = StockMovement(
            item_id=item.id,
            movement_type=MovementType.IN,
            quantity=output.quantity,
            previous_quantity=prev_qty,
            new_quantity=new_qty,
            reference_type="slaughter_output",
            reference_id=record_id,
            unit_cost=output.unit_cost,
            notes=f"Slaughter output from record {record_id}"
        )
        db.add(movement)

        db.commit()
        db.refresh(db_output)
        return db_output

slaughter_service = SlaughterService()
