"""
Branch and Access Control Models

Implements multi-branch architecture allowing a single tenant to manage multiple
physical locations with explicit user access control per branch.
"""

from datetime import datetime, timezone
import enum

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.enums import db_enum


class BranchType(str, enum.Enum):
    HEAD_OFFICE = "head_office"
    FARM = "farm"
    HATCHERY = "hatchery"
    PROCESSING_PLANT = "processing_plant"
    RETAIL = "retail"
    WAREHOUSE = "warehouse"


class Branch(Base):
    __tablename__ = "branches"
    __table_args__ = (
        UniqueConstraint("branch_code", "tenant_id", name="uq_branch_code_tenant"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_code = Column(String(50), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    type = Column(db_enum(BranchType, name="branchtype"), nullable=False, default=BranchType.FARM)
    address = Column(Text, nullable=True)
    contact_person = Column(String(100), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)  # e.g., Head Office
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    tenant = relationship("Tenant", backref="branches")
    user_access = relationship("UserBranchAccess", back_populates="branch", cascade="all, delete-orphan")


class UserBranchAccess(Base):
    """Maps users to branches they are allowed to access for operations."""
    __tablename__ = "user_branch_access"
    __table_args__ = (
        UniqueConstraint("user_id", "branch_id", name="uq_user_branch_access"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    granted_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    granted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id], backref="branch_accesses")
    branch = relationship("Branch", back_populates="user_access")
    granted_by = relationship("User", foreign_keys=[granted_by_id])
