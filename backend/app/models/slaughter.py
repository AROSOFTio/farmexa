from datetime import datetime, timezone
import enum

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.enums import db_enum


class SlaughterStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class QualityInspectionStatus(str, enum.Enum):
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    REWORK = "rework"


class SlaughterApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class SlaughterRecord(Base):
    __tablename__ = "slaughter_records"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    slaughter_date = Column(Date, nullable=False)
    status = Column(db_enum(SlaughterStatus, name="slaughterstatus"), default=SlaughterStatus.SCHEDULED, nullable=False)

    live_birds_count = Column(Integer, nullable=False)
    mortality_birds_count = Column(Integer, default=0, nullable=False)
    total_live_weight = Column(Float, nullable=False)
    average_live_weight = Column(Float, nullable=True)
    total_dressed_weight = Column(Float, nullable=True)
    average_dressed_weight = Column(Float, nullable=True)
    yield_percentage = Column(Float, nullable=True)
    loss_percentage = Column(Float, nullable=True)

    waste_weight = Column(Float, default=0.0)
    condemned_birds_count = Column(Integer, default=0)
    blood_weight = Column(Float, default=0.0)
    feathers_weight = Column(Float, default=0.0)
    offal_weight = Column(Float, default=0.0)
    head_weight = Column(Float, default=0.0)
    feet_weight = Column(Float, default=0.0)
    reusable_byproducts_weight = Column(Float, default=0.0)
    waste_disposal_notes = Column(Text, nullable=True)
    quality_inspection_status = Column(
        db_enum(QualityInspectionStatus, name="qualityinspectionstatus"),
        default=QualityInspectionStatus.PENDING,
        nullable=False,
    )
    cold_room_location = Column(String(120), nullable=True)
    approval_status = Column(
        db_enum(SlaughterApprovalStatus, name="slaughterapprovalstatus"),
        default=SlaughterApprovalStatus.PENDING,
        nullable=False,
    )
    approved_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    inventory_posted_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    batch = relationship("Batch")
    outputs = relationship("SlaughterOutput", back_populates="slaughter_record", cascade="all, delete-orphan")


class SlaughterOutput(Base):
    __tablename__ = "slaughter_outputs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    slaughter_record_id = Column(Integer, ForeignKey("slaughter_records.id"), nullable=False)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    output_type = Column(String(50), nullable=False, default="finished_product")
    quantity = Column(Float, nullable=False)
    unit_cost = Column(Float, nullable=True)
    total_cost = Column(Float, nullable=True)

    slaughter_record = relationship("SlaughterRecord", back_populates="outputs")
    stock_item = relationship("StockItem")
