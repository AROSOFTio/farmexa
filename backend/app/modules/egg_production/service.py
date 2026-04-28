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

    async def create_log(self, data: EggProductionCreate) -> EggProductionLog:
        batch = await self._get_batch(data.batch_id)

        total = data.good_eggs + data.cracked_eggs + data.damaged_eggs
        trays = round(total / 30, 2)
        rate = round((data.good_eggs / batch.active_quantity) * 100, 2) if batch.active_quantity > 0 else None

        log = EggProductionLog(
            batch_id=data.batch_id,
            record_date=data.record_date,
            good_eggs=data.good_eggs,
            cracked_eggs=data.cracked_eggs,
            damaged_eggs=data.damaged_eggs,
            total_eggs=total,
            total_trays=trays,
            production_rate=rate,
            notes=data.notes,
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(log)
        return log

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
