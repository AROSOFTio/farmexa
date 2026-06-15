"""
Egg production service — CRUD + summary analytics.
"""
from datetime import date
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.egg_production import EggProductionLog
from app.models.farm import Batch
from app.modules.egg_production.schemas import (
    EggProductionCreate,
    EggProductionUpdate,
    EggProductionSummary,
)


class EggProductionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_batch(self, batch_id: int) -> Batch:
        result = await self.db.execute(select(Batch).where(Batch.id == batch_id))
        batch = result.scalar_one_or_none()
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        return batch

    async def list_logs(
        self,
        batch_id: Optional[int] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[EggProductionLog]:
        query = select(EggProductionLog).order_by(EggProductionLog.record_date.desc())
        if batch_id is not None:
            query = query.where(EggProductionLog.batch_id == batch_id)
        if from_date:
            query = query.where(EggProductionLog.record_date >= from_date)
        if to_date:
            query = query.where(EggProductionLog.record_date <= to_date)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_log(self, log_id: int) -> EggProductionLog:
        result = await self.db.execute(
            select(EggProductionLog).where(EggProductionLog.id == log_id)
        )
        log = result.scalar_one_or_none()
        if not log:
            raise HTTPException(status_code=404, detail="Egg production record not found")
        return log

    async def create_log(self, data: EggProductionCreate, tenant_id: int | None = None) -> EggProductionLog:
        batch = await self._get_batch(data.batch_id)

        total = data.good_eggs + data.cracked_eggs + data.damaged_eggs
        trays = round(total / 30, 2)
        rate = round((data.good_eggs / batch.active_quantity) * 100, 2) if batch.active_quantity > 0 else None

        price_per_tray = data.price_per_tray
        if (not price_per_tray or price_per_tray <= 0) and trays > 0:
            from app.models.settings import ProductCatalog
            from sqlalchemy import select
            product_res = await self.db.execute(
                select(ProductCatalog).where(ProductCatalog.name.ilike("%egg%"), ProductCatalog.is_active == True).limit(1)
            )
            product = product_res.scalar_one_or_none()
            if product:
                price_per_tray = product.base_price

        log = EggProductionLog(
            batch_id=data.batch_id,
            record_date=data.record_date,
            good_eggs=data.good_eggs,
            cracked_eggs=data.cracked_eggs,
            damaged_eggs=data.damaged_eggs,
            total_eggs=total,
            total_trays=trays,
            production_rate=rate,
            price_per_tray=price_per_tray,
            notes=data.notes,
        )
        self.db.add(log)
        await self.db.flush()

        # Make produced eggs sellable: add good-egg trays to a finished-product
        # inventory item so they appear in POS automatically. Revenue is booked
        # when the eggs are actually sold (POS), not at production time — so we no
        # longer post an egg-sales journal here (that double-counted on sale).
        good_trays = round(data.good_eggs / 30, 4)
        if good_trays > 0:
            await self._add_eggs_to_inventory(
                trays=good_trays,
                unit_price=price_per_tray,
                reference_id=log.id,
                record_date=data.record_date,
            )

        await self.db.commit()
        await self.db.refresh(log)
        return log

    async def _add_eggs_to_inventory(
        self,
        *,
        trays: float,
        unit_price,
        reference_id: int,
        record_date: date,
    ) -> None:
        """Find or create the 'Eggs' finished-product stock item and add trays to it."""
        from app.models.inventory import StockCategory, StockItem
        from app.services.inventory_coordinator import InventoryCoordinator
        from app.services.stock_sku import generate_unique_sku_async

        res = await self.db.execute(
            select(StockItem).where(func.lower(StockItem.name) == "eggs")
        )
        item = res.scalar_one_or_none()
        if item is None:
            item = StockItem(
                name="Eggs",
                sku=await generate_unique_sku_async(self.db, "EGG", "Eggs"),
                category=StockCategory.FINISHED_PRODUCT,
                unit_of_measure="tray",
                current_quantity=0.0,
                reorder_level=0.0,
                unit_price=float(unit_price or 0),
                average_cost=0.0,
                description="Eggs from production (sold per tray).",
                is_active=True,
            )
            self.db.add(item)
            await self.db.flush()
        elif unit_price and float(unit_price) > 0 and not float(item.unit_price or 0):
            item.unit_price = float(unit_price)

        coordinator = InventoryCoordinator(self.db)
        await coordinator.record_in_async(
            item_id=item.id,
            quantity=float(trays),
            reference_type="egg_production",
            reference_id=reference_id,
            unit_cost=0.0,
            notes=f"Egg production {record_date}",
        )

    async def update_log(self, log_id: int, data: EggProductionUpdate) -> EggProductionLog:
        log = await self.get_log(log_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(log, field, value)
        # Recompute totals
        log.total_eggs = log.good_eggs + log.cracked_eggs + log.damaged_eggs
        log.total_trays = round(log.total_eggs / 30, 2)
        await self.db.commit()
        await self.db.refresh(log)
        return log

    async def delete_log(self, log_id: int) -> None:
        log = await self.get_log(log_id)
        await self.db.delete(log)
        await self.db.commit()

    async def get_summary(
        self,
        batch_id: Optional[int] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> EggProductionSummary:
        query = select(
            func.coalesce(func.sum(EggProductionLog.good_eggs), 0),
            func.coalesce(func.sum(EggProductionLog.cracked_eggs), 0),
            func.coalesce(func.sum(EggProductionLog.damaged_eggs), 0),
            func.coalesce(func.sum(EggProductionLog.total_eggs), 0),
            func.coalesce(func.sum(EggProductionLog.total_trays), 0),
            func.avg(EggProductionLog.production_rate),
            func.count(EggProductionLog.id),
        )
        if batch_id is not None:
            query = query.where(EggProductionLog.batch_id == batch_id)
        if from_date:
            query = query.where(EggProductionLog.record_date >= from_date)
        if to_date:
            query = query.where(EggProductionLog.record_date <= to_date)

        result = await self.db.execute(query)
        row = result.one()
        return EggProductionSummary(
            total_good=int(row[0]),
            total_cracked=int(row[1]),
            total_damaged=int(row[2]),
            total_eggs=int(row[3]),
            total_trays=float(row[4]),
            avg_production_rate=float(row[5]) if row[5] is not None else None,
            records_count=int(row[6]),
        )
