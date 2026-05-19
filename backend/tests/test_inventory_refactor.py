import types
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.feed import FeedCategory, FeedItem
from app.models.inventory import StockCategory, StockItem, StockMovement
from app.modules.farm.repository import FarmRepository
from app.modules.inventory.service import InventoryService
from datetime import date, datetime, timezone

from app.models.farm import Batch, BatchStatus
from app.models.inventory import MovementType
from app.modules.reports.schemas import ReportRequest
from app.modules.reports.service import ReportsService
from app.modules.slaughter.schemas import SlaughterRecordOut
from app.models.slaughter import SlaughterStatus
from app.db.tenant_db import DEFAULT_FEED_RAW_MATERIALS, _seed_default_inventory_items
from app.services.inventory_coordinator import InventoryCoordinator, ReferenceType
from app.services.stock_sku import generate_unique_sku


class FakeAsyncSession:
    def __init__(self):
        self.added = []
        self.flushed = False

    async def flush(self):
        self.flushed = True

    def add(self, obj):
        self.added.append(obj)


@pytest.mark.asyncio
async def test_farm_repository_accepts_dict_with_stock_item_id():
    repo = FarmRepository(FakeAsyncSession())
    payload = {
        "batch_number": "B-1001",
        "house_id": 1,
        "section_id": None,
        "breed": "Broiler",
        "source": None,
        "arrival_date": date.today(),
        "initial_quantity": 1000,
        "active_quantity": 1000,
        "status": BatchStatus.ACTIVE,
        "stock_item_id": 7,
    }
    batch = await repo.create_batch(payload)
    assert isinstance(batch, Batch)
    assert getattr(batch, "stock_item_id") == 7


