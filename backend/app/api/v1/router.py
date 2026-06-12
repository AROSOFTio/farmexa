"""
Main API v1 router — aggregates all module routers.
"""

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.analytics.router import router as analytics_router
from app.modules.farm.router import router as farm_router
from app.modules.feed.router import router as feed_router
from app.modules.inventory.router import router as inventory_router
from app.modules.inventory.branch_transfer_router import router as branch_transfer_router
from app.modules.slaughter.router import router as slaughter_router
from app.modules.sales.router import router as sales_router
from app.modules.finance.router import router as finance_router
from app.modules.compliance.router import router as compliance_router
from app.modules.settings.router import router as settings_router
from app.modules.platform.router import router as platform_router
from app.modules.egg_production.router import router as egg_production_router
from app.modules.developer_admin.router import router as developer_admin_router
from app.modules.subscriptions.router import router as subscriptions_router
from app.modules.affiliates.router import router as affiliates_router
from app.modules.reports.router import router as reports_router
from app.modules.accounting.router import router as accounting_router
from app.modules.health_safety.router import router as health_safety_router
from app.modules.hr.router import router as hr_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(analytics_router)
api_router.include_router(farm_router)
api_router.include_router(feed_router)
api_router.include_router(inventory_router)
api_router.include_router(branch_transfer_router)
api_router.include_router(slaughter_router)
api_router.include_router(sales_router)
api_router.include_router(finance_router)
api_router.include_router(compliance_router)
api_router.include_router(settings_router)
api_router.include_router(platform_router)
api_router.include_router(egg_production_router)
api_router.include_router(developer_admin_router)
api_router.include_router(subscriptions_router)
api_router.include_router(affiliates_router)
api_router.include_router(reports_router)
api_router.include_router(accounting_router)
api_router.include_router(health_safety_router)
api_router.include_router(hr_router)
