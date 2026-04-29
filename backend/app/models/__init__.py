"""
Models package — imports all models so Alembic can detect them.
"""

from app.db.base import Base  # noqa: F401
from app.models.auth import Role, Permission, RolePermission, RefreshToken, AuditLog  # noqa: F401
from app.models.compliance import ComplianceDocument, DocumentReminder  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.farm import PoultryHouse, Batch, MortalityLog, VaccinationLog, GrowthLog  # noqa: F401
from app.models.feed import Supplier, FeedCategory, FeedItem, FeedPurchase, FeedPurchaseItem, FeedConsumption  # noqa: F401
from app.models.inventory import StockItem, StockMovement  # noqa: F401
from app.models.slaughter import SlaughterRecord, SlaughterOutput  # noqa: F401
from app.models.sales import Customer, Order, OrderItem, Invoice, Payment  # noqa: F401
from app.models.finance import ExpenseCategory, Expense, IncomeCategory, Income  # noqa: F401
from app.models.settings import ProductCatalog, SystemConfig  # noqa: F401
from app.models.egg_production import EggProductionLog  # noqa: F401
from app.models.tenant import (  # noqa: F401
    BillingInvoice,
    BillingPayment,
    Tenant,
    TenantModule,
    TenantModuleRequest,
    TenantModuleRequestItem,
    SubscriptionHistory,
    PlatformModule,
    PlanDefinition,
    PlanModule,
    TenantDomain,
    Subscription,
    ModulePrice,
    PaymentCallbackLog,
)

__all__ = [
    "Base",
    "Role",
    "Permission",
    "RolePermission",
    "RefreshToken",
    "AuditLog",
    "ComplianceDocument",
    "DocumentReminder",
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
    "StockItem",
    "StockMovement",
    "SlaughterRecord",
    "SlaughterOutput",
    "Customer",
    "Order",
    "OrderItem",
    "Invoice",
    "Payment",
    "ExpenseCategory",
    "Expense",
    "IncomeCategory",
    "Income",
    "ProductCatalog",
    "SystemConfig",
    "EggProductionLog",
    "BillingInvoice",
    "BillingPayment",
    "Tenant",
    "TenantModule",
    "TenantModuleRequest",
    "TenantModuleRequestItem",
    "SubscriptionHistory",
    "PlatformModule",
    "PlanDefinition",
    "PlanModule",
    "TenantDomain",
    "Subscription",
    "ModulePrice",
    "PaymentCallbackLog",
]
