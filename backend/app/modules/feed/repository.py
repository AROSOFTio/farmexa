from typing import Sequence
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.feed import Supplier, FeedCategory, FeedItem, FeedPurchase, FeedPurchaseItem, FeedConsumption
from app.modules.feed.schemas import (
    SupplierCreate, SupplierUpdate,
    FeedCategoryCreate, FeedCategoryUpdate,
    FeedItemCreate, FeedItemUpdate,
    FeedPurchaseCreate, FeedConsumptionCreate
)

class FeedRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Suppliers ────────────────────────────────────────────────
    async def get_suppliers(self) -> Sequence[Supplier]:
        res = await self.db.execute(select(Supplier).order_by(Supplier.name))
        return res.scalars().all()

    async def get_supplier(self, supplier_id: int) -> Supplier | None:
        res = await self.db.execute(select(Supplier).where(Supplier.id == supplier_id))
        return res.scalar_one_or_none()

    async def create_supplier(self, data: SupplierCreate) -> Supplier:
        supplier = Supplier(**data.model_dump())
        self.db.add(supplier)
        await self.db.flush()
        return supplier

    async def update_supplier(self, supplier: Supplier, data: SupplierUpdate) -> Supplier:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(supplier, key, value)
        await self.db.flush()
        return supplier

    # ── Categories ───────────────────────────────────────────────
    async def get_categories(self) -> Sequence[FeedCategory]:
        res = await self.db.execute(select(FeedCategory).order_by(FeedCategory.name))
        return res.scalars().all()

    async def get_category(self, category_id: int) -> FeedCategory | None:
        res = await self.db.execute(select(FeedCategory).where(FeedCategory.id == category_id))
        return res.scalar_one_or_none()

    async def create_category(self, data: FeedCategoryCreate) -> FeedCategory:
        category = FeedCategory(**data.model_dump())
        self.db.add(category)
        await self.db.flush()
        return category

    async def update_category(self, category: FeedCategory, data: FeedCategoryUpdate) -> FeedCategory:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(category, key, value)
        await self.db.flush()
        return category

    # ── Items ────────────────────────────────────────────────────
    async def get_items(self) -> Sequence[FeedItem]:
        res = await self.db.execute(
            select(FeedItem).options(selectinload(FeedItem.category)).order_by(FeedItem.name)
        )
        return res.scalars().all()

    async def get_item(self, item_id: int) -> FeedItem | None:
        res = await self.db.execute(
            select(FeedItem).where(FeedItem.id == item_id).options(selectinload(FeedItem.category))
        )
        return res.scalar_one_or_none()

    async def create_item(self, data: FeedItemCreate) -> FeedItem:
        item = FeedItem(**data.model_dump())
        self.db.add(item)
        await self.db.flush()
        return item

    async def update_item(self, item: FeedItem, data: FeedItemUpdate) -> FeedItem:
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(item, key, value)
        await self.db.flush()
        return item

    # ── Purchases ────────────────────────────────────────────────
    async def get_purchases(self) -> Sequence[FeedPurchase]:
        res = await self.db.execute(
            select(FeedPurchase)
            .options(selectinload(FeedPurchase.supplier), selectinload(FeedPurchase.items))
            .order_by(FeedPurchase.purchase_date.desc())
        )
        return res.scalars().all()

    async def get_purchase(self, purchase_id: int) -> FeedPurchase | None:
        res = await self.db.execute(
            select(FeedPurchase)
            .where(FeedPurchase.id == purchase_id)
            .options(selectinload(FeedPurchase.supplier), selectinload(FeedPurchase.items))
        )
        return res.scalar_one_or_none()

    async def create_purchase(self, purchase_data: dict, items_data: list[dict]) -> FeedPurchase:
        purchase = FeedPurchase(**purchase_data)
        self.db.add(purchase)
        await self.db.flush()

        for i_data in items_data:
            item = FeedPurchaseItem(**i_data, purchase_id=purchase.id)
            self.db.add(item)
            
            # Update stock
            feed_item = await self.get_item(item.feed_item_id)
            if feed_item:
                feed_item.current_stock += item.quantity

        await self.db.flush()
        return purchase

    # ── Consumptions ─────────────────────────────────────────────
    async def get_consumptions(self, batch_id: int = None) -> Sequence[FeedConsumption]:
        stmt = select(FeedConsumption).order_by(FeedConsumption.record_date.desc())
        if batch_id:
            stmt = stmt.where(FeedConsumption.batch_id == batch_id)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def create_consumption(self, data: FeedConsumptionCreate) -> FeedConsumption:
        consumption = FeedConsumption(**data.model_dump())
        self.db.add(consumption)

        # Update stock
        feed_item = await self.get_item(consumption.feed_item_id)
        if feed_item:
            feed_item.current_stock -= consumption.quantity

        await self.db.flush()
        return consumption
