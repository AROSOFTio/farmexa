from typing import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.farm import Batch, BatchStatus, GrowthLog, MortalityLog, PoultryHouse, PoultryHouseSection, VaccinationLog
from app.models.settings import ReferenceDataType, ReferenceItem
from app.modules.farm.schemas import (
    BatchCreate,
    BatchUpdate,
    GrowthLogCreate,
    MortalityLogCreate,
    PoultryHouseCreate,
    PoultryHouseUpdate,
    VaccinationLogCreate,
    VaccinationLogUpdate,
)


class FarmRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _house_query(self):
        return select(PoultryHouse).options(
            selectinload(PoultryHouse.sections).selectinload(PoultryHouseSection.batches),
            selectinload(PoultryHouse.batches).selectinload(Batch.section),
        )

    def _batch_query(self):
        return select(Batch).options(
            selectinload(Batch.house).selectinload(PoultryHouse.sections),
            selectinload(Batch.section),
        )

    async def get_houses(self) -> Sequence[PoultryHouse]:
        res = await self.db.execute(self._house_query().order_by(PoultryHouse.id))
        return res.scalars().all()

    async def get_house(self, house_id: int) -> PoultryHouse | None:
        res = await self.db.execute(self._house_query().where(PoultryHouse.id == house_id))
        return res.scalar_one_or_none()

    async def get_house_by_name(self, name: str) -> PoultryHouse | None:
        res = await self.db.execute(
            self._house_query().where(func.lower(PoultryHouse.name) == name.strip().lower())
        )
        return res.scalar_one_or_none()

    async def get_section(self, section_id: int) -> PoultryHouseSection | None:
        res = await self.db.execute(
            select(PoultryHouseSection)
            .where(PoultryHouseSection.id == section_id)
            .options(selectinload(PoultryHouseSection.house), selectinload(PoultryHouseSection.batches))
        )
        return res.scalar_one_or_none()

    async def create_house(self, data: PoultryHouseCreate) -> PoultryHouse:
        house = PoultryHouse(name=data.name, capacity=data.capacity, status=data.status)
        self.db.add(house)
        await self.db.flush()
        await self.replace_house_sections(house, data.sections)
        await self.db.flush()
        return house

    async def replace_house_sections(self, house: PoultryHouse, sections: list) -> None:
        house.sections.clear()
        await self.db.flush()
        for section in sections:
            payload = section.model_dump() if hasattr(section, "model_dump") else dict(section)
            house.sections.append(PoultryHouseSection(**payload))
        await self.db.flush()

    async def update_house(self, house: PoultryHouse, data: PoultryHouseUpdate) -> PoultryHouse:
        update_data = data.model_dump(exclude_unset=True, exclude={"sections"})
        for key, value in update_data.items():
            setattr(house, key, value)
        if data.sections is not None:
            await self.replace_house_sections(house, data.sections)
        await self.db.flush()
        return house

    async def get_batches(self) -> Sequence[Batch]:
        res = await self.db.execute(self._batch_query().order_by(Batch.id.desc()))
        return res.scalars().all()

    async def get_batch(self, batch_id: int) -> Batch | None:
        res = await self.db.execute(self._batch_query().where(Batch.id == batch_id))
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

    async def get_active_quantity_for_house(self, house_id: int, exclude_batch_id: int | None = None) -> int:
        query = select(func.coalesce(func.sum(Batch.active_quantity), 0)).where(
            Batch.house_id == house_id,
            Batch.status == BatchStatus.ACTIVE,
        )
        if exclude_batch_id is not None:
            query = query.where(Batch.id != exclude_batch_id)
        result = await self.db.execute(query)
        return int(result.scalar_one() or 0)

    async def get_active_quantity_for_section(self, section_id: int, exclude_batch_id: int | None = None) -> int:
        query = select(func.coalesce(func.sum(Batch.active_quantity), 0)).where(
            Batch.section_id == section_id,
            Batch.status == BatchStatus.ACTIVE,
        )
        if exclude_batch_id is not None:
            query = query.where(Batch.id != exclude_batch_id)
        result = await self.db.execute(query)
        return int(result.scalar_one() or 0)

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

    async def list_reference_items(
        self,
        reference_type: ReferenceDataType | None = None,
        active_only: bool = False,
    ) -> Sequence[ReferenceItem]:
        query = select(ReferenceItem).order_by(ReferenceItem.reference_type, ReferenceItem.sort_order, ReferenceItem.name)
        if reference_type is not None:
            query = query.where(ReferenceItem.reference_type == reference_type)
        if active_only:
            query = query.where(ReferenceItem.is_active.is_(True))
        res = await self.db.execute(query)
        return res.scalars().all()

    async def get_reference_item(self, item_id: int) -> ReferenceItem | None:
        res = await self.db.execute(select(ReferenceItem).where(ReferenceItem.id == item_id))
        return res.scalar_one_or_none()

    async def get_reference_item_by_name(self, reference_type: ReferenceDataType, name: str) -> ReferenceItem | None:
        res = await self.db.execute(
            select(ReferenceItem).where(
                ReferenceItem.reference_type == reference_type,
                func.lower(ReferenceItem.name) == name.strip().lower(),
            )
        )
        return res.scalar_one_or_none()

    async def get_reference_item_by_code(self, reference_type: ReferenceDataType, code: str) -> ReferenceItem | None:
        res = await self.db.execute(
            select(ReferenceItem).where(
                ReferenceItem.reference_type == reference_type,
                ReferenceItem.code == code,
            )
        )
        return res.scalar_one_or_none()

    async def create_reference_item(self, payload: dict) -> ReferenceItem:
        item = ReferenceItem(**payload)
        self.db.add(item)
        await self.db.flush()
        return item

    async def update_reference_item(self, item: ReferenceItem, payload: dict) -> ReferenceItem:
        for key, value in payload.items():
            setattr(item, key, value)
        await self.db.flush()
        return item

    async def list_distinct_batch_breeds(self) -> list[str]:
        res = await self.db.execute(
            select(Batch.breed).where(Batch.breed.is_not(None), Batch.breed != "").distinct().order_by(Batch.breed)
        )
        return [value for value in res.scalars().all() if value]

    async def list_distinct_batch_sources(self) -> list[str]:
        res = await self.db.execute(
            select(Batch.source).where(Batch.source.is_not(None), Batch.source != "").distinct().order_by(Batch.source)
        )
        return [value for value in res.scalars().all() if value]

    async def list_distinct_mortality_causes(self) -> list[str]:
        res = await self.db.execute(
            select(MortalityLog.cause)
            .where(MortalityLog.cause.is_not(None), MortalityLog.cause != "")
            .distinct()
            .order_by(MortalityLog.cause)
        )
        return [value for value in res.scalars().all() if value]

    async def list_distinct_vaccine_names(self) -> list[str]:
        res = await self.db.execute(
            select(VaccinationLog.vaccine_name)
            .where(VaccinationLog.vaccine_name.is_not(None), VaccinationLog.vaccine_name != "")
            .distinct()
            .order_by(VaccinationLog.vaccine_name)
        )
        return [value for value in res.scalars().all() if value]
