"""
Inter-Branch Transfer Models

Tracks the movement of inventory stock between branches.
Transfers go into a virtual 'transit' state until received by the destination branch.
"""

from datetime import datetime, timezone
import enum

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.enums import db_enum


class TransferStatus(str, enum.Enum):
    PENDING = "pending"          # Draft transfer, not yet shipped
    IN_TRANSIT = "in_transit"    # Stock deducted from source, not yet at destination
    COMPLETED = "completed"      # Stock received at destination via GRN
    REJECTED = "rejected"        # Transfer rejected by destination
    CANCELLED = "cancelled"      # Transfer cancelled before shipping


class BranchTransfer(Base):
    __tablename__ = "branch_transfers"
    __table_args__ = (
        UniqueConstraint("transfer_number", "tenant_id", name="uq_transfer_number_tenant"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    transfer_number = Column(String(50), nullable=False, index=True)
    
    from_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    to_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    
    status = Column(db_enum(TransferStatus, name="transferstatus"), nullable=False, default=TransferStatus.PENDING)
    
    initiated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    dispatched_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    received_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    transfer_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    dispatch_date = Column(DateTime(timezone=True), nullable=True)
    receive_date = Column(DateTime(timezone=True), nullable=True)
    
    notes = Column(Text, nullable=True)
    vehicle_registration = Column(String(50), nullable=True)
    driver_name = Column(String(100), nullable=True)
    
    # Relationships
    from_branch = relationship("Branch", foreign_keys=[from_branch_id])
    to_branch = relationship("Branch", foreign_keys=[to_branch_id])
    items = relationship("BranchTransferItem", back_populates="transfer", cascade="all, delete-orphan")


class BranchTransferItem(Base):
    __tablename__ = "branch_transfer_items"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("branch_transfers.id", ondelete="CASCADE"), nullable=False, index=True)
    stock_item_id = Column(Integer, ForeignKey("stock_items.id"), nullable=False)
    
    quantity_shipped = Column(Float, nullable=False)
    quantity_received = Column(Float, nullable=True)
    
    notes = Column(String(255), nullable=True)
    
    transfer = relationship("BranchTransfer", back_populates="items")
    stock_item = relationship("StockItem")
