import logging
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.modules.farm.repository import FarmRepository
from app.modules.farm.schemas import (
    PoultryHouseCreate, PoultryHouseUpdate, PoultryHouseOut,
    BatchCreate, BatchUpdate, BatchOut,
    MortalityLogCreate, MortalityLogOut,
    VaccinationLogCreate, VaccinationLogUpdate, VaccinationLogOut,
    GrowthLogCreate, GrowthLogOut
)

logger = logging.getLogger("farmexa.farm")


class FarmService:
    def __init__(self, db: AsyncSession):
        self.repo = FarmRepository(db)
        self.db = db

    # ── Poultry Houses ───────────────────────────────────────────
    async def get_houses(self) -> list[PoultryHouseOut]:
        houses = await self.repo.get_houses()
        return [PoultryHouseOut.model_validate(h) for h in houses]

    async def get_house(self, house_id: int) -> PoultryHouseOut:
        house = await self.repo.get_house(house_id)
        if not house:
            raise HTTPException(status_code=404, detail="House not found")
        return PoultryHouseOut.model_validate(house)

    async def create_house(self, data: PoultryHouseCreate) -> PoultryHouseOut:
        clean_name = data.name.strip()
        if await self.repo.get_house_by_name(clean_name):
            raise HTTPException(status_code=400, detail="House with this name already exists")

        try:
            payload = data.model_copy(update={"name": clean_name})
            house = await self.repo.create_house(payload)
            await self.db.commit()
            house = await self.repo.get_house(house.id)
            return PoultryHouseOut.model_validate(house)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="House with this name already exists")
        except Exception as exc:
            await self.db.rollback()
            logger.exception("Failed to create house: %s", exc)
            raise HTTPException(status_code=500, detail="Unable to save house")

    async def update_house(self, house_id: int, data: PoultryHouseUpdate) -> PoultryHouseOut:
        house = await self.repo.get_house(house_id)
        if not house:
            raise HTTPException(status_code=404, detail="House not found")

        if data.name is not None:
            clean_name = data.name.strip()
            existing_house = await self.repo.get_house_by_name(clean_name)
            if existing_house and existing_house.id != house_id:
                raise HTTPException(status_code=400, detail="House with this name already exists")
            data = data.model_copy(update={"name": clean_name})

        try:
            house = await self.repo.update_house(house, data)
            await self.db.commit()
            house = await self.repo.get_house(house.id)
            return PoultryHouseOut.model_validate(house)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="House with this name already exists")
        except Exception as exc:
            await self.db.rollback()
            logger.exception("Failed to update house %s: %s", house_id, exc)
            raise HTTPException(status_code=500, detail="Unable to save house")

    # ── Batches ──────────────────────────────────────────────────
    async def get_batches(self) -> list[BatchOut]:
        batches = await self.repo.get_batches()
        return [BatchOut.model_validate(b) for b in batches]

    async def get_batch(self, batch_id: int) -> BatchOut:
        batch = await self.repo.get_batch(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        return BatchOut.model_validate(batch)

    async def create_batch(self, data: BatchCreate) -> BatchOut:
        house = await self.repo.get_house(data.house_id)
        if not house:
            raise HTTPException(status_code=400, detail="Invalid house_id")
        try:
            batch = await self.repo.create_batch(data)
            await self.db.commit()
            # Fetch again to get eager-loaded relationships
            batch = await self.repo.get_batch(batch.id)
            return BatchOut.model_validate(batch)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Batch number already exists")

    async def update_batch(self, batch_id: int, data: BatchUpdate) -> BatchOut:
        batch = await self.repo.get_batch(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        if data.house_id and data.house_id != batch.house_id:
            house = await self.repo.get_house(data.house_id)
            if not house:
                raise HTTPException(status_code=400, detail="Invalid house_id")
        try:
            batch = await self.repo.update_batch(batch, data)
            await self.db.commit()
            batch = await self.repo.get_batch(batch.id)
            return BatchOut.model_validate(batch)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Database error occurred")

    # ── Mortality ────────────────────────────────────────────────
    async def get_mortality_logs(self, batch_id: int) -> list[MortalityLogOut]:
        logs = await self.repo.get_mortality_logs(batch_id)
        return [MortalityLogOut.model_validate(l) for l in logs]

    async def create_mortality_log(self, data: MortalityLogCreate) -> MortalityLogOut:
        batch = await self.repo.get_batch(data.batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        if batch.active_quantity < data.quantity:
            raise HTTPException(status_code=400, detail="Mortality quantity exceeds active birds")

        log = await self.repo.create_mortality_log(data)
        
        # Deduct from active quantity
        batch.active_quantity -= data.quantity
        await self.db.commit()
        return MortalityLogOut.model_validate(log)

    # ── Vaccination ──────────────────────────────────────────────
    async def get_vaccination_logs(self, batch_id: int) -> list[VaccinationLogOut]:
        logs = await self.repo.get_vaccination_logs(batch_id)
        return [VaccinationLogOut.model_validate(l) for l in logs]

    async def create_vaccination_log(self, data: VaccinationLogCreate) -> VaccinationLogOut:
        batch = await self.repo.get_batch(data.batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        log = await self.repo.create_vaccination_log(data)
        await self.db.commit()
        return VaccinationLogOut.model_validate(log)

    async def update_vaccination_log(self, log_id: int, data: VaccinationLogUpdate) -> VaccinationLogOut:
        log = await self.repo.get_vaccination_log(log_id)
        if not log:
            raise HTTPException(status_code=404, detail="Vaccination log not found")
        log = await self.repo.update_vaccination_log(log, data)
        await self.db.commit()
        return VaccinationLogOut.model_validate(log)

    # ── Growth ───────────────────────────────────────────────────
    async def get_growth_logs(self, batch_id: int) -> list[GrowthLogOut]:
        logs = await self.repo.get_growth_logs(batch_id)
        return [GrowthLogOut.model_validate(l) for l in logs]

    async def create_growth_log(self, data: GrowthLogCreate) -> GrowthLogOut:
        batch = await self.repo.get_batch(data.batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        log = await self.repo.create_growth_log(data)
        await self.db.commit()
        return GrowthLogOut.model_validate(log)
