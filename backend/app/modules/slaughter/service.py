from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.auth import AuditLog
from app.models.farm import Batch, BatchStatus
from app.models.inventory import MovementType, StockItem, StockMovement
from app.models.slaughter import (
    QualityInspectionStatus,
    SlaughterApprovalStatus,
    SlaughterByProduct,
    SlaughterOutput,
    SlaughterRecord,
    SlaughterStatus,
)
from app.core.money import quantize_money
from app.services.inventory_coordinator import InventoryCoordinator, ReferenceType

from . import schemas


class SlaughterService:
    @staticmethod
    def _tenant_id_for(user) -> int | None:
        role_name = user.role.name if getattr(user, "role", None) else None
        return None if role_name in {"super_manager", "developer_admin"} else user.tenant_id

    @staticmethod
    def _apply_metrics(record: SlaughterRecord) -> None:
        if record.live_birds_count > 0:
            record.average_live_weight = round(record.total_live_weight / record.live_birds_count, 4)
        else:
            record.average_live_weight = None

        if record.total_dressed_weight is not None and record.live_birds_count > 0:
            record.average_dressed_weight = round(record.total_dressed_weight / record.live_birds_count, 4)
        else:
            record.average_dressed_weight = None

        if record.total_dressed_weight is not None and record.total_live_weight > 0:
            record.yield_percentage = round((record.total_dressed_weight / record.total_live_weight) * 100, 2)
            loss_weight = max(record.total_live_weight - record.total_dressed_weight, 0)
            record.loss_percentage = round((loss_weight / record.total_live_weight) * 100, 2)
        else:
            record.yield_percentage = None
            record.loss_percentage = None

    @staticmethod
    def _write_audit(db: Session, *, user_id: int | None, action: str, entity_id: int, meta: str) -> None:
        db.add(
            AuditLog(
                user_id=user_id,
                action=action,
                entity="slaughter_record",
                entity_id=entity_id,
                meta=meta,
                created_at=datetime.now(timezone.utc),
            )
        )

    def get_records(self, db: Session, current_user, skip: int = 0, limit: int = 100):
        tenant_id = self._tenant_id_for(current_user)
        query = (
            db.query(SlaughterRecord)
            .options(joinedload(SlaughterRecord.outputs), joinedload(SlaughterRecord.byproducts), joinedload(SlaughterRecord.batch))
            .order_by(SlaughterRecord.slaughter_date.desc(), SlaughterRecord.created_at.desc())
        )
        if tenant_id is not None:
            query = query.filter(SlaughterRecord.tenant_id == tenant_id)
        return query.offset(skip).limit(limit).all()

    def create_record(self, db: Session, record: schemas.SlaughterRecordCreate, current_user):
        batch = db.query(Batch).filter(Batch.id == record.batch_id).first()
        if not batch:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch not found")

        if batch.active_quantity < record.live_birds_count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Slaughter quantity exceeds active birds in the selected batch",
            )

        payload = record.model_dump()
        db_record = SlaughterRecord(
            **payload,
            tenant_id=self._tenant_id_for(current_user),
            quality_inspection_status=QualityInspectionStatus(payload["quality_inspection_status"]),
            approval_status=SlaughterApprovalStatus.PENDING,
        )
        self._apply_metrics(db_record)
        db.add(db_record)
        db.flush()
        self._write_audit(
            db,
            user_id=current_user.id,
            action="CREATE",
            entity_id=db_record.id,
            meta=f"Created slaughter record for batch {record.batch_id}",
        )
        db.commit()
        return (
            db.query(SlaughterRecord)
            .options(joinedload(SlaughterRecord.outputs), joinedload(SlaughterRecord.byproducts), joinedload(SlaughterRecord.batch))
            .filter(SlaughterRecord.id == db_record.id)
            .first()
        )

    def update_record(self, db: Session, record_id: int, updates: schemas.SlaughterRecordUpdate, current_user):
        tenant_id = self._tenant_id_for(current_user)
        query = db.query(SlaughterRecord).filter(SlaughterRecord.id == record_id)
        if tenant_id is not None:
            query = query.filter(SlaughterRecord.tenant_id == tenant_id)
        db_record = query.first()
        if not db_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slaughter record not found")

        previous_status = db_record.status
        update_values = updates.model_dump(exclude_unset=True)

        if previous_status == SlaughterStatus.COMPLETED and update_values.get("status") not in (None, SlaughterStatus.COMPLETED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Completed slaughter records cannot be reopened or cancelled",
            )

        if "quality_inspection_status" in update_values and update_values["quality_inspection_status"] is not None:
            update_values["quality_inspection_status"] = QualityInspectionStatus(update_values["quality_inspection_status"])
        if "approval_status" in update_values and update_values["approval_status"] is not None:
            update_values["approval_status"] = SlaughterApprovalStatus(update_values["approval_status"])

        for key, value in update_values.items():
            setattr(db_record, key, value)

        if db_record.approval_status == SlaughterApprovalStatus.APPROVED:
            db_record.approved_at = datetime.now(timezone.utc)
            db_record.approved_by_user_id = current_user.id

        self._apply_metrics(db_record)

        # Do not post inventory movements here; handled atomically when outputs are posted

        self._write_audit(
            db,
            user_id=current_user.id,
            action="UPDATE",
            entity_id=db_record.id,
            meta=f"Updated slaughter record status={db_record.status.value} approval={db_record.approval_status.value}",
        )
        db.commit()
        return (
            db.query(SlaughterRecord)
            .options(joinedload(SlaughterRecord.outputs), joinedload(SlaughterRecord.byproducts), joinedload(SlaughterRecord.batch))
            .filter(SlaughterRecord.id == db_record.id)
            .first()
        )

    def add_output(self, db: Session, record_id: int, output: schemas.SlaughterOutputCreate, current_user):
        tenant_id = self._tenant_id_for(current_user)
        query = db.query(SlaughterRecord).filter(SlaughterRecord.id == record_id)
        if tenant_id is not None:
            query = query.filter(SlaughterRecord.tenant_id == tenant_id)
        db_record = query.first()
        if not db_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slaughter record not found")
        if db_record.status != SlaughterStatus.COMPLETED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Outputs can only be posted after the record is completed.")
        if db_record.approval_status != SlaughterApprovalStatus.APPROVED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Outputs can only be posted after processing is approved.")
        if db_record.status == SlaughterStatus.CANCELLED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add outputs to a cancelled record")

        item = db.query(StockItem).filter(StockItem.id == output.stock_item_id).first()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock item not found")

        # If this is the first output posting, atomically post input movement and reduce batch
        batch = db.query(Batch).filter(Batch.id == db_record.batch_id).first()
        if not batch:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch not found")
        if db_record.inventory_posted_at is None:
            if not batch.stock_item_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch not linked to inventory; cannot complete slaughter.")
            if batch.active_quantity < db_record.live_birds_count:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Batch active quantity is lower than the slaughtered bird count")

            coordinator0 = InventoryCoordinator(db)
            try:
                coordinator0.record_out(
                    item_id=batch.stock_item_id,
                    quantity=float(db_record.live_birds_count),
                    reference_type=ReferenceType.SLAUGHTER_INPUT.value,
                    reference_id=db_record.id,
                    notes=f"Slaughter input: {db_record.live_birds_count} birds from batch {batch.batch_number}",
                )
            except HTTPException as e:
                db.rollback()
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot record slaughter input: {e.detail}")

            batch.active_quantity -= db_record.live_birds_count
            if batch.active_quantity == 0:
                batch.status = BatchStatus.SLAUGHTERED

        coordinator = InventoryCoordinator(db)
        
        try:
            coordinator.record_in(
                item_id=item.id,
                quantity=float(output.quantity),
                reference_type=ReferenceType.SLAUGHTER_OUTPUT.value,
                reference_id=record_id,
                unit_cost=output.unit_cost,
                notes=f"Slaughter output from record {record_id} ({output.output_type})",
            )
        except HTTPException as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot record stock movement for slaughter output: {e.detail}"
            )

        total_cost = quantize_money(output.quantity * output.unit_cost) if output.unit_cost is not None else None
        db_output = SlaughterOutput(
            tenant_id=tenant_id,
            slaughter_record_id=record_id,
            stock_item_id=output.stock_item_id,
            output_type=output.output_type,
            quantity=output.quantity,
            unit_cost=output.unit_cost,
            total_cost=total_cost,
        )
        db.add(db_output)

        if db_record.inventory_posted_at is None:
            db_record.inventory_posted_at = datetime.now(timezone.utc)
        self._write_audit(
            db,
            user_id=current_user.id,
            action="UPDATE",
            entity_id=db_record.id,
            meta=f"Posted slaughter output type={output.output_type} quantity={output.quantity}",
        )
        db.commit()
        db.refresh(db_output)
        return db_output

    def get_byproducts(self, db: Session, record_id: int, current_user):
        tenant_id = self._tenant_id_for(current_user)
        query = db.query(SlaughterByProduct).filter(SlaughterByProduct.slaughter_record_id == record_id)
        return query.all()

    def add_byproduct(self, db: Session, record_id: int, byproduct: schemas.SlaughterByProductCreate, current_user):
        tenant_id = self._tenant_id_for(current_user)
        query = db.query(SlaughterRecord).filter(SlaughterRecord.id == record_id)
        if tenant_id is not None:
            query = query.filter(SlaughterRecord.tenant_id == tenant_id)
        db_record = query.first()
        if not db_record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slaughter record not found")
        if db_record.status != SlaughterStatus.COMPLETED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Byproducts can only be added after the record is completed.")
        if db_record.approval_status != SlaughterApprovalStatus.APPROVED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Byproducts can only be added after processing is approved.")

        # If stock_item_id is provided, validate and record stock movement
        if byproduct.stock_item_id:
            item = db.query(StockItem).filter(StockItem.id == byproduct.stock_item_id).first()
            if not item:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock item not found")

            coordinator = InventoryCoordinator(db)
            try:
                coordinator.record_in(
                    item_id=item.id,
                    quantity=float(byproduct.quantity_weight),
                    reference_type=ReferenceType.SLAUGHTER_BYPRODUCT.value,
                    reference_id=record_id,
                    unit_cost=byproduct.unit_cost,
                    notes=f"Slaughter byproduct: {byproduct.byproduct_name} from record {record_id}",
                )
            except HTTPException as e:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot record stock movement for byproduct: {e.detail}"
                )

        total_value = quantize_money(byproduct.quantity_weight * byproduct.unit_cost) if byproduct.unit_cost is not None else byproduct.value
        db_byproduct = SlaughterByProduct(
            slaughter_record_id=record_id,
            stock_item_id=byproduct.stock_item_id,
            store_location_id=byproduct.store_location_id,
            byproduct_name=byproduct.byproduct_name,
            quantity_weight=byproduct.quantity_weight,
            unit=byproduct.unit,
            value=byproduct.value,
            unit_cost=byproduct.unit_cost,
            total_value=total_value,
            notes=byproduct.notes,
        )
        db.add(db_byproduct)
        self._write_audit(
            db,
            user_id=current_user.id,
            action="UPDATE",
            entity_id=record_id,
            meta=f"Added slaughter byproduct {byproduct.byproduct_name} quantity={byproduct.quantity_weight}",
        )
        db.commit()
        db.refresh(db_byproduct)
        return db_byproduct

    def update_byproduct(self, db: Session, byproduct_id: int, updates: schemas.SlaughterByProductUpdate, current_user):
        db_byproduct = db.query(SlaughterByProduct).filter(SlaughterByProduct.id == byproduct_id).first()
        if not db_byproduct:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Byproduct not found")

        # Check if stock_item_id is being changed - this would require complex stock adjustment
        # For now, only allow updating quantity if no stock movement has been recorded
        if updates.stock_item_id is not None and updates.stock_item_id != db_byproduct.stock_item_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change stock item after creation. Create a new byproduct record instead."
            )

        update_values = updates.model_dump(exclude_unset=True, exclude_none=True)

        # If quantity is being updated and stock_item_id exists, handle stock adjustment
        if "quantity_weight" in update_values and db_byproduct.stock_item_id:
            old_quantity = db_byproduct.quantity_weight
            new_quantity = update_values["quantity_weight"]
            delta = new_quantity - old_quantity

            if delta != 0:
                item = db.query(StockItem).filter(StockItem.id == db_byproduct.stock_item_id).first()
                if not item:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock item not found")

                coordinator = InventoryCoordinator(db)
                try:
                    if delta > 0:
                        coordinator.record_in(
                            item_id=item.id,
                            quantity=float(delta),
                            reference_type=ReferenceType.SLAUGHTER_BYPRODUCT_ADJUSTMENT.value,
                            reference_id=db_byproduct.id,
                            unit_cost=updates.unit_cost,
                            notes=f"Byproduct quantity adjustment: {db_byproduct.byproduct_name}",
                        )
                    else:
                        coordinator.record_out(
                            item_id=item.id,
                            quantity=float(abs(delta)),
                            reference_type=ReferenceType.SLAUGHTER_BYPRODUCT_ADJUSTMENT.value,
                            reference_id=db_byproduct.id,
                            notes=f"Byproduct quantity reduction: {db_byproduct.byproduct_name}",
                        )
                except HTTPException as e:
                    db.rollback()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot adjust stock for byproduct: {e.detail}"
                    )

        if "unit_cost" in update_values:
            update_values["total_value"] = quantize_money(
                update_values["quantity_weight"] * update_values["unit_cost"]
                if "quantity_weight" in update_values
                else db_byproduct.quantity_weight * update_values["unit_cost"]
            )

        for key, value in update_values.items():
            setattr(db_byproduct, key, value)

        self._write_audit(
            db,
            user_id=current_user.id,
            action="UPDATE",
            entity_id=db_byproduct.id,
            meta=f"Updated slaughter byproduct {db_byproduct.byproduct_name}",
        )
        db.commit()
        db.refresh(db_byproduct)
        return db_byproduct

    def delete_byproduct(self, db: Session, byproduct_id: int, current_user):
        db_byproduct = db.query(SlaughterByProduct).filter(SlaughterByProduct.id == byproduct_id).first()
        if not db_byproduct:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Byproduct not found")

        # Note: We don't reverse stock movement on deletion for audit trail purposes
        # Stock adjustments should be done via manual adjustment if needed
        db.delete(db_byproduct)
        self._write_audit(
            db,
            user_id=current_user.id,
            action="DELETE",
            entity_id=byproduct_id,
            meta=f"Deleted slaughter byproduct {db_byproduct.byproduct_name}",
        )
        db.commit()
        return {"message": "Byproduct deleted successfully"}


slaughter_service = SlaughterService()
