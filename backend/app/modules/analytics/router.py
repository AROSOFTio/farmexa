from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, timedelta
from app.db.session import get_sync_db
from . import schemas, service

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/kpis", response_model=schemas.KPIDashboardOut)
def get_kpis(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    end_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_sync_db)
):
    return service.analytics_service.get_kpi_dashboard(db, start_date, end_date)

@router.get("/profit", response_model=schemas.ProfitDashboardOut)
def get_profit_timeline(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    end_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_sync_db)
):
    return service.analytics_service.get_profit_timeline(db, start_date, end_date)

@router.get("/sales", response_model=schemas.SalesReportOut)
def get_sales_report(
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=30)),
    end_date: date = Query(default_factory=date.today),
    db: Session = Depends(get_sync_db)
):
    return service.analytics_service.get_sales_report(db, start_date, end_date)
