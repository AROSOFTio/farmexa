import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError

from app.models.branch_transfer import BranchTransfer, BranchTransferItem, TransferStatus
from app.models.inventory import StockItem, StockMovement, MovementType
from app.modules.inventory import branch_transfer_schemas as schemas

logger = logging.getLogger(__name__)


def get_transfers(db: Session, skip: int = 0, limit: int = 100, tenant_id: int = None) -> List[BranchTransfer]:
    query = db.query(BranchTransfer)
    if tenant_id:
        query = query.filter(BranchTransfer.tenant_id == tenant_id)
    return query.order_by(BranchTransfer.transfer_date.desc()).offset(skip).limit(limit).all()


def get_transfer(db: Session, transfer_id: int) -> Optional[BranchTransfer]:
    return db.query(BranchTransfer).filter(BranchTransfer.id == transfer_id).first()


def generate_transfer_number(db: Session, tenant_id: int) -> str:
    count = db.query(BranchTransfer).filter(BranchTransfer.tenant_id == tenant_id).count()
    return f"TRF-{tenant_id}-{count + 1:04d}"


def create_transfer(db: Session, transfer_data: schemas.BranchTransferCreate, current_user_id: int, tenant_id: int, from_branch_id: int) -> BranchTransfer:
    transfer_number = generate_transfer_number(db, tenant_id)
    
    db_transfer = BranchTransfer(
        tenant_id=tenant_id,
        transfer_number=transfer_number,
        from_branch_id=from_branch_id,
        to_branch_id=transfer_data.to_branch_id,
        status=TransferStatus.PENDING,
        initiated_by_id=current_user_id,
        transfer_date=datetime.now(timezone.utc),
        notes=transfer_data.notes,
        vehicle_registration=transfer_data.vehicle_registration,
        driver_name=transfer_data.driver_name
    )
    db.add(db_transfer)
    db.flush()
    
    for item in transfer_data.items:
        db_item = BranchTransferItem(
            transfer_id=db_transfer.id,
            stock_item_id=item.stock_item_id,
            quantity_shipped=item.quantity_shipped,
            notes=item.notes
        )
        db.add(db_item)
    
    db.commit()
    db.refresh(db_transfer)
    return db_transfer


