import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models.feed import FeedCategory, FeedFormulation, FeedFormulationIngredient, FeedItem, FeedProductionBatch
from app.models.inventory import StockCategory, StockItem
from app.modules.feed.repository import FeedRepository
from app.modules.feed.schemas import (
    SupplierCreate, SupplierUpdate, SupplierOut,
    FeedCategoryCreate, FeedCategoryUpdate, FeedCategoryOut,
    FeedItemCreate, FeedItemUpdate, FeedItemOut,
    FeedPurchaseCreate, FeedPurchaseOut,
    FeedConsumptionCreate, FeedConsumptionOut,
    FeedFormulationCreate, FeedFormulationOut, FeedProductionCreate, FeedProductionOut
)
from app.modules.farm.repository import FarmRepository
from app.services.inventory_coordinator import InventoryCoordinator, ReferenceType
from app.services.stock_sku import generate_unique_sku_async

class FeedService:
    def __init__(self, db: AsyncSession):
        self.repo = FeedRepository(db)
        self.farm_repo = FarmRepository(db)
        self.db = db

    async def _ensure_feed_stock_item(self, feed_item: FeedItem, category: StockCategory = StockCategory.RAW_MATERIAL) -> StockItem:
        if feed_item.stock_item_id:
            result = await self.db.execute(select(StockItem).where(StockItem.id == feed_item.stock_item_id))
            existing = result.scalar_one_or_none()
            if existing:
                return existing

        stock_item = StockItem(
            name=feed_item.name,
            sku=await generate_unique_sku_async(self.db, "FEED", feed_item.name),
            category=category,
            unit_of_measure=feed_item.unit,
            current_quantity=0.0,
            reorder_level=feed_item.reorder_threshold,
            unit_price=0.0,
            average_cost=0.0,
            description=f"Feed item: {feed_item.name}",
            is_active=True,
        )
        self.db.add(stock_item)
        await self.db.flush()
        feed_item.stock_item_id = stock_item.id
        await self.db.flush()
        return stock_item

    # ── Suppliers ────────────────────────────────────────────────
    async def get_suppliers(self) -> list[SupplierOut]:
        items = await self.repo.get_suppliers()
        return [SupplierOut.model_validate(i) for i in items]

    async def get_supplier(self, id: int) -> SupplierOut:
        item = await self.repo.get_supplier(id)
        if not item:
            raise HTTPException(status_code=404, detail="Supplier not found")
        return SupplierOut.model_validate(item)

    async def create_supplier(self, data: SupplierCreate) -> SupplierOut:
        try:
            item = await self.repo.create_supplier(data)
            await self.db.commit()
            return SupplierOut.model_validate(item)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Supplier could not be saved. Check for duplicate or invalid values.")

    async def update_supplier(self, id: int, data: SupplierUpdate) -> SupplierOut:
        item = await self.repo.get_supplier(id)
        if not item:
            raise HTTPException(status_code=404, detail="Supplier not found")
        item = await self.repo.update_supplier(item, data)
        await self.db.commit()
        return SupplierOut.model_validate(item)

    # ── Categories ───────────────────────────────────────────────
    async def get_categories(self) -> list[FeedCategoryOut]:
        items = await self.repo.get_categories()
        return [FeedCategoryOut.model_validate(i) for i in items]

    async def create_category(self, data: FeedCategoryCreate) -> FeedCategoryOut:
        try:
            item = await self.repo.create_category(data)
            await self.db.commit()
            return FeedCategoryOut.model_validate(item)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Category name already exists")

    async def update_category(self, id: int, data: FeedCategoryUpdate) -> FeedCategoryOut:
        item = await self.repo.get_category(id)
        if not item:
            raise HTTPException(status_code=404, detail="Category not found")
        try:
            item = await self.repo.update_category(item, data)
            await self.db.commit()
            return FeedCategoryOut.model_validate(item)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Category name already exists")

    # ── Items ────────────────────────────────────────────────────
    async def get_items(self) -> list[FeedItemOut]:
        items = await self.repo.get_items()
        return [FeedItemOut.model_validate(i) for i in items]

    async def create_item(self, data: FeedItemCreate) -> FeedItemOut:
        cat = await self.repo.get_category(data.category_id)
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category_id")
        # Create FeedItem
        item = await self.repo.create_item(data)
        await self.db.flush()

        await self._ensure_feed_stock_item(item)
        await self.db.commit()
        refreshed = await self.repo.get_item(item.id)
        return FeedItemOut.model_validate(refreshed)

    async def update_item(self, id: int, data: FeedItemUpdate) -> FeedItemOut:
        item = await self.repo.get_item(id)
        if not item:
            raise HTTPException(status_code=404, detail="Feed item not found")
        if data.category_id is not None:
            cat = await self.repo.get_category(data.category_id)
            if not cat:
                raise HTTPException(status_code=400, detail="Invalid category_id")
        try:
            item = await self.repo.update_item(item, data)
            if item.stock_item_id:
                stock_item = await self._ensure_feed_stock_item(item)
                stock_item.name = item.name
                stock_item.unit_of_measure = item.unit
                stock_item.reorder_level = item.reorder_threshold
            await self.db.commit()
            refreshed = await self.repo.get_item(item.id)
            return FeedItemOut.model_validate(refreshed)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Feed item could not be updated")

    # ── Purchases ────────────────────────────────────────────────
    async def get_purchases(self) -> list[FeedPurchaseOut]:
        items = await self.repo.get_purchases()
        return [FeedPurchaseOut.model_validate(i) for i in items]

    async def create_purchase(self, data: FeedPurchaseCreate) -> FeedPurchaseOut:
        supplier = await self.repo.get_supplier(data.supplier_id)
        if not supplier:
            raise HTTPException(status_code=400, detail="Invalid supplier_id")

        coordinator = InventoryCoordinator(self.db)

        purchase_data = data.model_dump(exclude={"items"})
        items_data: list[dict] = []
        prepared_items: list[tuple[int, float, float]] = []  # (stock_item_id, quantity, unit_price)

        for item in data.items:
            item_payload = item.model_dump(
                exclude={
                    "other_feed_item_name",
                    "other_feed_category_id",
                    "other_feed_unit",
                    "other_reorder_threshold",
                }
            )
            if item.feed_item_id <= 0:
                item_name = (item.other_feed_item_name or "").strip()
                if not item_name:
                    raise HTTPException(status_code=422, detail="Feed item is required. Select an item or enter an other item name.")

                category_id = item.other_feed_category_id
                if category_id:
                    category = await self.repo.get_category(category_id)
                else:
                    category = await self.repo.get_category_by_name("Raw Materials")
                    if not category:
                        category = await self.repo.create_category(
                            FeedCategoryCreate(name="Raw Materials", description="Feed mill raw material stock.")
                        )

                if not category:
                    raise HTTPException(status_code=400, detail="Invalid feed item category.")

                existing_item = await self.repo.get_item_by_name(item_name)
                if existing_item:
                    feed_item = existing_item
                else:
                    feed_item = await self.repo.create_item(
                        FeedItemCreate(
                            name=item_name,
                            category_id=category.id,
                            unit=item.other_feed_unit or "kg",
                            reorder_threshold=item.other_reorder_threshold,
                        )
                    )
                item_payload["feed_item_id"] = feed_item.id
            
            # Link or create StockItem for feed item
            feed_item = await self.repo.get_item(item_payload["feed_item_id"])
            await self._ensure_feed_stock_item(feed_item)

            items_data.append(item_payload)
            prepared_items.append((feed_item.stock_item_id, item.quantity, item.unit_price))

        # Create purchase and items first to get purchase.id
        purchase = await self.repo.create_purchase(purchase_data, items_data)
        await self.db.flush()

        # Record movements referencing purchase id
        for stock_item_id, qty, unit_price in prepared_items:
            try:
                await coordinator.record_in_async(
                    item_id=stock_item_id,
                    quantity=qty,
                    reference_type=ReferenceType.FEED_PURCHASE.value,
                    reference_id=purchase.id,
                    unit_cost=unit_price,
                    notes=f"Feed purchase from {supplier.name}",
                )
            except HTTPException as e:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Cannot record stock movement for feed purchase: {e.detail}")

        await self.db.commit()
        purchase = await self.repo.get_purchase(purchase.id)
        return FeedPurchaseOut.model_validate(purchase)

    # ── Consumptions ─────────────────────────────────────────────
    async def get_consumptions(self, batch_id: int = None) -> list[FeedConsumptionOut]:
        items = await self.repo.get_consumptions(batch_id)
        return [FeedConsumptionOut.model_validate(i) for i in items]

    async def create_consumption(self, data: FeedConsumptionCreate) -> FeedConsumptionOut:
        batch = await self.farm_repo.get_batch(data.batch_id)
        if not batch:
            raise HTTPException(status_code=400, detail="Invalid batch_id")
            
        feed_item = await self.repo.get_item(data.feed_item_id)
        if not feed_item:
            raise HTTPException(status_code=400, detail="Invalid feed_item_id")

        # Ensure stock linkage exists
        await self._ensure_feed_stock_item(feed_item)

        # Create consumption row first to get ID, then record movement atomically
        consumption = await self.repo.create_consumption(data)
        coordinator = InventoryCoordinator(self.db)
        try:
            await coordinator.record_out_async(
                item_id=feed_item.stock_item_id,
                quantity=data.quantity,
                reference_type=ReferenceType.FEED_CONSUMPTION.value,
                reference_id=consumption.id,
                notes=f"Feed consumption by batch {batch.batch_number}",
            )
        except HTTPException as e:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail=f"Cannot record stock movement for feed consumption: {e.detail}")

        await self.db.commit()
        return FeedConsumptionOut.model_validate(consumption)

    async def get_formulations(self) -> list[FeedFormulationOut]:
        result = await self.db.execute(
            select(FeedFormulation)
            .options(
                selectinload(FeedFormulation.ingredients).selectinload(FeedFormulationIngredient.feed_item),
            )
            .order_by(FeedFormulation.stage, FeedFormulation.name)
        )
        return [FeedFormulationOut.model_validate(item) for item in result.scalars().all()]

    async def create_formulation(self, data: FeedFormulationCreate) -> FeedFormulationOut:
        total_percentage = round(sum(item.percentage for item in data.ingredients), 4)
        if total_percentage != 100:
            raise HTTPException(status_code=422, detail="Ingredient percentages must total exactly 100%.")

        item_ids = [item.feed_item_id for item in data.ingredients]
        items_result = await self.db.execute(select(FeedItem).where(FeedItem.id.in_(item_ids)))
        feed_items = {item.id: item for item in items_result.scalars().all()}
        missing = [item_id for item_id in item_ids if item_id not in feed_items]
        if missing:
            raise HTTPException(status_code=400, detail=f"Unknown feed item(s): {', '.join(map(str, missing))}")

        cost_per_kg = 0.0
        for ingredient in data.ingredients:
            feed_item = feed_items[ingredient.feed_item_id]
            cost_per_kg += (float(getattr(feed_item, "reorder_threshold", 0) or 0) * ingredient.percentage) / 100

        formulation = FeedFormulation(
            name=data.name,
            stage=data.stage,
            texture=data.texture,
            output_quantity_kg=data.output_quantity_kg,
            cost_per_kg=cost_per_kg,
        )
        self.db.add(formulation)
        await self.db.flush()
        for ingredient in data.ingredients:
            self.db.add(
                FeedFormulationIngredient(
                    formulation_id=formulation.id,
                    feed_item_id=ingredient.feed_item_id,
                    percentage=ingredient.percentage,
                )
            )
        await self.db.commit()

        refreshed = await self.db.execute(
            select(FeedFormulation)
            .where(FeedFormulation.id == formulation.id)
            .options(selectinload(FeedFormulation.ingredients).selectinload(FeedFormulationIngredient.feed_item))
        )
        return FeedFormulationOut.model_validate(refreshed.scalar_one())

    async def get_productions(self) -> list[FeedProductionOut]:
        result = await self.db.execute(select(FeedProductionBatch).order_by(FeedProductionBatch.produced_at.desc()))
        return [FeedProductionOut.model_validate(item) for item in result.scalars().all()]

    async def create_production(self, data: FeedProductionCreate) -> FeedProductionOut:
        result = await self.db.execute(
            select(FeedFormulation)
            .where(FeedFormulation.id == data.formulation_id)
            .options(selectinload(FeedFormulation.ingredients).selectinload(FeedFormulationIngredient.feed_item))
        )
        formulation = result.scalar_one_or_none()
        if not formulation:
            raise HTTPException(status_code=404, detail="Feed formulation not found.")

        coordinator = InventoryCoordinator(self.db)

        # Prepare ingredients and ensure stock linkage
        deductions: list[tuple[FeedItem, float]] = []
        for ingredient in formulation.ingredients:
            required_kg = data.output_quantity_kg * (ingredient.percentage / 100)
            feed_item = ingredient.feed_item
            await self._ensure_feed_stock_item(feed_item)
            deductions.append((feed_item, required_kg))

        category_result = await self.db.execute(select(FeedCategory).where(FeedCategory.name == "Finished Feed"))
        finished_category = category_result.scalar_one_or_none()
        if not finished_category:
            finished_category = FeedCategory(name="Finished Feed", description="Finished poultry feed produced from formulas.")
            self.db.add(finished_category)
            await self.db.flush()

        output_name = f"{formulation.stage} {formulation.texture} Feed"
        output_result = await self.db.execute(select(FeedItem).where(FeedItem.name == output_name))
        output_item = output_result.scalar_one_or_none()
        if not output_item:
            output_item = FeedItem(
                name=output_name,
                category_id=finished_category.id,
                unit="kg",
                current_stock=0,
                reorder_threshold=0,
            )
            self.db.add(output_item)
            await self.db.flush()
        # Ensure output item has stock linkage
        await self._ensure_feed_stock_item(output_item, StockCategory.FINISHED_PRODUCT)

        # Create production batch first to obtain ID
        batch = FeedProductionBatch(
            batch_number=f"FPB-{uuid.uuid4().hex[:10].upper()}",
            formulation_id=formulation.id,
            output_item_id=output_item.id,
            output_quantity_kg=data.output_quantity_kg,
            cost_per_kg=formulation.cost_per_kg,
            notes=data.notes,
        )
        self.db.add(batch)
        await self.db.flush()

        # Record stock movements for ingredients (OUT movements), referencing batch
        for feed_item, required_kg in deductions:
            try:
                await coordinator.record_out_async(
                    item_id=feed_item.stock_item_id,
                    quantity=required_kg,
                    reference_type=ReferenceType.FEED_PRODUCTION_INPUT.value,
                    reference_id=batch.id,
                    notes=f"Feed production input: {feed_item.name}",
                )
            except HTTPException as e:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Cannot record stock movement for production input: {e.detail}")

        # Record stock movement for output (IN movement)
        try:
            await coordinator.record_in_async(
                item_id=output_item.stock_item_id,
                quantity=data.output_quantity_kg,
                reference_type=ReferenceType.FEED_PRODUCTION_OUTPUT.value,
                reference_id=batch.id,
                unit_cost=formulation.cost_per_kg,
                notes=f"Feed production output: {output_name}",
            )
        except HTTPException as e:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail=f"Cannot record stock movement for production output: {e.detail}")

        await self.db.commit()
        await self.db.refresh(batch)
        return FeedProductionOut.model_validate(batch)
