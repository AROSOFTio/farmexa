from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.feed import Supplier, SupplierItemPrice
from app.modules.procurement.service import ProcurementService
from app.modules.procurement.schemas import (
    SupplierCreate,
    SupplierUpdate,
    SupplierItemPriceCreate,
)

TENANT_ID = 1

@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    tables = [
        Supplier.__table__,
        SupplierItemPrice.__table__,
    ]
    for table in tables:
        table.create(bind=engine, checkfirst=True)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        for table in reversed(tables):
            table.drop(bind=engine, checkfirst=True)


def test_create_and_update_supplier(db_session: Session):
    service = ProcurementService(db_session, tenant_id=TENANT_ID)

    # 1. Create Supplier
    supplier_data = SupplierCreate(
        name="Test Supplier",
        supplier_type="Feed mill",
        products_supplied="Maize, Concentrates",
        contact_person="Alice Smith",
        phone="+256771122334",
        email="alice@testsupplier.com",
        address="Kampala, Uganda",
        tax_id="100012345",
        payment_terms="Net 30",
        lead_time_days=5,
        notes="Premium grade feed supplier",
        is_active=True,
    )
    supplier = service.create_supplier(supplier_data)
    assert supplier.id is not None
    assert supplier.name == "Test Supplier"
    assert supplier.lead_time_days == 5

    # 2. List Suppliers
    suppliers = service.list_suppliers()
    assert len(suppliers) == 1
    assert suppliers[0].name == "Test Supplier"

    # 3. Update Supplier
    update_data = SupplierUpdate(
        name="Test Supplier Ltd",
        lead_time_days=4,
    )
    updated = service.update_supplier(supplier.id, update_data)
    assert updated.name == "Test Supplier Ltd"
    assert updated.lead_time_days == 4


def test_supplier_item_pricing(db_session: Session):
    service = ProcurementService(db_session, tenant_id=TENANT_ID)

    # Create a supplier first
    supplier = service.create_supplier(SupplierCreate(name="Supplier Alpha"))

    # 1. Add Tentative Price
    price_data = SupplierItemPriceCreate(
        item_name="Maize Bran",
        unit_of_measure="kg",
        unit_price=Decimal("1200.00"),
        notes="Tentative summer price",
    )
    item_price = service.create_or_update_supplier_item_price(supplier.id, price_data)
    assert item_price.id is not None
    assert item_price.item_name == "Maize Bran"
    assert item_price.unit_price == Decimal("1200.00")

    # 2. List Item Prices
    prices = service.list_supplier_item_prices(supplier.id)
    assert len(prices) == 1
    assert prices[0].item_name == "Maize Bran"

    # 3. Update Tentative Price (Idempotent call with same item name)
    price_data_update = SupplierItemPriceCreate(
        item_name="Maize Bran",
        unit_of_measure="kg",
        unit_price=Decimal("1300.00"),
        notes="Adjusted price",
    )
    updated_price = service.create_or_update_supplier_item_price(supplier.id, price_data_update)
    assert updated_price.unit_price == Decimal("1300.00")
    assert updated_price.id == item_price.id

    # 4. Delete Price Entry
    service.delete_supplier_item_price(supplier.id, item_price.id)
    prices_after_del = service.list_supplier_item_prices(supplier.id)
    assert len(prices_after_del) == 0
