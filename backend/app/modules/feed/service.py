from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.modules.feed.repository import FeedRepository
from app.modules.feed.schemas import (
    SupplierCreate, SupplierUpdate, SupplierOut,
    FeedCategoryCreate, FeedCategoryUpdate, FeedCategoryOut,
    FeedItemCreate, FeedItemUpdate, FeedItemOut,
    FeedPurchaseCreate, FeedPurchaseOut,
    FeedConsumptionCreate, FeedConsumptionOut
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
        item = await self.repo.create_supplier(data)
        await self.db.commit()
        return SupplierOut.model_validate(item)

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
