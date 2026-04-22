from pydantic import BaseModel
from typing import Optional, List
from datetime import date

class KPIDashboardOut(BaseModel):
    total_revenue: float
    total_expenses: float
    net_profit: float
    total_orders: int
    active_customers: int
    total_birds_slaughtered: int

class ProfitReportRow(BaseModel):
    date: date
    revenue: float
    expenses: float
    profit: float

class ProfitDashboardOut(BaseModel):
    summary: KPIDashboardOut
    timeline: List[ProfitReportRow]

class SalesReportRow(BaseModel):
    date: date
    orders_count: int
    revenue: float

class SalesReportOut(BaseModel):
    total_revenue: float
    timeline: List[SalesReportRow]
