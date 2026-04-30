import logging
import re
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.settings import ReferenceDataType
from app.modules.farm.repository import FarmRepository
from app.modules.farm.schemas import (
    PoultryHouseCreate, PoultryHouseUpdate, PoultryHouseOut,
    BatchCreate, BatchUpdate, BatchOut,
    MortalityLogCreate, MortalityLogOut,
    VaccinationLogCreate, VaccinationLogUpdate, VaccinationLogOut,
    GrowthLogCreate, GrowthLogOut, ReferenceItemCreate, ReferenceItemOut, ReferenceItemUpdate
)

logger = logging.getLogger("farmexa.farm")


class FarmService:
    def __init__(self, db: AsyncSession):
        self.repo = FarmRepository(db)
        self.db = db

    @staticmethod
    def _normalize_reference_name(value: str) -> str:
        return value.strip()

    @staticmethod
    def _slugify_reference_code(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")

    async def _build_unique_reference_code(
        self,
        reference_type: ReferenceDataType,
        name: str,
        exclude_id: int | None = None,
    ) -> str:
        base_code = self._slugify_reference_code(name)
        if not base_code:
            raise HTTPException(status_code=400, detail="Reference item name is required")
        candidate = base_code
        suffix = 2
        while True:
            existing = await self.repo.get_reference_item_by_code(reference_type, candidate)
            if not existing or existing.id == exclude_id:
                return candidate
            candidate = f"{base_code}_{suffix}"
            suffix += 1

    async def _ensure_reference_items_bootstrapped(self) -> None:
        bootstrap_map = {
            ReferenceDataType.BATCH_BREED: await self.repo.list_distinct_batch_breeds(),
            ReferenceDataType.BATCH_SOURCE: await self.repo.list_distinct_batch_sources(),
            ReferenceDataType.MORTALITY_CAUSE: await self.repo.list_distinct_mortality_causes(),
            ReferenceDataType.VACCINE: await self.repo.list_distinct_vaccine_names(),
        }
        created = False
        for reference_type, names in bootstrap_map.items():
            for index, raw_name in enumerate(names):
                name = self._normalize_reference_name(raw_name)
                if not name:
                    continue
                existing = await self.repo.get_reference_item_by_name(reference_type, name)
                if existing:
                    continue
                code = await self._build_unique_reference_code(reference_type, name)
                await self.repo.create_reference_item(
                    {
                        "reference_type": reference_type,
                        "code": code,
                        "name": name,
                        "description": None,
                        "sort_order": index,
                        "is_active": True,
                    }
                )
                created = True
        if created:
            await self.db.commit()

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

    async def list_reference_items(
        self,
        reference_type: ReferenceDataType | None = None,
        active_only: bool = False,
    ) -> list[ReferenceItemOut]:
        await self._ensure_reference_items_bootstrapped()
        items = await self.repo.list_reference_items(reference_type=reference_type, active_only=active_only)
        return [ReferenceItemOut.model_validate(item) for item in items]

    async def create_reference_item(self, data: ReferenceItemCreate) -> ReferenceItemOut:
        clean_name = self._normalize_reference_name(data.name)
        existing = await self.repo.get_reference_item_by_name(data.reference_type, clean_name)
        if existing:
            raise HTTPException(status_code=400, detail="This list entry already exists")

        code = await self._build_unique_reference_code(data.reference_type, clean_name)
        item = await self.repo.create_reference_item(
            {
                **data.model_dump(),
                "name": clean_name,
                "code": code,
            }
        )
        await self.db.commit()
        item = await self.repo.get_reference_item(item.id)
        return ReferenceItemOut.model_validate(item)

    async def update_reference_item(self, item_id: int, data: ReferenceItemUpdate) -> ReferenceItemOut:
        item = await self.repo.get_reference_item(item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Reference item not found")

        payload = data.model_dump(exclude_unset=True)
        if "name" in payload:
            clean_name = self._normalize_reference_name(payload["name"])
            existing = await self.repo.get_reference_item_by_name(item.reference_type, clean_name)
            if existing and existing.id != item.id:
                raise HTTPException(status_code=400, detail="This list entry already exists")
            payload["name"] = clean_name
            payload["code"] = await self._build_unique_reference_code(item.reference_type, clean_name, exclude_id=item.id)

        item = await self.repo.update_reference_item(item, payload)
        await self.db.commit()
        item = await self.repo.get_reference_item(item.id)
        return ReferenceItemOut.model_validate(item)