def update_transfer_status(db: Session, transfer_id: int, status_update: schemas.BranchTransferStatusUpdate, current_user_id: int, tenant_id: int) -> BranchTransfer:
    db_transfer = db.query(BranchTransfer).filter(BranchTransfer.id == transfer_id, BranchTransfer.tenant_id == tenant_id).first()
    if not db_transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
        
    old_status = db_transfer.status
    new_status = status_update.status
    
    if old_status == new_status:
        return db_transfer
        
    if new_status == TransferStatus.IN_TRANSIT and old_status == TransferStatus.PENDING:
        # Deduct stock from source branch
        for item in db_transfer.items:
            stock = db.query(StockItem).filter(StockItem.id == item.stock_item_id).first()
            if not stock or stock.current_quantity < float(item.quantity_shipped):
                raise HTTPException(status_code=400, detail=f"Insufficient stock for item {item.stock_item_id}")

            prev_qty = stock.current_quantity
            stock.current_quantity -= float(item.quantity_shipped)

            movement = StockMovement(
                item_id=stock.id,
                branch_id=db_transfer.from_branch_id,
                movement_type=MovementType.OUT,
                quantity=float(item.quantity_shipped),
                previous_quantity=prev_qty,
                new_quantity=stock.current_quantity,
                reference_type="branch_transfer",
                reference_id=db_transfer.id,
                notes=f"Dispatched in transfer {db_transfer.transfer_number}"
            )
            db.add(movement)
            
        db_transfer.status = new_status
        db_transfer.dispatched_by_id = current_user_id
        db_transfer.dispatch_date = datetime.now(timezone.utc)

        # Goods-in-transit journal: move inventory value out of the source branch
        try:
            from app.services.accounting_service import AccountingService
            acct = AccountingService(db, tenant_id=db_transfer.tenant_id)
            transit_code = acct.get_mapped_account_code("goods_in_transit", "1145")
            inv_code = acct.get_mapped_account_code("finished_goods", "1134")
            transfer_value = Decimal("0")
            for item in db_transfer.items:
                unit_cost = Decimal(str(item.stock_item.average_cost or 0)) if item.stock_item else Decimal("0")
                qty = Decimal(str(item.quantity_shipped or 0))
                transfer_value += qty * unit_cost
            if transfer_value > 0:
                acct.create_and_post_journal(
                    entry_date=db_transfer.dispatch_date.date() if db_transfer.dispatch_date else date.today(),
                    description=f"Branch transfer {db_transfer.transfer_number} dispatched → {db_transfer.to_branch.name if db_transfer.to_branch else db_transfer.to_branch_id}",
                    reference_type="branch_transfer_dispatch",
                    reference_id=db_transfer.id,
                    source_module="inventory",
                    created_by_user_id=current_user_id,
                    branch_id=db_transfer.from_branch_id,
                    lines=[
                        {"account_code": transit_code, "debit": transfer_value, "credit": Decimal("0"),
                         "memo": f"Transfer {db_transfer.transfer_number}: in transit"},
                        {"account_code": inv_code, "debit": Decimal("0"), "credit": transfer_value,
                         "memo": f"Transfer {db_transfer.transfer_number}: dispatched from branch"},
                    ],
                )
        except Exception as e:
            logger.warning("Branch transfer dispatch journal failed: %s", e)

    elif new_status == TransferStatus.COMPLETED and old_status == TransferStatus.IN_TRANSIT:
        if not status_update.received_items:
            raise HTTPException(status_code=400, detail="Received items quantities required to complete transfer")
            
        received_map = { r["item_id"]: r["quantity_received"] for r in status_update.received_items }
        
        for item in db_transfer.items:
            qty_received = received_map.get(item.stock_item_id, 0.0)
            item.quantity_received = qty_received
            
            # Find or create corresponding StockItem in destination branch
            source_stock = db.query(StockItem).filter(StockItem.id == item.stock_item_id).first()
            
            dest_stock = db.query(StockItem).filter(
                StockItem.sku == source_stock.sku, 
                StockItem.branch_id == db_transfer.to_branch_id
            ).first()
            
            if not dest_stock:
                dest_stock = StockItem(
                    sku=source_stock.sku,
                    name=source_stock.name,
                    category=source_stock.category,
                    unit_of_measure=source_stock.unit_of_measure,
                    current_quantity=0.0,
                    reorder_level=source_stock.reorder_level,
                    unit_price=source_stock.unit_price,
                    average_cost=source_stock.average_cost,
                    description=source_stock.description,
                    branch_id=db_transfer.to_branch_id,
                    is_active=True
                )
                db.add(dest_stock)
                db.flush()
                
            prev_qty = dest_stock.current_quantity
            dest_stock.current_quantity += qty_received
            
            movement = StockMovement(
                item_id=dest_stock.id,
                branch_id=db_transfer.to_branch_id,
                movement_type=MovementType.IN,
                quantity=qty_received,
                previous_quantity=prev_qty,
                new_quantity=dest_stock.current_quantity,
                reference_type="branch_transfer_receive",
                reference_id=db_transfer.id,
                notes=f"Received from transfer {db_transfer.transfer_number}"
            )
            db.add(movement)
            
        db_transfer.status = new_status
        db_transfer.received_by_id = current_user_id
        db_transfer.receive_date = datetime.now(timezone.utc)

        # Clear goods-in-transit into the destination branch's inventory
        try:
            from app.services.accounting_service import AccountingService
            acct = AccountingService(db, tenant_id=db_transfer.tenant_id)
            transit_code = acct.get_mapped_account_code("goods_in_transit", "1145")
            inv_code = acct.get_mapped_account_code("finished_goods", "1134")
            transfer_value = Decimal("0")
            for item in db_transfer.items:
                unit_cost = Decimal(str(item.stock_item.average_cost or 0)) if item.stock_item else Decimal("0")
                qty = Decimal(str(item.quantity_received or item.quantity_shipped or 0))
                transfer_value += qty * unit_cost
            if transfer_value > 0:
                acct.create_and_post_journal(
                    entry_date=db_transfer.receive_date.date() if db_transfer.receive_date else date.today(),
                    description=f"Branch transfer {db_transfer.transfer_number} received at {db_transfer.to_branch.name if db_transfer.to_branch else db_transfer.to_branch_id}",
                    reference_type="branch_transfer_receive",
                    reference_id=db_transfer.id,
                    source_module="inventory",
                    created_by_user_id=current_user_id,
                    branch_id=db_transfer.to_branch_id,
                    lines=[
                        {"account_code": inv_code, "debit": transfer_value, "credit": Decimal("0"),
                         "memo": f"Transfer {db_transfer.transfer_number}: received at branch"},
                        {"account_code": transit_code, "debit": Decimal("0"), "credit": transfer_value,
                         "memo": f"Transfer {db_transfer.transfer_number}: cleared from transit"},
                    ],
                )
        except Exception as e:
            logger.warning("Branch transfer receive journal failed: %s", e)

    elif new_status == TransferStatus.CANCELLED and old_status == TransferStatus.PENDING:
        db_transfer.status = new_status
    else:
        raise HTTPException(status_code=400, detail=f"Invalid state transition from {old_status} to {new_status}")
        
    db.commit()
    db.refresh(db_transfer)
    return db_transfer