def test_inventory_service_delegates_to_coordinator(monkeypatch):
    calls = {"in": [], "out": [], "adj": []}
    commits = []
    refreshes = []

    class FakeCoord:
        def __init__(self, _db):
            pass

        def record_in(self, **kw):
            calls["in"].append(kw)
            return types.SimpleNamespace(id=1)

        def record_out(self, **kw):
            calls["out"].append(kw)
            return types.SimpleNamespace(id=2)

        def record_adjustment(self, **kw):
            calls["adj"].append(kw)
            return types.SimpleNamespace(id=3)

    import app.modules.inventory.service as inventory_service_module
    monkeypatch.setattr(inventory_service_module, "InventoryCoordinator", FakeCoord)

    svc = InventoryService()
    fake_db = types.SimpleNamespace(
        commit=lambda: commits.append(True),
        refresh=lambda obj: refreshes.append(obj),
        rollback=lambda: None,
    )

    # IN
    m = types.SimpleNamespace(
        item_id=11,
        movement_type=MovementType.IN,
        quantity=5,
        reference_type="test_in",
        reference_id=100,
        unit_cost=123.0,
        notes="n",
    )
    svc.create_movement(fake_db, m)
    assert calls["in"] and calls["in"][0]["item_id"] == 11
    assert commits

    # OUT
    m2 = types.SimpleNamespace(
        item_id=12,
        movement_type=MovementType.OUT,
        quantity=2,
        reference_type="test_out",
        reference_id=101,
        unit_cost=None,
        notes="x",
    )
    svc.create_movement(fake_db, m2)
    assert calls["out"] and calls["out"][0]["item_id"] == 12

    # ADJUSTMENT
    m3 = types.SimpleNamespace(
        item_id=13,
        movement_type=MovementType.ADJUSTMENT,
        quantity=-3,
        reference_type="test_adj",
        reference_id=102,
        unit_cost=None,
        notes="y",
    )
    svc.create_movement(fake_db, m3)
    assert calls["adj"] and calls["adj"][0]["quantity"] == -3
    assert len(refreshes) == 3


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:")
    for table in [StockItem.__table__, StockMovement.__table__, FeedCategory.__table__, FeedItem.__table__]:
        table.create(bind=engine, checkfirst=True)
    TestingSession = sessionmaker(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        for table in [FeedItem.__table__, FeedCategory.__table__, StockMovement.__table__, StockItem.__table__]:
            table.drop(bind=engine, checkfirst=True)


def test_signed_adjustments_increase_decrease_and_reconcile(db_session: Session):
    item = StockItem(
        name="Maize",
        sku="FEED-MAIZE",
        category=StockCategory.RAW_MATERIAL,
        unit_of_measure="kg",
        current_quantity=0,
        reorder_level=0,
        unit_price=0,
        average_cost=0,
    )
    db_session.add(item)
    db_session.flush()

    coordinator = InventoryCoordinator(db_session)
    coordinator.record_in(
        item_id=item.id,
        quantity=100,
        reference_type=ReferenceType.INITIAL_STOCK.value,
    )
    plus = coordinator.record_adjustment(
        item_id=item.id,
        quantity=25,
        reference_type=ReferenceType.MANUAL_ADJUSTMENT.value,
    )
    minus = coordinator.record_adjustment(
        item_id=item.id,
        quantity=-40,
        reference_type=ReferenceType.MANUAL_ADJUSTMENT.value,
    )
    db_session.commit()

    assert plus.quantity == 25
    assert minus.quantity == -40
    assert item.current_quantity == 85
    assert coordinator.reconcile_item(item.id)["calculated_quantity"] == 85


def test_signed_adjustment_cannot_reduce_below_zero_without_override(db_session: Session):
    item = StockItem(
        name="Concentrate",
        sku="FEED-CONCENTRATE",
        category=StockCategory.RAW_MATERIAL,
        unit_of_measure="kg",
        current_quantity=10,
        reorder_level=0,
        unit_price=0,
        average_cost=0,
    )
    db_session.add(item)
    db_session.commit()

    coordinator = InventoryCoordinator(db_session)
    with pytest.raises(HTTPException):
        coordinator.record_adjustment(
            item_id=item.id,
            quantity=-11,
            reference_type=ReferenceType.MANUAL_ADJUSTMENT.value,
        )


def test_feed_stock_report_uses_linked_stock_item_not_legacy_current_stock(db_session: Session):
    category = FeedCategory(name="Raw Materials")
    stock_item = StockItem(
        name="Soya",
        sku="FEED-SOYA",
        category=StockCategory.RAW_MATERIAL,
        unit_of_measure="kg",
        current_quantity=12,
        reorder_level=0,
        unit_price=0,
        average_cost=0,
    )
    db_session.add_all([category, stock_item])
    db_session.flush()
    db_session.add(
        FeedItem(
            name="Soya",
            category_id=category.id,
            stock_item_id=stock_item.id,
            unit="kg",
            current_stock=9999,
            reorder_threshold=20,
        )
    )
    db_session.commit()

    rows, totals = ReportsService()._feed_stock(db_session, ReportRequest())

    assert rows[0]["current_stock"] == 12
    assert rows[0]["status"] == "Low stock"
    assert totals["low_stock"] == 1


def test_feed_stock_report_marks_unlinked_items_without_using_legacy_stock(db_session: Session):
    category = FeedCategory(name="Raw Materials")
    db_session.add(category)
    db_session.flush()
    db_session.add(
        FeedItem(
            name="Unlinked Maize",
            category_id=category.id,
            unit="kg",
            current_stock=5000,
            reorder_threshold=20,
        )
    )
    db_session.commit()

    rows, _totals = ReportsService()._feed_stock(db_session, ReportRequest())

    assert rows[0]["current_stock"] == 0
    assert rows[0]["status"] == "Unlinked inventory item"


def test_analytics_feed_stock_has_no_legacy_current_stock_fallback():
    analytics_path = Path(__file__).resolve().parents[1] / "app" / "modules" / "analytics" / "service.py"
    source = analytics_path.read_text()

    assert "item.current_stock" not in source
    assert "getattr(item, \"stock_item_id\", None)" not in source
    assert "Unlinked" in source


def test_async_reconcile_uses_sqlalchemy_case_not_func_case():
    coordinator_path = Path(__file__).resolve().parents[1] / "app" / "services" / "inventory_coordinator.py"
    source = coordinator_path.read_text()

    assert "from sqlalchemy import case" in source or "from sqlalchemy import case," in source
    assert "func.case" not in source


def test_duplicate_sku_generation_appends_suffix(db_session: Session):
    db_session.add(
        StockItem(
            name="Maize",
            sku="FEED-MAIZE",
            category=StockCategory.RAW_MATERIAL,
            unit_of_measure="kg",
            current_quantity=0,
            reorder_level=0,
            unit_price=0,
            average_cost=0,
        )
    )
    db_session.commit()

    assert generate_unique_sku(db_session, "FEED", "Maize") == "FEED-MAIZE-2"


def test_tenant_default_feed_seed_links_stock_and_initial_movement(db_session: Session):
    _seed_default_inventory_items(db_session)
    db_session.commit()

    for name, opening_stock in DEFAULT_FEED_RAW_MATERIALS:
        feed_item = db_session.query(FeedItem).filter(FeedItem.name == name).one()
        assert feed_item.stock_item_id is not None
        assert feed_item.current_stock == 0.0
        stock_item = db_session.get(StockItem, feed_item.stock_item_id)
        assert stock_item.current_quantity == opening_stock
        movement = (
            db_session.query(StockMovement)
            .filter(
                StockMovement.item_id == stock_item.id,
                StockMovement.reference_type == ReferenceType.INITIAL_STOCK.value,
                StockMovement.reference_id == feed_item.id,
            )
            .one()
        )
        assert movement.quantity == opening_stock


def test_backfill_migration_uses_active_quantity_for_batch_opening_balance():
    migration_path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "017_backfill_batch_feed_inventory_linkage.py"
    )
    source = migration_path.read_text()

    assert 'active_qty = float(b.get("active_quantity") or 0)' in source
    assert "Migration opening balance for active birds" in source
    assert "initial_qty = float(b.get(\"initial_quantity\") or 0)" not in source


def test_slaughter_schema_exposes_completed_awaiting_inventory_posting():
    record = SlaughterRecordOut(
        id=1,
        batch_id=10,
        slaughter_date=date.today(),
        live_birds_count=20,
        mortality_birds_count=0,
        total_live_weight=40,
        waste_weight=0,
        condemned_birds_count=0,
        blood_weight=0,
        feathers_weight=0,
        offal_weight=0,
        head_weight=0,
        feet_weight=0,
        reusable_byproducts_weight=0,
        quality_inspection_status="passed",
        approval_status="approved",
        status=SlaughterStatus.COMPLETED,
        inventory_posted_at=None,
        created_at=datetime.now(timezone.utc),
        outputs=[],
    )

    assert record.inventory_posted is False
    assert record.workflow_state == "completed_awaiting_output_posting"
