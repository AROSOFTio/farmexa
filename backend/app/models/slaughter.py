from datetime import datetime, timezone
import enum

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.enums import db_enum


class SlaughterStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SlaughterRecord(Base):
    __tablename__ = "slaughter_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    slaughter_date = Column(Date, nullable=False)
    status = Column(db_enum(SlaughterStatus, name="slaughterstatus"), default=SlaughterStatus.SCHEDULED, nullable=False)

    live_birds_count = Column(Integer, nullable=False)
    total_live_weight = Column(Float, nullable=False)
    total_dressed_weight = Column(Float, nullable=True)
    yield_percentage = Column(Float, nullable=True)

    waste_weight = Column(Float, default=0.0)
    condemned_birds_count = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    batch = relationship("Batch")
    outputs = relationship("SlaughterOutput", back_populates="slaughter_record", cascade="all, delete-orphan")


class SlaughterOutput(Base):
    __tablename__ = "slaughter_outputs"

    id = Column(Integer, primary_key=True, index=True)
    slaughter_record_id = Column(Integer, ForeignKey("slaughter_records.id"), nullable=False)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=True)
    total_cost = Column(Float, nullable=True)

    slaughter_record = relationship("SlaughterRecord", back_populates="outputs")
    stock_item = relationship("StockItem")
