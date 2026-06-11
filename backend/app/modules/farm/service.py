import logging
import re

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.farm import (
    BatchStatus,
    HouseStatus,
    MedicationAdministration,
    PoultryHouse,
    PoultryHouseSection,
)
from app.models.inventory import StockCategory, StockItem
from app.models.settings import ReferenceDataType
from app.modules.farm.repository import FarmRepository
from app.modules.farm.schemas import (
    BatchCreate,
    BatchOut,
    BatchUpdate,
    GrowthLogCreate,
    GrowthLogOut,
    MedicationAdministrationCreate,
    MedicationAdministrationOut,
    MedicationAdministrationUpdate,
    MortalityLogCreate,
    MortalityLogOut,
    PoultryHouseCreate,
    PoultryHouseOut,
    PoultryHouseSectionCreate,
    PoultryHouseSectionOut,
    PoultryHouseUpdate,
    ReferenceItemCreate,
    ReferenceItemOut,
    ReferenceItemUpdate,
    VaccinationLogCreate,
    VaccinationLogOut,
    VaccinationLogUpdate,
)
from app.services.farm_validation import FarmValidationService
from app.services.inventory_coordinator import InventoryCoordinator, ReferenceType
from app.services.stock_sku import generate_unique_sku_async

logger = logging.getLogger("farmexa.farm")

HOUSE_SETUP_ROLES = {"tenant_admin", "farm_manager", "operations_officer", "supervisor"}
MASTER_DATA_ROLES = {"tenant_admin", "farm_manager", "supervisor"}
NON_BIRD_SECTION_KEYWORDS = {"storage", "store", "egg_storage", "eggs_storage", "warehouse"}

REFERENCE_DEFAULTS: dict[ReferenceDataType, list[str]] = {
    ReferenceDataType.HOUSE_SECTION_TYPE: ["Broilers", "Layers", "Egg Storage", "Quarantine", "Storage"],
    ReferenceDataType.BIRD_TYPE: ["Broiler", "Layer", "Kuroiler", "Sasso"],
    ReferenceDataType.FEED_TYPE: ["Starter Feed", "Grower Feed", "Layer Mash", "Finisher Feed"],
    ReferenceDataType.MEDICINE_TYPE: ["Antibiotic", "Vitamin", "Disinfectant", "Coccidiostat"],
    ReferenceDataType.EGG_GRADE: ["Small", "Medium", "Large", "Cracked"],
    ReferenceDataType.SLAUGHTER_PART: ["Breast", "Thigh", "Wing", "Drumstick", "Gizzard", "Liver"],
    ReferenceDataType.BYPRODUCT_TYPE: ["Feathers", "Blood", "Offal", "Manure", "Head", "Feet"],
    ReferenceDataType.EXPENSE_CATEGORY: ["Feed", "Medication", "Utilities", "Transport", "Labour"],
    ReferenceDataType.PAYMENT_METHOD: ["Cash", "Bank Transfer", "Mobile Money", "Cheque"],
    ReferenceDataType.UNIT_OF_MEASURE: ["kg", "tray", "piece", "litre", "bag"],
    ReferenceDataType.CUSTOMER_TYPE: ["Retail", "Wholesale", "Distributor", "Institutional"],
}


