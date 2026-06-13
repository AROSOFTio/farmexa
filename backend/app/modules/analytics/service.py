from datetime import date, timedelta

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.compliance import ComplianceDocument, ComplianceDocumentStatus
from app.models.farm import Batch, BatchStatus, MortalityLog, PoultryHouse, HouseStatus, VaccinationLog, VaccinationStatus
from app.models.egg_production import EggProductionLog
from app.models.feed import FeedConsumption, FeedItem
from app.models.finance import Expense
from app.models.inventory import StockCategory, StockItem, StockMovement
from app.models.sales import Customer, Order, Payment
from app.models.slaughter import SlaughterRecord
from app.permissions.checker import has_permission_sync

from . import schemas


class AnalyticsService:
    PLATFORM_ADMIN_ROLES = {"super_manager", "developer_admin"}

    def _can(self, user, permission_code: str) -> bool:
        return has_permission_sync(user, permission_code)

    def _has_any_module(self, user, module_keys: set[str]) -> bool:
        role_name = getattr(getattr(user, "role", None), "name", None)
        if role_name in self.PLATFORM_ADMIN_ROLES:
            return True

        tenant = getattr(user, "tenant", None)
        if tenant is None:
            return True

        modules = getattr(tenant, "modules", None)
        if not modules:
            return True

        enabled_modules = {module.module_key for module in modules if module.is_enabled}
        return not enabled_modules.isdisjoint(module_keys)

    async def get_erp_dashboard(self, db: AsyncSession, current_user) -> schemas.DashboardOverviewOut:
        today = date.today()
        soon = today + timedelta(days=7)
        can_farm = self._can(current_user, "farm:read") and self._has_any_module(
            current_user,
            {"houses", "batches", "mortality", "vaccination", "growth_tracking", "egg_production"},
        )
        can_mortality = self._can(current_user, "farm:read") and self._has_any_module(current_user, {"mortality"})
        can_eggs = self._can(current_user, "farm:read") and self._has_any_module(current_user, {"egg_production"})
        can_feed_stock = self._can(current_user, "feed:read") and self._has_any_module(current_user, {"feed_stock"})
        can_feed_usage = self._can(current_user, "feed:read") and self._has_any_module(current_user, {"feed_consumption"})
        can_inventory_movements = self._can(current_user, "inventory:read") and self._has_any_module(
            current_user,
            {"inventory_movements"},
        )
        can_inventory_stock = self._can(current_user, "inventory:read") and self._has_any_module(
            current_user,
            {"inventory_items", "meat_stock", "egg_stock", "medicine_supplies", "low_stock_alerts"},
        )
        can_slaughter = self._can(current_user, "slaughter:read") and self._has_any_module(
            current_user,
            {"slaughter_records", "slaughter_outputs", "slaughter_cut_parts", "slaughter_byproducts", "yield_analysis"},
        )
        can_sales = self._can(current_user, "sales:read") and self._has_any_module(
            current_user,
            {"customers", "sales_orders", "invoices", "payments"},
        )
        can_finance = self._can(current_user, "finance:read") and self._has_any_module(
            current_user,
            {"expenses", "income", "accounting", "profit_loss", "cash_flow"},
        )
        can_compliance = (
            self._can(current_user, "health_safety:read")
            or (
                self._can(current_user, "farm:read")
                and self._has_any_module(current_user, {"compliance_documents", "compliance_alerts"})
            )
        )

        feed_items: list[FeedItem] = []
        if can_feed_stock or can_feed_usage:
            feed_items = list(
                (
                    await db.execute(
                        select(FeedItem)
                        .options(selectinload(FeedItem.category), selectinload(FeedItem.stock_item))
                        .order_by(FeedItem.name)
                    )
                )
                .scalars()
                .all()
            )
        houses: list[PoultryHouse] = []
        if can_farm:
            houses = list(
                (await db.execute(select(PoultryHouse).options(selectinload(PoultryHouse.batches)).order_by(PoultryHouse.name)))
                .scalars()
                .unique()
                .all()
            )
        batches: list[Batch] = []
        if can_farm:
            batches = list((await db.execute(select(Batch).where(Batch.status == BatchStatus.ACTIVE))).scalars().all())
        stock_items: list[StockItem] = []
        if can_inventory_stock or can_inventory_movements or can_slaughter:
            stock_items = list((await db.execute(select(StockItem).order_by(StockItem.name))).scalars().all())

        total_birds = int(sum(batch.active_quantity or 0 for batch in batches)) if can_farm else 0
        active_houses = sum(1 for house in houses if house.status == HouseStatus.ACTIVE) if can_farm else 0
        # Feed stock is sourced only from central inventory. Unlinked feed items are treated as integrity issues.
        feed_stock = float(
            sum(
                float(item.stock_item.current_quantity or 0)
                for item in feed_items
                if item.stock_item is not None
            )
        ) if can_feed_stock else 0.0
        meat_stock = float(
            sum(
                float(item.current_quantity or 0)
                for item in stock_items
                if item.category == StockCategory.FINISHED_PRODUCT and item.is_active
            )
        ) if (can_inventory_stock or can_slaughter) else 0.0

        mortality_today = 0
        if can_mortality:
            mortality_today = int(
                (
                    await db.execute(
                        select(func.coalesce(func.sum(MortalityLog.quantity), 0)).where(MortalityLog.record_date == today)
                    )
                ).scalar()
                or 0
            )
        feed_used_today = 0.0
        if can_feed_usage:
            feed_used_today = float(
                (
                    await db.execute(
                        select(func.coalesce(func.sum(FeedConsumption.quantity), 0)).where(FeedConsumption.record_date == today)
                    )
                ).scalar()
                or 0
            )
        mortality_rate_today = round((mortality_today / total_birds * 100), 2) if can_mortality and total_birds else 0.0

        eggs_today = 0
        if can_eggs:
            eggs_today = int(
                (
                    await db.execute(
                        select(func.coalesce(func.sum(EggProductionLog.total_eggs), 0)).where(
                            EggProductionLog.record_date == today
                        )
                    )
                ).scalar()
                or 0
            )

        sales_today = 0.0
        cash_sales = 0.0
        mobile_money_sales = 0.0
        bank_sales = 0.0
        if can_finance:
            sales_today = float(
                (
                    await db.execute(
                        select(func.coalesce(func.sum(Payment.amount), 0.0)).where(Payment.payment_date == today)
                    )
                ).scalar()
                or 0.0
            )
            cash_sales = float(
                (
                    await db.execute(
                        select(func.coalesce(func.sum(Payment.amount), 0.0))
                        .where(Payment.payment_date == today)
                        .where(Payment.payment_method == "cash")
                    )
                ).scalar()
                or 0.0
            )
            mobile_money_sales = float(
                (
                    await db.execute(
                        select(func.coalesce(func.sum(Payment.amount), 0.0))
                        .where(Payment.payment_date == today)
                        .where(Payment.payment_method == "mobile_money")
                    )
                ).scalar()
                or 0.0
            )
            bank_sales = float(
                (
                    await db.execute(
                        select(func.coalesce(func.sum(Payment.amount), 0.0))
                        .where(Payment.payment_date == today)
                        .where(Payment.payment_method == "bank_transfer")
                    )
                ).scalar()
                or 0.0
            )
        orders_today = 0
        if can_sales:
            orders_today = int(
                (
                    await db.execute(select(func.count(Order.id)).where(func.date(Order.created_at) == today))
                ).scalar()
                or 0
            )

        pending_payments = 0.0
        if can_finance:
            pending_payments = float(
                (
                    await db.execute(
                        select(func.coalesce(func.sum(Order.total_amount), 0.0)).where(Order.status == "pending")
                    )
                ).scalar()
                or 0.0
            )

        compliance_docs: list[ComplianceDocument] = []
        if can_compliance:
            compliance_query = select(ComplianceDocument).order_by(
                ComplianceDocument.expiry_date.is_(None),
                ComplianceDocument.expiry_date.asc(),
                ComplianceDocument.created_at.desc(),
            )
            if getattr(current_user, "tenant_id", None):
                compliance_query = compliance_query.where(ComplianceDocument.tenant_id == current_user.tenant_id)
            compliance_docs = list((await db.execute(compliance_query.limit(8))).scalars().all())
        compliance_alerts = sum(
            1
            for doc in compliance_docs
            if doc.status in {ComplianceDocumentStatus.EXPIRING_SOON, ComplianceDocumentStatus.EXPIRED}
            or (doc.expiry_date is not None and doc.expiry_date <= soon)
        )

        slaughter_records: list[SlaughterRecord] = []
        if can_slaughter:
            slaughter_records = list(
                (
                    await db.execute(
                        select(SlaughterRecord)
                        .options(selectinload(SlaughterRecord.outputs))
                        .order_by(desc(SlaughterRecord.slaughter_date), desc(SlaughterRecord.id))
                        .limit(20)
                    )
                )
                .scalars()
                .unique()
                .all()
            )
        today_slaughter = [record for record in slaughter_records if record.slaughter_date == today]
        completed_records = [record for record in slaughter_records if record.total_dressed_weight is not None]
        birds_received_today = sum(record.live_birds_count or 0 for record in today_slaughter)
        dressed_weight_today = float(sum(record.total_dressed_weight or 0 for record in today_slaughter))
        average_yield = round(
            sum(record.yield_percentage or 0 for record in completed_records) / len(completed_records),
            1,
        ) if completed_records else 0.0
        byproducts_kg = float(
            sum(
                (record.reusable_byproducts_weight or 0)
                + (record.head_weight or 0)
                + (record.feet_weight or 0)
                + (record.offal_weight or 0)
                for record in slaughter_records
            )
        )

        movement_rows: list[StockMovement] = []
        if can_inventory_movements:
            movement_rows = list(
                (
                    await db.execute(
                        select(StockMovement)
                        .options(selectinload(StockMovement.item))
                        .order_by(desc(StockMovement.created_at), desc(StockMovement.id))
                        .limit(8)
                    )
                )
                .scalars()
                .all()
            )

        mortality_by_batch = {}
        if can_mortality:
            mortality_by_batch = {
                batch_id: int(quantity or 0)
                for batch_id, quantity in (
                    await db.execute(
                        select(MortalityLog.batch_id, func.coalesce(func.sum(MortalityLog.quantity), 0))
                        .where(MortalityLog.record_date == today)
                        .group_by(MortalityLog.batch_id)
                    )
                ).all()
            }
        feed_by_batch = {}
        if can_feed_usage:
            feed_by_batch = {
                batch_id: float(quantity or 0)
                for batch_id, quantity in (
                    await db.execute(
                        select(FeedConsumption.batch_id, func.coalesce(func.sum(FeedConsumption.quantity), 0))
                        .where(FeedConsumption.record_date == today)
                        .group_by(FeedConsumption.batch_id)
                    )
                ).all()
            }
        vaccines_by_batch = {}
        if self._can(current_user, "farm:read") and self._has_any_module(current_user, {"vaccination"}):
            vaccines_by_batch = {
                batch_id: int(count or 0)
                for batch_id, count in (
                    await db.execute(
                        select(VaccinationLog.batch_id, func.count(VaccinationLog.id))
                        .where(VaccinationLog.status == VaccinationStatus.PENDING)
                        .where(VaccinationLog.scheduled_date <= soon)
                        .group_by(VaccinationLog.batch_id)
                    )
                ).all()
            }

        house_rows: list[schemas.HouseOverviewRowOut] = []
        for house in houses[:8]:
            house_batches = [batch for batch in house.batches if batch.status == BatchStatus.ACTIVE]
            birds = sum(batch.active_quantity or 0 for batch in house_batches)
            batch_ids = {batch.id for batch in house_batches}
            house_rows.append(
                schemas.HouseOverviewRowOut(
                    id=house.id,
                    name=house.name,
                    birds=int(birds),
                    active_batches=len(house_batches),
                    feed_today_kg=sum(feed_by_batch.get(batch_id, 0.0) for batch_id in batch_ids),
                    mortality_today=sum(mortality_by_batch.get(batch_id, 0) for batch_id in batch_ids),
                    vaccination_due=sum(vaccines_by_batch.get(batch_id, 0) for batch_id in batch_ids),
                    status=house.status.value,
                )
            )

        return schemas.DashboardOverviewOut(
            kpis=schemas.DashboardKPIOut(
                total_birds=total_birds,
                active_houses=active_houses,
                total_houses=len(houses) if can_farm else 0,
                feed_stock_kg=feed_stock,
                feed_used_today_kg=feed_used_today,
                mortality_today=mortality_today,
                mortality_rate_today=mortality_rate_today,
                eggs_today=eggs_today,
                meat_stock_kg=meat_stock,
                sales_today=sales_today,
                compliance_alerts=compliance_alerts,
            ),
            feed_stock=[
                schemas.FeedStockRowOut(
                    id=item.id,
                    name=item.name,
                    category=item.category.name if item.category else "-",
                    unit=item.stock_item.unit_of_measure if item.stock_item else item.unit,
                    current_stock=float(item.stock_item.current_quantity or 0) if item.stock_item else 0.0,
                    reorder_threshold=float(item.reorder_threshold or 0),
                    status=(
                        "Unlinked"
                        if item.stock_item is None
                        else
                        "Low stock"
                        if float(item.stock_item.current_quantity or 0) <= (item.reorder_threshold or 0)
                        else "Available"
                    ),
                )
                for item in feed_items[:8]
            ] if can_feed_stock else [],
            houses=house_rows if can_farm else [],
            slaughter_stock=[
                schemas.SlaughterOverviewRowOut(
                    id=item.id,
                    product=item.name,
                    kg=float(item.current_quantity or 0),
                    unit=item.unit_of_measure,
                    status="Low stock" if (item.current_quantity or 0) <= (item.reorder_level or 0) else "Available",
                )
                for item in stock_items
                if item.category == StockCategory.FINISHED_PRODUCT
            ][:8] if (can_inventory_stock or can_slaughter) else [],
            sales=schemas.SalesOverviewOut(
                cash_sales=cash_sales,
                mobile_money_sales=mobile_money_sales,
                bank_sales=bank_sales,
                pending_payments=pending_payments,
                orders_today=orders_today,
                top_product=None,
            ),
            recent_transfers=[
                schemas.TransferOverviewRowOut(
                    id=movement.id,
                    reference=f"{movement.reference_type or 'MOV'}-{movement.reference_id or movement.id}",
                    movement_type=movement.movement_type.value,
                    item=movement.item.name if movement.item else f"Item #{movement.item_id}",
                    quantity=float(movement.quantity or 0),
                    unit=movement.item.unit_of_measure if movement.item else "",
                    status="Posted",
                    created_at=movement.created_at.isoformat(),
                )
                for movement in movement_rows
            ],
            compliance_documents=[
                schemas.ComplianceOverviewRowOut(
                    id=doc.id,
                    title=doc.title,
                    document_type=doc.document_type.value.replace("_", " ").title(),
                    expiry_date=doc.expiry_date,
                    days_left=(doc.expiry_date - today).days if doc.expiry_date else None,
                    status=doc.status.value.replace("_", " ").title(),
                )
                for doc in compliance_docs
            ],
            slaughter_summary=schemas.SlaughterSummaryOut(
                birds_received_today=birds_received_today,
                dressed_weight_today_kg=dressed_weight_today,
                average_yield_percentage=average_yield,
                byproducts_kg=byproducts_kg,
            ),
        )

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
