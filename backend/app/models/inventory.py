from datetime import datetime, timezone
import enum

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.enums import db_enum


class StockCategory(str, enum.Enum):
    RAW_MATERIAL = "raw_material"
    PACKAGING = "packaging"
    MEDICINE = "medicine"
    FINISHED_PRODUCT = "finished_product"
    OTHER = "other"


class MovementType(str, enum.Enum):
    IN = "in"
    OUT = "out"
    ADJUSTMENT = "adjustment"


class TransferStatus(str, enum.Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class TransferType(str, enum.Enum):
    GIV = "giv"
    GRN = "grn"


class StockItem(Base):
    __tablename__ = "stock_items"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    category = Column(db_enum(StockCategory, name="stockcategory"), nullable=False)
    unit_of_measure = Column(String, nullable=False)

    current_quantity = Column(Float, default=0.0, nullable=False)
    reorder_level = Column(Float, default=0.0, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    average_cost = Column(Float, default=0.0, nullable=False)

    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    movements = relationship("StockMovement", back_populates="item")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    movement_type = Column(db_enum(MovementType, name="movementtype"), nullable=False)
    quantity = Column(Float, nullable=False)
    previous_quantity = Column(Float, nullable=False)
    new_quantity = Column(Float, nullable=False)

    reference_type = Column(String, nullable=True)
    reference_id = Column(Integer, nullable=True)

    unit_cost = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    item = relationship("StockItem", back_populates="movements")


class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id = Column(Integer, primary_key=True, index=True)
    reference_number = Column(String, unique=True, index=True, nullable=False)
    transfer_type = Column(db_enum(TransferType, name="transfertype"), nullable=False, default=TransferType.GIV)
    item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False, default="kg")
    from_location = Column(String, nullable=False)
    to_location = Column(String, nullable=False)
    status = Column(db_enum(TransferStatus, name="transferstatus"), nullable=False, default=TransferStatus.DRAFT)
    notes = Column(Text, nullable=True)
    issued_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    item = relationship("StockItem")
