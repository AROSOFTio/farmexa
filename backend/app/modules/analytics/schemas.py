from pydantic import BaseModel
from typing import List
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


class DashboardKPIOut(BaseModel):
    total_birds: int
    active_houses: int
    total_houses: int
    feed_stock_kg: float
    feed_used_today_kg: float
    mortality_today: int
    mortality_rate_today: float
    eggs_today: int
    meat_stock_kg: float
    sales_today: float
    compliance_alerts: int


class FeedStockRowOut(BaseModel):
    id: int
    name: str
    category: str
    unit: str
    current_stock: float
    reorder_threshold: float
    status: str


class HouseOverviewRowOut(BaseModel):
    id: int
    name: str
    birds: int
    active_batches: int
    feed_today_kg: float
    mortality_today: int
    vaccination_due: int
    status: str


class SlaughterOverviewRowOut(BaseModel):
    id: int
    product: str
    kg: float
    unit: str
    status: str


class TransferOverviewRowOut(BaseModel):
    id: int
    reference: str
    movement_type: str
    item: str
    quantity: float
    unit: str
    status: str
    created_at: str


class ComplianceOverviewRowOut(BaseModel):
    id: int
    title: str
    document_type: str
    expiry_date: date | None
    days_left: int | None
    status: str


class SalesOverviewOut(BaseModel):
    cash_sales: float
    mobile_money_sales: float
    bank_sales: float
    pending_payments: float
    orders_today: int
    top_product: str | None


class SlaughterSummaryOut(BaseModel):
    birds_received_today: int
    dressed_weight_today_kg: float
    average_yield_percentage: float
    byproducts_kg: float


class DashboardOverviewOut(BaseModel):
    kpis: DashboardKPIOut
    feed_stock: list[FeedStockRowOut]
    houses: list[HouseOverviewRowOut]
    slaughter_stock: list[SlaughterOverviewRowOut]
    sales: SalesOverviewOut
    recent_transfers: list[TransferOverviewRowOut]
    compliance_documents: list[ComplianceOverviewRowOut]
    slaughter_summary: SlaughterSummaryOut
