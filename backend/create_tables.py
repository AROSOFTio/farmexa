import asyncio
from app.db.session import engine
from app.db.base import Base
# ensure models are imported
import app.models.finance_coa

async def run():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created successfully")

def sync_seed():
    from app.db.session import SyncSessionLocal
    from app.seeds.chart_of_accounts_seed import seed_coa_template, apply_template_to_tenant, create_default_fiscal_year
    from app.models.tenant import Tenant
    
    with SyncSessionLocal() as db:
        seed_coa_template(db)
        tenant = db.query(Tenant).filter(Tenant.slug == "testfarm").first()
        if tenant:
            apply_template_to_tenant(db, tenant.id)
            create_default_fiscal_year(db, tenant.id)
            print("Demo tenant accounting initialized successfully.")

asyncio.run(run())
sync_seed()
