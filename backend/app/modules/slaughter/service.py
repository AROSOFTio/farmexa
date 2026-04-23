from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.farm import Batch, BatchStatus
from app.models.inventory import MovementType, StockItem, StockMovement
from app.models.slaughter import SlaughterOutput, SlaughterRecord, SlaughterStatus

from . import schemas


class SlaughterService:
    def get_records(self, db: Session, skip: int = 0, limit: int = 100):
        return (
            db.query(SlaughterRecord)
            .options(joinedload(SlaughterRecord.outputs))
            .order_by(SlaughterRecord.slaughter_date.desc(), SlaughterRecord.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_record(self, db: Session, record: schemas.SlaughterRecordCreate):
        batch = db.query(Batch).filter(Batch.id == record.batch_id).first()
        if not batch:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch not found")

        if batch.active_quantity < record.live_birds_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slaughter quantity exceeds active birds in the selected batch",
            )

        db_record = SlaughterRecord(**record.model_dump())
        db.add(db_record)
        db.commit()
        return (
            db.query(SlaughterRecord)
            .options(joinedload(SlaughterRecord.outputs))
            .filter(SlaughterRecord.id == db_record.id)
            .first()
        )

    def update_record(self, db: Session, record_id: int, updates: schemas.SlaughterRecordUpdate):
        db_record = db.query(SlaughterRecord).filter(SlaughterRecord.id == record_id).first()
        if not db_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slaughter record not found")

        previous_status = db_record.status
        update_values = updates.model_dump(exclude_unset=True)

        if previous_status == SlaughterStatus.COMPLETED and update_values.get("status") not in (None, SlaughterStatus.COMPLETED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Completed slaughter records cannot be reopened or cancelled",
            )

        for key, value in update_values.items():
            setattr(db_record, key, value)

        if db_record.total_dressed_weight is not None and db_record.total_live_weight > 0:
            db_record.yield_percentage = (db_record.total_dressed_weight / db_record.total_live_weight) * 100

        if db_record.status == SlaughterStatus.COMPLETED and previous_status != SlaughterStatus.COMPLETED:
            batch = db.query(Batch).filter(Batch.id == db_record.batch_id).first()
            if not batch:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch not found")
            if batch.active_quantity < db_record.live_birds_count:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Batch active quantity is lower than the slaughtered bird count",
                )
            batch.active_quantity -= db_record.live_birds_count
            if batch.active_quantity == 0:
                batch.status = BatchStatus.SLAUGHTERED

        db.commit()
        return (
            db.query(SlaughterRecord)
            .options(joinedload(SlaughterRecord.outputs))
            .filter(SlaughterRecord.id == db_record.id)
            .first()
        )

    def add_output(self, db: Session, record_id: int, output: schemas.SlaughterOutputCreate):
        db_record = db.query(SlaughterRecord).filter(SlaughterRecord.id == record_id).first()
        if not db_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slaughter record not found")
        if db_record.status == SlaughterStatus.CANCELLED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add outputs to a cancelled record")

        item = db.query(StockItem).filter(StockItem.id == output.stock_item_id).first()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock item not found")

        total_cost = output.quantity * output.unit_cost if output.unit_cost is not None else None
        db_output = SlaughterOutput(
            slaughter_record_id=record_id,
            stock_item_id=output.stock_item_id,
            quantity=output.quantity,
            unit_cost=output.unit_cost,
            total_cost=total_cost,
        )
        db.add(db_output)

        previous_quantity = item.current_quantity
        item.current_quantity = previous_quantity + output.quantity

        if output.unit_cost is not None and item.current_quantity > 0:
            carried_value = previous_quantity * item.average_cost
            received_value = output.quantity * output.unit_cost
            item.average_cost = (carried_value + received_value) / item.current_quantity

        db.add(
            StockMovement(
                item_id=item.id,
                movement_type=MovementType.IN,
                quantity=output.quantity,
                previous_quantity=previous_quantity,
                new_quantity=item.current_quantity,
                reference_type="slaughter_output",
                reference_id=record_id,
                unit_cost=output.unit_cost,
                notes=f"Slaughter output from record {record_id}",
            )
        )

        db.commit()
        db.refresh(db_output)
        return db_output


slaughter_service = SlaughterService()
