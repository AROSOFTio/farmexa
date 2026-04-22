"""
Analytics/dashboard router: real summary metrics from the database.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.db.session import get_db
from app.core.deps import require_permission

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard-summary", summary="Executive dashboard KPI summary")
async def dashboard_summary(
    current_user=Depends(require_permission("dashboard:read")),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns real counts and aggregates from core tables.
    Returns zeros when tables are empty (Phase 1 — no farm data yet).
    """
    from app.models.user import User

    total_users = (await db.execute(
        select(func.count(User.id)).where(User.deleted_at.is_(None))
    )).scalar_one()

    return {
        "users": {
            "total": total_users,
            "active": (await db.execute(
                select(func.count(User.id)).where(User.deleted_at.is_(None), User.is_active.is_(True))
            )).scalar_one(),
        },
        # Phase 2+ modules — return structured zeros so dashboard widgets are consistent
        "farm": {
            "active_batches": 0,
            "total_birds": 0,
            "mortality_today": 0,
        },
        "feed": {
            "stock_items": 0,
            "low_stock_alerts": 0,
        },
        "slaughter": {
            "records_this_month": 0,
            "yield_avg_pct": None,
        },
        "sales": {
            "invoices_outstanding": 0,
            "revenue_this_month": 0,
        },
        "finance": {
            "expenses_this_month": 0,
            "income_this_month": 0,
            "net_profit_this_month": 0,
        },
    }
