from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.db.base import Base

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

class StockItem(Base):
    __tablename__ = "stock_items"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, index=True, nullable=False)
    category = Column(Enum(StockCategory), nullable=False)
    unit_of_measure = Column(String, nullable=False) # e.g., kg, pieces, bottles
    
    current_quantity = Column(Float, default=0.0, nullable=False)
    reorder_level = Column(Float, default=0.0, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False) # Standard/base selling price if applicable
    average_cost = Column(Float, default=0.0, nullable=False) # Moving average cost
    
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    movements = relationship("StockMovement", back_populates="item")

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    movement_type = Column(Enum(MovementType), nullable=False)
    quantity = Column(Float, nullable=False) # absolute quantity
    previous_quantity = Column(Float, nullable=False)
    new_quantity = Column(Float, nullable=False)
    
    reference_type = Column(String, nullable=True) # e.g., "slaughter", "sale", "purchase", "manual"
    reference_id = Column(Integer, nullable=True)  # ID of the related record
    
    unit_cost = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    item = relationship("StockItem", back_populates="movements")
