from datetime import date, datetime
from typing import Optional
from sqlalchemy import String, Integer, Date, ForeignKey, Numeric, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.farm import Batch


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    purchases: Mapped[list["FeedPurchase"]] = relationship("FeedPurchase", back_populates="supplier")


class FeedCategory(Base):
    __tablename__ = "feed_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    items: Mapped[list["FeedItem"]] = relationship("FeedItem", back_populates="category")


class FeedItem(Base):
    __tablename__ = "feed_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("feed_categories.id"))
    unit: Mapped[str] = mapped_column(String(50), default="kg")
    current_stock: Mapped[float] = mapped_column(Float, default=0.0)
    reorder_threshold: Mapped[float] = mapped_column(Float, default=0.0)

    category: Mapped["FeedCategory"] = relationship("FeedCategory", back_populates="items")
    purchases: Mapped[list["FeedPurchaseItem"]] = relationship("FeedPurchaseItem", back_populates="feed_item")
    consumptions: Mapped[list["FeedConsumption"]] = relationship("FeedConsumption", back_populates="feed_item")


class FeedPurchase(Base):
    __tablename__ = "feed_purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"))
    purchase_date: Mapped[date] = mapped_column(Date)
    invoice_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="purchases")
    items: Mapped[list["FeedPurchaseItem"]] = relationship("FeedPurchaseItem", back_populates="purchase", cascade="all, delete-orphan")


class FeedPurchaseItem(Base):
    __tablename__ = "feed_purchase_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("feed_purchases.id"))
    feed_item_id: Mapped[int] = mapped_column(ForeignKey("feed_items.id"))
    quantity: Mapped[float] = mapped_column(Float)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2))
    total_price: Mapped[float] = mapped_column(Numeric(12, 2))

    purchase: Mapped["FeedPurchase"] = relationship("FeedPurchase", back_populates="items")
    feed_item: Mapped["FeedItem"] = relationship("FeedItem", back_populates="purchases")


class FeedConsumption(Base):
    __tablename__ = "feed_consumptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    feed_item_id: Mapped[int] = mapped_column(ForeignKey("feed_items.id"))
    record_date: Mapped[date] = mapped_column(Date)
    quantity: Mapped[float] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    batch: Mapped["Batch"] = relationship("Batch")
    feed_item: Mapped["FeedItem"] = relationship("FeedItem", back_populates="consumptions")
