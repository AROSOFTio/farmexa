"""
Main API v1 router — aggregates all module routers.
"""

from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.analytics.router import router as analytics_router
from app.modules.farm.router import router as farm_router
from app.modules.feed.router import router as feed_router

api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(analytics_router)
api_router.include_router(farm_router)
api_router.include_router(feed_router)
