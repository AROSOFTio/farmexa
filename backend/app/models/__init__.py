"""
Models package — imports all models so Alembic can detect them.
"""

from app.db.base import Base  # noqa: F401
from app.models.auth import Role, Permission, RolePermission, RefreshToken, AuditLog  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.farm import PoultryHouse, Batch, MortalityLog, VaccinationLog, GrowthLog  # noqa: F401
from app.models.feed import Supplier, FeedCategory, FeedItem, FeedPurchase, FeedPurchaseItem, FeedConsumption  # noqa: F401

__all__ = [
    "Base",
    "Role",
    "Permission",
    "RolePermission",
    "RefreshToken",
    "AuditLog",
    "User",
    "PoultryHouse",
    "Batch",
    "MortalityLog",
    "VaccinationLog",
    "GrowthLog",
    "Supplier",
    "FeedCategory",
    "FeedItem",
    "FeedPurchase",
    "FeedPurchaseItem",
    "FeedConsumption",
]
