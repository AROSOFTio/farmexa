import asyncio
from app.db.session import AsyncSessionLocal
from app.modules.analytics.service import analytics_service

async def run():
    async with AsyncSessionLocal() as db:
        # User simulation: tenant 1, etc.
        class MockUser:
            id = 1
            tenant_id = 1
            branch_accesses = []
        user = MockUser()
        try:
            res = await analytics_service.get_erp_dashboard(db, user)
            print("SUCCESS")
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run())
