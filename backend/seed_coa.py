"""Seed the Chart of Accounts and System Account Mappings for all existing tenants."""
import sys
sys.path.insert(0, '/app')

from app.db.tenant_db import _ensure_schema_ready_sync, operational_db_name_for_tenant
from app.models.tenant import Tenant
from app.db.session import SyncSessionLocal
from app.seeds.chart_of_accounts_seed import (
    seed_coa_template,
    apply_template_to_tenant,
    create_default_fiscal_year,
    seed_chart_of_accounts,
)

# First get all tenant IDs from central DB
central_db = SyncSessionLocal()
try:
    tenants = central_db.query(Tenant).all()
    tenant_ids = [(t.id, t.name) for t in tenants]
    print(f"Found {len(tenant_ids)} tenants: {tenant_ids}")
finally:
    central_db.close()

for tenant_id, tenant_name in tenant_ids:
    database_name = operational_db_name_for_tenant(tenant_id)
    print(f"\n[Tenant {tenant_id}: {tenant_name}] Seeding CoA in database: {database_name}")
    
    try:
        session_factory = _ensure_schema_ready_sync(database_name)
    except Exception as e:
        print(f"  ERROR: Failed to connect to {database_name}: {e}")
        continue
    
    with session_factory() as db:
        try:
            # Seed the CoA directly (fastest, no template dependency)
            seed_chart_of_accounts(db, tenant_id=tenant_id)
            print(f"  ✅ CoA seeded!")
            
            # Create default fiscal year
            fy = create_default_fiscal_year(db, tenant_id=tenant_id)
            print(f"  ✅ Fiscal year: {fy.name}")
            
        except Exception as e:
            print(f"  ERROR seeding: {e}")
            import traceback
            traceback.print_exc()
            db.rollback()
