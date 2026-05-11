import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models.feed import FeedCategory, FeedFormulation, FeedFormulationIngredient, FeedItem, FeedProductionBatch
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

class FeedService:
    def __init__(self, db: AsyncSession):
        self.repo = FeedRepository(db)
        self.farm_repo = FarmRepository(db)
        self.db = db

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

    # ── Items ────────────────────────────────────────────────────
    async def get_items(self) -> list[FeedItemOut]:
        items = await self.repo.get_items()
        return [FeedItemOut.model_validate(i) for i in items]

    async def create_item(self, data: FeedItemCreate) -> FeedItemOut:
        cat = await self.repo.get_category(data.category_id)
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category_id")
        item = await self.repo.create_item(data)
        await self.db.commit()
        item = await self.repo.get_item(item.id)
        return FeedItemOut.model_validate(item)

    # ── Purchases ────────────────────────────────────────────────
    async def get_purchases(self) -> list[FeedPurchaseOut]:
        items = await self.repo.get_purchases()
        return [FeedPurchaseOut.model_validate(i) for i in items]

    async def create_purchase(self, data: FeedPurchaseCreate) -> FeedPurchaseOut:
        supplier = await self.repo.get_supplier(data.supplier_id)
        if not supplier:
            raise HTTPException(status_code=400, detail="Invalid supplier_id")
            
        purchase_data = data.model_dump(exclude={"items"})
        items_data = [item.model_dump() for item in data.items]

        purchase = await self.repo.create_purchase(purchase_data, items_data)
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
            
        if feed_item.current_stock < data.quantity:
            raise HTTPException(status_code=400, detail="Insufficient feed stock")

        consumption = await self.repo.create_consumption(data)
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

        deductions: list[tuple[FeedItem, float]] = []
        for ingredient in formulation.ingredients:
            required_kg = data.output_quantity_kg * (ingredient.percentage / 100)
            feed_item = ingredient.feed_item
            if feed_item.current_stock < required_kg:
                raise HTTPException(status_code=400, detail=f"Insufficient raw material: {feed_item.name}")
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

        for feed_item, required_kg in deductions:
            feed_item.current_stock -= required_kg
        output_item.current_stock += data.output_quantity_kg

        batch = FeedProductionBatch(
            batch_number=f"FPB-{uuid.uuid4().hex[:10].upper()}",
            formulation_id=formulation.id,
            output_item_id=output_item.id,
            output_quantity_kg=data.output_quantity_kg,
            cost_per_kg=formulation.cost_per_kg,
            notes=data.notes,
        )
        self.db.add(batch)
        await self.db.commit()
        await self.db.refresh(batch)
        return FeedProductionOut.model_validate(batch)