class FarmService:
    def __init__(self, db: AsyncSession):
        self.repo = FarmRepository(db)
        self.db = db

    @staticmethod
    def _role_name(actor) -> str:
        role = getattr(actor, "role", None)
        return getattr(role, "name", "") or ""

    def _ensure_house_management_role(self, actor) -> None:
        if self._role_name(actor) not in HOUSE_SETUP_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only tenant administrators, farm managers, operations officers, and supervisors can manage houses and sections.",
            )

    def _ensure_reference_management_role(self, actor) -> None:
        if self._role_name(actor) not in MASTER_DATA_ROLES:
            raise HTTPException(
                status_code=403,
                detail="Only tenant administrators, farm managers, and supervisors can manage reference data.",
            )

    @staticmethod
    def _normalize_reference_name(value: str) -> str:
        return value.strip()

    @staticmethod
    def _slugify_reference_code(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")

    @staticmethod
    def _normalize_section_type(value: str) -> str:
        return value.strip()

    @classmethod
    def _is_non_bird_section(cls, section_type: str) -> bool:
        normalized = cls._slugify_reference_code(section_type)
        return any(keyword in normalized for keyword in NON_BIRD_SECTION_KEYWORDS)

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
            ReferenceDataType.BIRD_TYPE: await self.repo.list_distinct_batch_breeds(),
            ReferenceDataType.BATCH_SOURCE: await self.repo.list_distinct_batch_sources(),
            ReferenceDataType.MORTALITY_CAUSE: await self.repo.list_distinct_mortality_causes(),
            ReferenceDataType.VACCINE: await self.repo.list_distinct_vaccine_names(),
        }
        bootstrap_map.update(REFERENCE_DEFAULTS)

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

    @staticmethod
    def _apply_section_metrics(section: PoultryHouseSection) -> PoultryHouseSection:
        occupied = sum(batch.active_quantity for batch in section.batches if batch.status == BatchStatus.ACTIVE)
        setattr(section, "occupied_capacity", occupied)
        setattr(section, "available_capacity", max(section.capacity - occupied, 0))
        return section

    def _apply_house_metrics(self, house: PoultryHouse) -> PoultryHouse:
        occupied = sum(batch.active_quantity for batch in house.batches if batch.status == BatchStatus.ACTIVE)
        setattr(house, "occupied_capacity", occupied)
        setattr(house, "available_capacity", max(house.capacity - occupied, 0))
        setattr(house, "active_batch_count", sum(1 for batch in house.batches if batch.status == BatchStatus.ACTIVE))
        for section in house.sections:
            self._apply_section_metrics(section)
        return house

    def _serialize_house(self, house: PoultryHouse) -> PoultryHouseOut:
        return PoultryHouseOut.model_validate(self._apply_house_metrics(house))

    def _serialize_batch(self, batch) -> BatchOut:
        if batch.house:
            self._apply_house_metrics(batch.house)
        if batch.section:
            self._apply_section_metrics(batch.section)
        return BatchOut.model_validate(batch)

    def _validate_sections(self, house_capacity: int, sections: list[PoultryHouseSectionCreate]) -> None:
        names = set()
        bird_capacity_total = 0
        for section in sections:
            clean_name = section.name.strip()
            if clean_name.lower() in names:
                raise HTTPException(status_code=400, detail="Section names must be unique within the same house.")
            names.add(clean_name.lower())
            if section.capacity > house_capacity:
                raise HTTPException(status_code=400, detail=f"Section '{clean_name}' capacity cannot exceed house capacity.")
            if not self._is_non_bird_section(section.section_type):
                bird_capacity_total += section.capacity
        if bird_capacity_total > house_capacity:
            raise HTTPException(
                status_code=400,
                detail="The sum of bird section capacities cannot exceed the total house capacity.",
            )

    async def get_houses(self) -> list[PoultryHouseOut]:
        houses = await self.repo.get_houses()
        return [self._serialize_house(house) for house in houses]

    async def get_house(self, house_id: int) -> PoultryHouseOut:
        house = await self.repo.get_house(house_id)
        if not house:
            raise HTTPException(status_code=404, detail="House not found")
        return self._serialize_house(house)

    async def create_house(self, data: PoultryHouseCreate, actor) -> PoultryHouseOut:
        self._ensure_house_management_role(actor)
        clean_name = data.name.strip()
        sections = [
            PoultryHouseSectionCreate(
                name=section.name.strip(),
                section_type=self._normalize_section_type(section.section_type),
                capacity=section.capacity,
                status=section.status,
                notes=section.notes,
            )
            for section in data.sections
        ]
        if await self.repo.get_house_by_name(clean_name):
            raise HTTPException(status_code=400, detail="House with this name already exists")
        self._validate_sections(data.capacity, sections)

        try:
            payload = data.model_copy(update={"name": clean_name, "sections": sections})
            house = await self.repo.create_house(payload)
            await self.db.commit()
            house = await self.repo.get_house(house.id)
            return self._serialize_house(house)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="House with this name already exists")
        except Exception as exc:  # pragma: no cover - unexpected
            await self.db.rollback()
            logger.exception("Failed to create house: %s", exc)
            raise HTTPException(status_code=500, detail="Unable to save house")

    async def update_house(self, house_id: int, data: PoultryHouseUpdate, actor) -> PoultryHouseOut:
        self._ensure_house_management_role(actor)
        house = await self.repo.get_house(house_id)
        if not house:
            raise HTTPException(status_code=404, detail="House not found")

        if data.name is not None:
            clean_name = data.name.strip()
            existing_house = await self.repo.get_house_by_name(clean_name)
            if existing_house and existing_house.id != house_id:
                raise HTTPException(status_code=400, detail="House with this name already exists")
            data = data.model_copy(update={"name": clean_name})

        next_capacity = data.capacity if data.capacity is not None else house.capacity
        occupied = await self.repo.get_active_quantity_for_house(house_id)
        if next_capacity < occupied:
            raise HTTPException(
                status_code=400,
                detail=f"House capacity cannot be set below occupied birds. Capacity {next_capacity}, occupied {occupied}.",
            )

        if data.sections is not None:
            if any(batch.section_id is not None for batch in house.batches):
                raise HTTPException(
                    status_code=409,
                    detail="This house already has batch allocations against sections. Move or close those batches before redefining the section structure.",
                )
            sections = [
                PoultryHouseSectionCreate(
                    name=section.name.strip(),
                    section_type=self._normalize_section_type(section.section_type),
                    capacity=section.capacity,
                    status=section.status,
                    notes=section.notes,
                )
                for section in data.sections
            ]
            self._validate_sections(next_capacity, sections)
            data = data.model_copy(update={"sections": sections})

        try:
            house = await self.repo.update_house(house, data)
            await self.db.commit()
            house = await self.repo.get_house(house.id)
            return self._serialize_house(house)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="House with this name already exists")
        except Exception as exc:  # pragma: no cover - unexpected
            await self.db.rollback()
            logger.exception("Failed to update house %s: %s", house_id, exc)
            raise HTTPException(status_code=500, detail="Unable to save house")

    async def _validate_batch_capacity(
        self,
        *,
        house_id: int,
        section_id: int | None,
        quantity: int,
        exclude_batch_id: int | None = None,
    ) -> None:
        house = await self.repo.get_house(house_id)
        if not house:
            raise HTTPException(status_code=400, detail="Invalid house_id")

        occupied_house = await self.repo.get_active_quantity_for_house(house_id, exclude_batch_id=exclude_batch_id)
        available_house = house.capacity - occupied_house
        if quantity > available_house:
            raise HTTPException(
                status_code=400,
                detail=f"House capacity exceeded. House capacity is {house.capacity}, occupied {occupied_house}, available {available_house}.",
            )

        if section_id is None:
            return

        section = await self.repo.get_section(section_id)
        if not section or section.house_id != house_id:
            raise HTTPException(status_code=400, detail="Selected section does not belong to the selected house.")
        occupied_section = await self.repo.get_active_quantity_for_section(section_id, exclude_batch_id=exclude_batch_id)
        available_section = section.capacity - occupied_section
        if quantity > available_section:
            raise HTTPException(
                status_code=400,
                detail=f"Section capacity exceeded. Section capacity is {section.capacity}, occupied {occupied_section}, available {available_section}.",
            )

    async def get_batches(self) -> list[BatchOut]:
        batches = await self.repo.get_batches()
        return [self._serialize_batch(batch) for batch in batches]

    async def get_batch(self, batch_id: int) -> BatchOut:
        batch = await self.repo.get_batch(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        return self._serialize_batch(batch)

    async def create_batch(self, data: BatchCreate) -> BatchOut:
        if data.active_quantity != data.initial_quantity:
            raise HTTPException(status_code=400, detail="Initial quantity and active quantity must match when creating a batch.")
        await self._validate_batch_capacity(
            house_id=data.house_id,
            section_id=data.section_id,
            quantity=data.initial_quantity,
        )
        try:
            # Create or find stock item for live birds
            stock_item_name = f"Live Birds - {data.breed}"
            result = await self.db.execute(
                select(StockItem).where(StockItem.name == stock_item_name, StockItem.category == StockCategory.FINISHED_PRODUCT)
            )
            stock_item = result.scalar_one_or_none()
            
            if not stock_item:
                stock_item = StockItem(
                    name=stock_item_name,
                    sku=await generate_unique_sku_async(self.db, "BIRDS", data.breed),
                    category=StockCategory.FINISHED_PRODUCT,
                    unit_of_measure="birds",
                    current_quantity=0.0,
                    reorder_level=0.0,
                    unit_price=0.0,
                    average_cost=0.0,
                    description=f"Live poultry birds - {data.breed}",
                    is_active=True,
                )
                self.db.add(stock_item)
                await self.db.flush()
            
            # Create batch with stock item linkage (ensure repository receives stock_item_id)
            batch_payload = data.model_copy(update={"active_quantity": data.initial_quantity}).model_dump()
            batch_payload["stock_item_id"] = stock_item.id
            batch = await self.repo.create_batch(batch_payload)
            await self.db.flush()
            
            # Record initial stock movement
            coordinator = InventoryCoordinator(self.db)
            await coordinator.record_in_async(
                item_id=stock_item.id,
                quantity=float(data.initial_quantity),
                reference_type=ReferenceType.BATCH_ARRIVAL.value,
                reference_id=batch.id,
                unit_cost=None,  # Cost can be added later
                notes=f"Initial batch arrival: {data.batch_number} ({data.breed})",
            )
            
            await self.db.commit()
            batch = await self.repo.get_batch(batch.id)
            return self._serialize_batch(batch)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Batch number already exists")

    async def update_batch(self, batch_id: int, data: BatchUpdate) -> BatchOut:
        batch = await self.repo.get_batch(batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")

        fields_set = set(data.model_fields_set)
        next_house_id = data.house_id if "house_id" in fields_set else batch.house_id
        next_section_id = data.section_id if "section_id" in fields_set else batch.section_id
        next_active_quantity = data.active_quantity if "active_quantity" in fields_set else batch.active_quantity

        if next_active_quantity < 0:
            raise HTTPException(status_code=400, detail="Active quantity cannot be negative.")

        if {"house_id", "section_id", "active_quantity"} & fields_set:
            await self._validate_batch_capacity(
                house_id=next_house_id,
                section_id=next_section_id,
                quantity=next_active_quantity,
                exclude_batch_id=batch.id,
            )

        requested_status = data.status if "status" in fields_set else batch.status
        if requested_status in {BatchStatus.DEPLETED, BatchStatus.SLAUGHTERED, BatchStatus.SOLD} and next_active_quantity > 0:
            raise HTTPException(status_code=400, detail="A batch cannot remain with active birds when marked as depleted, sold, or slaughtered.")

        try:
            # Handle active_quantity adjustments via InventoryCoordinator to avoid desync
            if "active_quantity" in fields_set and data.active_quantity is not None and data.active_quantity != batch.active_quantity:
                if not batch.stock_item_id:
                    raise HTTPException(status_code=400, detail="Batch is not linked to inventory; cannot adjust quantity. Recreate or link batch to stock.")
                delta = float(data.active_quantity - batch.active_quantity)
                coordinator = InventoryCoordinator(self.db)
                if delta > 0:
                    await coordinator.record_in_async(
                        item_id=batch.stock_item_id,
                        quantity=delta,
                        reference_type=ReferenceType.BATCH_ADJUSTMENT.value,
                        reference_id=batch.id,
                        unit_cost=None,
                        notes=f"Batch {batch.batch_number} manual quantity increase",
                    )
                else:
                    await coordinator.record_out_async(
                        item_id=batch.stock_item_id,
                        quantity=abs(delta),
                        reference_type=ReferenceType.BATCH_ADJUSTMENT.value,
                        reference_id=batch.id,
                        notes=f"Batch {batch.batch_number} manual quantity decrease",
                    )
            batch = await self.repo.update_batch(batch, data)
            if batch.active_quantity == 0 and batch.status == BatchStatus.ACTIVE:
                batch.status = BatchStatus.DEPLETED
            await self.db.commit()
            batch = await self.repo.get_batch(batch.id)
            return self._serialize_batch(batch)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Database error occurred")

    async def get_mortality_logs(self, batch_id: int) -> list[MortalityLogOut]:
        logs = await self.repo.get_mortality_logs(batch_id)
        return [MortalityLogOut.model_validate(log) for log in logs]

    async def create_mortality_log(self, data: MortalityLogCreate) -> MortalityLogOut:
        validator = FarmValidationService(self.db)
        batch = await validator.validate_mortality_quantity(data.batch_id, data.quantity)
        
        if not batch.stock_item_id:
            raise HTTPException(status_code=400, detail="Batch has no inventory link; cannot post mortality.")

        # Create mortality log first to get ID, then record stock movement and update batch atomically
        log = await self.repo.create_mortality_log(data)
        coordinator = InventoryCoordinator(self.db)
        await coordinator.record_out_async(
            item_id=batch.stock_item_id,
            quantity=float(data.quantity),
            reference_type=ReferenceType.MORTALITY.value,
            reference_id=log.id,
            notes=f"Mortality for batch {batch.batch_number}",
            batch_id=data.batch_id,
        )
        batch.active_quantity -= data.quantity
        if batch.active_quantity == 0:
            batch.status = BatchStatus.DEPLETED
            
        stock_item_res = await self.db.execute(select(StockItem).where(StockItem.id == batch.stock_item_id))
        stock_item = stock_item_res.scalar_one_or_none()
        mortality_cost = float(stock_item.average_cost or 0) * data.quantity if stock_item else 0.0

        def sync_accounting_call(session):
            from app.services.accounting_service import AccountingService
            accounting = AccountingService(session, tenant_id=batch.tenant_id)
            accounting.record_bird_mortality(
                amount=mortality_cost,
                entry_date=log.log_date,
                reference_id=log.id,
                created_by_user_id=None,
                branch_id=batch.house.branch_id if batch.house else None,
                batch_id=data.batch_id,
            )
        await self.db.run_sync(sync_accounting_call)

        await self.db.commit()
        return MortalityLogOut.model_validate(log)

    async def get_vaccination_logs(self, batch_id: int) -> list[VaccinationLogOut]:
        logs = await self.repo.get_vaccination_logs(batch_id)
        return [VaccinationLogOut.model_validate(log) for log in logs]

    async def create_vaccination_log(self, data: VaccinationLogCreate, user_id: int) -> VaccinationLogOut:
        validator = FarmValidationService(self.db)
        
        # Validate vaccination workflow if vaccine item is specified
        if data.vaccine_item_id:
            birds_to_vaccinate = data.birds_vaccinated if data.birds_vaccinated else 0
            await validator.validate_vaccination_workflow(
                batch_id=data.batch_id,
                vaccine_item_id=data.vaccine_item_id,
                dosage_per_bird=data.dosage_per_bird,
                birds_to_vaccinate=birds_to_vaccinate,
            )
        
        # Create vaccination log
        log_data = data.model_dump()
        log_data["administered_by_id"] = user_id
        log = await self.repo.create_vaccination_log(log_data)
        
        # If status is completed and vaccine item is specified, record stock movement
        if data.status == "completed" and data.vaccine_item_id and data.quantity_used:
            await validator.record_vaccination_stock_movement(
                vaccine_item_id=data.vaccine_item_id,
                quantity_used=data.quantity_used,
                batch_id=data.batch_id,
                notes=data.notes or f"Vaccination: {data.vaccine_name}",
            )
        
        await self.db.commit()
        return VaccinationLogOut.model_validate(log)

    async def update_vaccination_log(self, log_id: int, data: VaccinationLogUpdate, user_id: int) -> VaccinationLogOut:
        log = await self.repo.get_vaccination_log(log_id)
        if not log:
            raise HTTPException(status_code=404, detail="Vaccination log not found")
        
        validator = FarmValidationService(self.db)
        
        # If transitioning to completed status with vaccine item, validate and record stock movement
        if data.status == "completed" and log.status != "completed":
            if data.vaccine_item_id:
                birds_to_vaccinate = data.birds_vaccinated if data.birds_vaccinated else (log.birds_vaccinated or 0)
                dosage_per_bird = data.dosage_per_bird if data.dosage_per_bird is not None else log.dosage_per_bird
                await validator.validate_vaccination_workflow(
                    batch_id=log.batch_id,
                    vaccine_item_id=data.vaccine_item_id,
                    dosage_per_bird=dosage_per_bird,
                    birds_to_vaccinate=birds_to_vaccinate,
                )
            
            quantity_used = data.quantity_used if data.quantity_used is not None else log.quantity_used
            if data.vaccine_item_id and quantity_used:
                await validator.record_vaccination_stock_movement(
                    vaccine_item_id=data.vaccine_item_id,
                    quantity_used=quantity_used,
                    batch_id=log.batch_id,
                    notes=data.notes or log.notes or f"Vaccination: {log.vaccine_name}",
                )
            
            if data.administered_date is None:
                data = data.model_copy(update={"administered_date": log.scheduled_date})
        
        log = await self.repo.update_vaccination_log(log, data.model_dump(exclude_none=True))
        if data.status == "completed" and not log.administered_by_id:
            log.administered_by_id = user_id
        await self.db.commit()
        return VaccinationLogOut.model_validate(log)

    async def get_growth_logs(self, batch_id: int) -> list[GrowthLogOut]:
        logs = await self.repo.get_growth_logs(batch_id)
        return [GrowthLogOut.model_validate(log) for log in logs]

    async def create_growth_log(self, data: GrowthLogCreate) -> GrowthLogOut:
        batch = await self.repo.get_batch(data.batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        log = await self.repo.create_growth_log(data)
        await self.db.commit()
        return GrowthLogOut.model_validate(log)

    async def get_medication_administrations(self, batch_id: int) -> list[MedicationAdministrationOut]:
        logs = await self.repo.get_medication_administrations(batch_id)
        return [MedicationAdministrationOut.model_validate(log) for log in logs]

    async def create_medication_administration(self, data: MedicationAdministrationCreate, user_id: int) -> MedicationAdministrationOut:
        validator = FarmValidationService(self.db)
        
        # Validate medication workflow
        batch, medicine_item = await validator.validate_medication_workflow(
            batch_id=data.batch_id,
            medicine_item_id=data.medicine_item_id,
            total_quantity_used=data.total_quantity_used,
            birds_treated=data.birds_treated,
        )
        
        # Create medication administration record
        admin_data = data.model_dump()
        admin_data["administered_by_id"] = user_id
        admin = await self.repo.create_medication_administration(admin_data)
        
        # Record stock movement for medicine
        await validator.record_medication_stock_movement(
            medicine_item_id=data.medicine_item_id,
            quantity_used=data.total_quantity_used,
            batch_id=data.batch_id,
            notes=data.notes or f"Medication administration for batch #{data.batch_id}",
        )
        
        medication_cost = float(medicine_item.average_cost or 0) * data.total_quantity_used

        def sync_accounting_call(session):
            from app.services.accounting_service import AccountingService
            accounting = AccountingService(session, tenant_id=batch.tenant_id)
            accounting.record_medication_usage(
                amount=medication_cost,
                entry_date=admin.administered_date,
                reference_id=admin.id,
                created_by_user_id=None,
                branch_id=batch.house.branch_id if batch.house else None,
                batch_id=data.batch_id,
            )
        await self.db.run_sync(sync_accounting_call)

        await self.db.commit()
        return MedicationAdministrationOut.model_validate(admin)

    async def update_medication_administration(self, admin_id: int, data: MedicationAdministrationUpdate) -> MedicationAdministrationOut:
        admin = await self.repo.get_medication_administration(admin_id)
        if not admin:
            raise HTTPException(status_code=404, detail="Medication administration not found")
        
        # For now, only allow updating notes and reason - quantity changes would require complex stock adjustment logic
        # If quantity changes are needed, the record should be cancelled and a new one created
        if data.total_quantity_used is not None and data.total_quantity_used != admin.total_quantity_used:
            raise HTTPException(
                status_code=400,
                detail="Cannot change quantity after administration. Cancel and create a new record instead."
            )
        
        admin = await self.repo.update_medication_administration(admin, data.model_dump(exclude_none=True))
        await self.db.commit()
        return MedicationAdministrationOut.model_validate(admin)

    async def delete_medication_administration(self, admin_id: int) -> dict:
        admin = await self.repo.get_medication_administration(admin_id)
        if not admin:
            raise HTTPException(status_code=404, detail="Medication administration not found")
        
        # Note: We don't reverse the stock movement on deletion for audit trail purposes
        # Stock adjustments should be done via manual adjustment if needed
        await self.repo.delete_medication_administration(admin_id)
        await self.db.commit()
        return {"message": "Medication administration deleted successfully"}

    async def list_reference_items(
        self,
        reference_type: ReferenceDataType | None = None,
        active_only: bool = False,
    ) -> list[ReferenceItemOut]:
        await self._ensure_reference_items_bootstrapped()
        items = await self.repo.list_reference_items(reference_type=reference_type, active_only=active_only)
        return [ReferenceItemOut.model_validate(item) for item in items]

    async def create_reference_item(self, data: ReferenceItemCreate, actor) -> ReferenceItemOut:
        self._ensure_reference_management_role(actor)
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

    async def update_reference_item(self, item_id: int, data: ReferenceItemUpdate, actor) -> ReferenceItemOut:
        self._ensure_reference_management_role(actor)
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
