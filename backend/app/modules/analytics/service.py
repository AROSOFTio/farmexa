from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from app.models.sales import Order, Invoice, Customer, Payment, InvoiceStatus
from app.models.finance import Expense
from app.models.slaughter import SlaughterRecord
from . import schemas

class AnalyticsService:
    def get_kpi_dashboard(self, db: Session, start_date: date, end_date: date):
        # Revenue from payments
        rev = db.query(func.sum(Payment.amount)).filter(
            Payment.payment_date >= start_date, Payment.payment_date <= end_date
        ).scalar() or 0.0

        # Expenses
        exp = db.query(func.sum(Expense.amount)).filter(
            Expense.expense_date >= start_date, Expense.expense_date <= end_date
        ).scalar() or 0.0

        # Orders
        orders_count = db.query(Order).filter(
            func.date(Order.created_at) >= start_date, func.date(Order.created_at) <= end_date
        ).count()

        # Customers
        customers_count = db.query(Customer).filter(Customer.is_active == True).count()

        # Slaughter
        slaughter_birds = db.query(func.sum(SlaughterRecord.live_birds_count)).filter(
            SlaughterRecord.slaughter_date >= start_date, SlaughterRecord.slaughter_date <= end_date
        ).scalar() or 0

        return schemas.KPIDashboardOut(
            total_revenue=rev,
            total_expenses=exp,
            net_profit=rev - exp,
            total_orders=orders_count,
            active_customers=customers_count,
            total_birds_slaughtered=slaughter_birds
        )

    def get_profit_timeline(self, db: Session, start_date: date, end_date: date):
        # Build timeline
        timeline = []
        curr = start_date
        while curr <= end_date:
            rev = db.query(func.sum(Payment.amount)).filter(Payment.payment_date == curr).scalar() or 0.0
            exp = db.query(func.sum(Expense.amount)).filter(Expense.expense_date == curr).scalar() or 0.0
            timeline.append(schemas.ProfitReportRow(
                date=curr,
                revenue=rev,
                expenses=exp,
                profit=rev - exp
            ))
            curr += timedelta(days=1)
            
        kpi = self.get_kpi_dashboard(db, start_date, end_date)
        return schemas.ProfitDashboardOut(summary=kpi, timeline=timeline)

    def get_sales_report(self, db: Session, start_date: date, end_date: date):
        timeline = []
        curr = start_date
        total_rev = 0.0
        while curr <= end_date:
            orders = db.query(Order).filter(func.date(Order.created_at) == curr).count()
            rev = db.query(func.sum(Payment.amount)).filter(Payment.payment_date == curr).scalar() or 0.0
            timeline.append(schemas.SalesReportRow(
                date=curr,
                orders_count=orders,
                revenue=rev
            ))
            total_rev += rev
            curr += timedelta(days=1)
            
        return schemas.SalesReportOut(total_revenue=total_rev, timeline=timeline)

analytics_service = AnalyticsService()
