from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.finance import Expense
from app.models.sales import Customer, Order, Payment
from app.models.slaughter import SlaughterRecord

from . import schemas


class AnalyticsService:
    async def get_kpi_dashboard(
        self,
        db: AsyncSession,
        start_date: date,
        end_date: date,
    ) -> schemas.KPIDashboardOut:
        revenue_stmt = select(func.coalesce(func.sum(Payment.amount), 0.0)).where(
            Payment.payment_date >= start_date,
            Payment.payment_date <= end_date,
        )
        expense_stmt = select(func.coalesce(func.sum(Expense.amount), 0.0)).where(
            Expense.expense_date >= start_date,
            Expense.expense_date <= end_date,
        )
        orders_stmt = select(func.count(Order.id)).where(
            func.date(Order.created_at) >= start_date,
            func.date(Order.created_at) <= end_date,
        )
        customers_stmt = select(func.count(Customer.id)).where(Customer.is_active.is_(True))
        slaughter_stmt = select(func.coalesce(func.sum(SlaughterRecord.live_birds_count), 0)).where(
            SlaughterRecord.slaughter_date >= start_date,
            SlaughterRecord.slaughter_date <= end_date,
        )

        total_revenue = float((await db.execute(revenue_stmt)).scalar() or 0.0)
        total_expenses = float((await db.execute(expense_stmt)).scalar() or 0.0)
        total_orders = int((await db.execute(orders_stmt)).scalar() or 0)
        active_customers = int((await db.execute(customers_stmt)).scalar() or 0)
        total_birds_slaughtered = int((await db.execute(slaughter_stmt)).scalar() or 0)

        return schemas.KPIDashboardOut(
            total_revenue=total_revenue,
            total_expenses=total_expenses,
            net_profit=total_revenue - total_expenses,
            total_orders=total_orders,
            active_customers=active_customers,
            total_birds_slaughtered=total_birds_slaughtered,
        )

    async def get_profit_timeline(
        self,
        db: AsyncSession,
        start_date: date,
        end_date: date,
    ) -> schemas.ProfitDashboardOut:
        timeline: list[schemas.ProfitReportRow] = []
        cursor = start_date

        while cursor <= end_date:
            revenue_stmt = select(func.coalesce(func.sum(Payment.amount), 0.0)).where(
                Payment.payment_date == cursor
            )
            expense_stmt = select(func.coalesce(func.sum(Expense.amount), 0.0)).where(
                Expense.expense_date == cursor
            )

            revenue = float((await db.execute(revenue_stmt)).scalar() or 0.0)
            expenses = float((await db.execute(expense_stmt)).scalar() or 0.0)

            timeline.append(
                schemas.ProfitReportRow(
                    date=cursor,
                    revenue=revenue,
                    expenses=expenses,
                    profit=revenue - expenses,
                )
            )
            cursor += timedelta(days=1)

        summary = await self.get_kpi_dashboard(db, start_date, end_date)
        return schemas.ProfitDashboardOut(summary=summary, timeline=timeline)

    async def get_sales_report(
        self,
        db: AsyncSession,
        start_date: date,
        end_date: date,
    ) -> schemas.SalesReportOut:
        timeline: list[schemas.SalesReportRow] = []
        total_revenue = 0.0
        cursor = start_date

        while cursor <= end_date:
            order_count_stmt = select(func.count(Order.id)).where(func.date(Order.created_at) == cursor)
            revenue_stmt = select(func.coalesce(func.sum(Payment.amount), 0.0)).where(
                Payment.payment_date == cursor
            )

            orders_count = int((await db.execute(order_count_stmt)).scalar() or 0)
            revenue = float((await db.execute(revenue_stmt)).scalar() or 0.0)

            timeline.append(
                schemas.SalesReportRow(
                    date=cursor,
                    orders_count=orders_count,
                    revenue=revenue,
                )
            )
            total_revenue += revenue
            cursor += timedelta(days=1)

        return schemas.SalesReportOut(total_revenue=total_revenue, timeline=timeline)


analytics_service = AnalyticsService()
