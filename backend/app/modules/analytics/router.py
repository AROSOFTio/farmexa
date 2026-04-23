from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.modules.analytics import schemas, service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def resolve_dates(start_date: date | None, end_date: date | None) -> tuple[date, date]:
    resolved_end = end_date or date.today()
    resolved_start = start_date or (resolved_end - timedelta(days=30))
    return resolved_start, resolved_end


@router.get("/kpis", response_model=schemas.KPIDashboardOut)
async def get_kpis(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("dashboard:read")),
):
    resolved_start, resolved_end = resolve_dates(start_date, end_date)
    return await service.analytics_service.get_kpi_dashboard(db, resolved_start, resolved_end)


@router.get("/profit", response_model=schemas.ProfitDashboardOut)
async def get_profit_timeline(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports:read")),
):
    resolved_start, resolved_end = resolve_dates(start_date, end_date)
    return await service.analytics_service.get_profit_timeline(db, resolved_start, resolved_end)


@router.get("/sales", response_model=schemas.SalesReportOut)
async def get_sales_report(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("reports:read")),
):
    resolved_start, resolved_end = resolve_dates(start_date, end_date)
    return await service.analytics_service.get_sales_report(db, resolved_start, resolved_end)
