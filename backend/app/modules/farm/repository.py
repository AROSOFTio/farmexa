from typing import Sequence
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.farm import PoultryHouse, Batch, MortalityLog, VaccinationLog, GrowthLog
from app.modules.farm.schemas import (
    PoultryHouseCreate, PoultryHouseUpdate,
    BatchCreate, BatchUpdate,
    MortalityLogCreate, VaccinationLogCreate, VaccinationLogUpdate, GrowthLogCreate
)

class FarmRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Poultry Houses ───────────────────────────────────────────
    async def get_houses(self) -> Sequence[PoultryHouse]:
        res = await self.db.execute(select(PoultryHouse).order_by(PoultryHouse.id))
        return res.scalars().all()

    async def get_house(self, house_id: int) -> PoultryHouse | None:
        res = await self.db.execute(select(PoultryHouse).where(PoultryHouse.id == house_id))
        return res.scalar_one_or_none()

    async def get_house_by_name(self, name: str) -> PoultryHouse | None:
        res = await self.db.execute(
            select(PoultryHouse).where(func.lower(PoultryHouse.name) == name.strip().lower())
        )
        return res.scalar_one_or_none()

    async def create_house(self, data: PoultryHouseCreate) -> PoultryHouse:
        house = PoultryHouse(**data.model_dump())
        self.db.add(house)
        await self.db.flush()
        return house

    async def update_house(self, house: PoultryHouse, data: PoultryHouseUpdate) -> PoultryHouse:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(house, key, value)
        await self.db.flush()
        return house

    # ── Batches ──────────────────────────────────────────────────
    async def get_batches(self) -> Sequence[Batch]:
        res = await self.db.execute(
            select(Batch).options(selectinload(Batch.house)).order_by(Batch.id.desc())
        )
        return res.scalars().all()

    async def get_batch(self, batch_id: int) -> Batch | None:
        res = await self.db.execute(
            select(Batch).where(Batch.id == batch_id).options(selectinload(Batch.house))
        )
        return res.scalar_one_or_none()

    async def create_batch(self, data: BatchCreate) -> Batch:
        batch = Batch(**data.model_dump())
        self.db.add(batch)
        await self.db.flush()
        return batch

    async def update_batch(self, batch: Batch, data: BatchUpdate) -> Batch:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(batch, key, value)
        await self.db.flush()
        return batch

    # ── Mortality ────────────────────────────────────────────────
    async def get_mortality_logs(self, batch_id: int) -> Sequence[MortalityLog]:
        res = await self.db.execute(
            select(MortalityLog).where(MortalityLog.batch_id == batch_id).order_by(MortalityLog.record_date.desc())
        )
        return res.scalars().all()

    async def create_mortality_log(self, data: MortalityLogCreate) -> MortalityLog:
        log = MortalityLog(**data.model_dump())
        self.db.add(log)
        await self.db.flush()
        return log

    # ── Vaccination ──────────────────────────────────────────────
    async def get_vaccination_logs(self, batch_id: int) -> Sequence[VaccinationLog]:
        res = await self.db.execute(
            select(VaccinationLog).where(VaccinationLog.batch_id == batch_id).order_by(VaccinationLog.scheduled_date)
        )
        return res.scalars().all()

    async def get_vaccination_log(self, log_id: int) -> VaccinationLog | None:
        res = await self.db.execute(select(VaccinationLog).where(VaccinationLog.id == log_id))
        return res.scalar_one_or_none()

    async def create_vaccination_log(self, data: VaccinationLogCreate) -> VaccinationLog:
        log = VaccinationLog(**data.model_dump())
        self.db.add(log)
        await self.db.flush()
        return log

    async def update_vaccination_log(self, log: VaccinationLog, data: VaccinationLogUpdate) -> VaccinationLog:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(log, key, value)
        await self.db.flush()
        return log

    # ── Growth ───────────────────────────────────────────────────
    async def get_growth_logs(self, batch_id: int) -> Sequence[GrowthLog]:
        res = await self.db.execute(
            select(GrowthLog).where(GrowthLog.batch_id == batch_id).order_by(GrowthLog.record_date.desc())
        )
        return res.scalars().all()

    async def create_growth_log(self, data: GrowthLogCreate) -> GrowthLog:
        log = GrowthLog(**data.model_dump())
        self.db.add(log)
        await self.db.flush()
        return log
