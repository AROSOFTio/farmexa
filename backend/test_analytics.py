"""Test analytics/erp-dashboard endpoint"""
import asyncio
import sys
sys.path.insert(0, '/app')

async def main():
    from app.db.tenant_db import _get_or_create_async_runtime, operational_db_name_for_tenant
    from app.modules.analytics.service import AnalyticsService
    
    database_name = operational_db_name_for_tenant(1)
    _, session_factory = _get_or_create_async_runtime(database_name)
    
    async with session_factory() as db:
        try:
            service = AnalyticsService()
            result = await service.get_erp_dashboard(db, None)
            print("SUCCESS!")
            print(f"Total birds: {result.kpis.total_birds}")
            print(f"Active houses: {result.kpis.active_houses}")
            print(f"Sales today: {result.kpis.sales_today}")
            print(f"Feed stock: {result.kpis.feed_stock_kg}")
        except Exception as e:
            print(f"ERROR: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()

asyncio.run(main())
