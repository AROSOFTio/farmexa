import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.tenant import Tenant
from app.models.user import User
from app.db.tenant_db import _ensure_tenant_database_sync, _build_tenant_snapshot, _build_user_snapshot

async def run():
    async with AsyncSessionLocal() as db:
        tenant_snapshot = {"id": 5, "name": "Farmexa", "address": "Test"}
        user_snapshot = {"id": 1, "email": "admin@example.com", "first_name": "Admin", "last_name": "User"}
        
        try:
            print("Syncing tenant 5...")
            _ensure_tenant_database_sync(
                database_name="farmexa_tenant_5",
                tenant_snapshot=tenant_snapshot,
                user_snapshot=user_snapshot
            )
            print("SUCCESS for tenant 5!")
        except Exception as e:
            print(f"FAILED for tenant 5: {e}")

if __name__ == "__main__":
    asyncio.run(run())
