"""Test POS checkout endpoint directly using SQLAlchemy"""
import asyncio
import sys
from datetime import date

sys.path.insert(0, '/app')

from app.db.tenant_db import _ensure_schema_ready_sync, operational_db_name_for_tenant
from app.modules.sales import schemas, service
from app.models.inventory import StockItem

database_name = operational_db_name_for_tenant(1)
session_factory = _ensure_schema_ready_sync(database_name)

with session_factory() as db:
    # Get any active stock item with quantity > 0
    product = db.query(StockItem).filter(
        StockItem.is_active == True,
        StockItem.current_quantity > 0
    ).first()
    
    if not product:
        print("ERROR: No active stock items with quantity > 0 found!")
        sys.exit(1)
    
    print(f"Found product: {product.name} (id={product.id}, qty={product.current_quantity}, price={product.unit_price})")
    
    # Create a test checkout payload
    payload = schemas.PosCheckoutCreate(
        customer_id=None,
        customer_name="Test Customer",
        customer_email=None,
        customer_phone=None,
        sale_payment_mode="full",
        amount_paid_now=float(product.unit_price) * 1,  # buy 1 unit
        cash_tendered=float(product.unit_price) * 1,
        payment_method="cash",
        payment_reference=None,
        credit_due_date=None,
        notes="Test POS checkout",
        batch_id=None,
        items=[
            schemas.PosLineCreate(
                product_id=product.id,
                quantity=1,
                unit_price=float(product.unit_price),
                batch_id=None,
            )
        ]
    )
    
    print(f"Payload: mode={payload.sale_payment_mode}, amount_paid={payload.amount_paid_now}, total={sum(float(i.quantity)*float(i.unit_price) for i in payload.items)}")
    
    try:
        result = service.sales_service.checkout_pos(db, payload)
        print(f"SUCCESS! Receipt: {result.get('receipt_number')}")
        print(f"Invoice: {result.get('invoice')}")
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
