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
    branch_id = Column(Integer, ForeignKey("branches.id"), index=True, nullable=True)
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
    branch_id = Column(Integer, ForeignKey("branches.id"), index=True, nullable=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), index=True, nullable=True)
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


class StoreLocationType(str, enum.Enum):
    MAIN_STORE = "main_store"
    FEED_STORE = "feed_store"
    MEDICINE_STORE = "medicine_store"
    POULTRY_HOUSE = "poultry_house"
    SLAUGHTER_AREA = "slaughter_area"
    COLD_ROOM = "cold_room"
    SALES_STORE = "sales_store"
    OTHER = "other"


class StoreLocation(Base):
    __tablename__ = "store_locations"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), index=True, nullable=True)
    name = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)
    type = Column(db_enum(StoreLocationType, name="storelocationtype"), nullable=False, default=StoreLocationType.OTHER)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class GIVStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    ISSUED = "issued"
    CANCELLED = "cancelled"


class GoodsIssueVoucher(Base):
    __tablename__ = "goods_issue_vouchers"

    id = Column(Integer, primary_key=True, index=True)
    giv_number = Column(String, unique=True, index=True, nullable=False)
    item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False, default="kg")
    from_store_location_id = Column(Integer, ForeignKey("store_locations.id"), nullable=False)
    destination = Column(String, nullable=True)
    purpose = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(db_enum(GIVStatus, name="givstatus"), nullable=False, default=GIVStatus.DRAFT)
    issued_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    issued_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    item = relationship("StockItem")
    from_store_location = relationship("StoreLocation", foreign_keys=[from_store_location_id])
    issued_by = relationship("User", foreign_keys=[issued_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class GRNStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class GoodsReceivedNote(Base):
    __tablename__ = "goods_received_notes"

    id = Column(Integer, primary_key=True, index=True)
    grn_number = Column(String, unique=True, index=True, nullable=False)
    item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False, default="kg")
    received_into_store_location_id = Column(Integer, ForeignKey("store_locations.id"), nullable=False)
    source_type = Column(String, nullable=False, default="supplier")  # supplier, internal_transfer, return, other
    supplier_reference = Column(String, nullable=True)
    unit_cost = Column(Float, nullable=True, default=0.0)
    notes = Column(Text, nullable=True)
    status = Column(db_enum(GRNStatus, name="grnstatus"), nullable=False, default=GRNStatus.DRAFT)
    received_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    item = relationship("StockItem")
    received_into_store_location = relationship("StoreLocation", foreign_keys=[received_into_store_location_id])
    received_by = relationship("User", foreign_keys=[received_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])

