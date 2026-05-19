import types

import pytest

from app.modules.farm.repository import FarmRepository
from app.modules.inventory.service import InventoryService
from datetime import date

from app.models.farm import Batch, BatchStatus
from app.models.inventory import MovementType


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
    fake_db = object()

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
