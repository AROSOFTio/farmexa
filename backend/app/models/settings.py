import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, UniqueConstraint

from app.db.base import Base
from app.db.enums import db_enum


class ProductCatalog(Base):
    __tablename__ = "product_catalog"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    sku = Column(String, unique=True, index=True, nullable=True)
    description = Column(Text, nullable=True)
    base_price = Column(Float, default=0.0, nullable=False)
    wholesale_price = Column(Float, default=0.0, nullable=False)
    is_active = Column(Boolean, default=True)


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
    description = Column(Text, nullable=True)


class ReferenceDataType(str, enum.Enum):
    BATCH_BREED = "batch_breed"
    BATCH_SOURCE = "batch_source"
    MORTALITY_CAUSE = "mortality_cause"
    VACCINE = "vaccine"


class ReferenceItem(Base):
    __tablename__ = "reference_items"
    __table_args__ = (
        UniqueConstraint("reference_type", "code", name="uq_reference_items_type_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    reference_type = Column(db_enum(ReferenceDataType, name="referencedatatype"), index=True, nullable=False)
    code = Column(String(100), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
