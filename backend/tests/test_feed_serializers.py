import types

import pytest

from app.models.feed import (
    FeedCategory,
    FeedFormulation,
    FeedFormulationIngredient,
    FeedItem,
)
from app.models.inventory import StockCategory, StockItem
from app.modules.feed.service import (
    FeedService,
    _to_feed_ingredient_item_out,
    _to_feed_item_out,
    _to_formulation_out,
)


def _build_feed_item(*, current_quantity: float, legacy_stock: float = 999.0) -> FeedItem:
    category = FeedCategory(id=1, name="Raw", description=None)
    stock = StockItem(
        name="Maize",
        sku="FEED-MAIZE",
        category=StockCategory.RAW_MATERIAL,
        unit_of_measure="kg",
        current_quantity=current_quantity,
        reorder_level=0,
        unit_price=0,
        average_cost=0,
    )
    stock.id = 11
    item = FeedItem(
        id=7,
        name="Maize",
        category_id=category.id,
        stock_item_id=stock.id,
        unit="kg",
        current_stock=legacy_stock,
        reorder_threshold=5,
    )
    item.category = category
    item.stock_item = stock
    return item


def test_feed_item_out_uses_stock_item_quantity():
    item = _build_feed_item(current_quantity=25.0, legacy_stock=9999.0)
    result = _to_feed_item_out(item)
    assert result.current_stock == pytest.approx(25.0)


def test_feed_item_out_falls_back_to_zero_without_stock_item():
    item = _build_feed_item(current_quantity=0.0, legacy_stock=8888.0)
    item.stock_item = None
    item.stock_item_id = None
    result = _to_feed_item_out(item)
    assert result.current_stock == 0.0


def test_feed_ingredient_item_out_uses_stock_item_quantity():
    item = _build_feed_item(current_quantity=13.5, legacy_stock=4444)
    ingredient_out = _to_feed_ingredient_item_out(item)
    assert ingredient_out.current_stock == pytest.approx(13.5)


def test_formulation_out_wraps_ingredient_feed_item_with_stock_quantity():
    item = _build_feed_item(current_quantity=8.0)
    ingredient = FeedFormulationIngredient(
        id=3,
        formulation_id=2,
        feed_item_id=item.id,
        percentage=60.0,
    )
    ingredient.feed_item = item
    formulation = FeedFormulation(
        id=2,
        name="Starter",
        stage="Starter",
        texture="Mash",
        output_quantity_kg=1000.0,
        cost_per_kg=0.0,
    )
    formulation.ingredients = [ingredient]

    result = _to_formulation_out(formulation)
    assert result.ingredients[0].feed_item.current_stock == pytest.approx(8.0)


@pytest.mark.asyncio
async def test_feed_service_get_items_uses_stock_quantity():
    item = _build_feed_item(current_quantity=42.0, legacy_stock=7777.0)

    class StubRepo:
        async def get_items(self):
            return [item]

    service = object.__new__(FeedService)
    service.repo = StubRepo()
    service.farm_repo = None
    service.db = None

    results = await FeedService.get_items(service)  # type: ignore[arg-type]
    assert results[0].current_stock == pytest.approx(42.0)


@pytest.mark.asyncio
async def test_feed_service_serializers_not_using_legacy_current_stock(monkeypatch):
    item = _build_feed_item(current_quantity=33.0, legacy_stock=6666.0)

    class StubRepo:
        async def get_items(self):
            return [item]

    service = object.__new__(FeedService)
    service.repo = StubRepo()
    service.farm_repo = None
    service.db = None

    # Ensure helper function is used under the hood
    spy = types.SimpleNamespace(calls=0)

    original_helper = _to_feed_item_out

    def tracking_helper(feed_item):
        spy.calls += 1
        return original_helper(feed_item)

    monkeypatch.setattr("app.modules.feed.service._to_feed_item_out", tracking_helper)

    results = await FeedService.get_items(service)  # type: ignore[arg-type]
    assert results[0].current_stock == pytest.approx(33.0)
    assert spy.calls == 1

    monkeypatch.setattr("app.modules.feed.service._to_feed_item_out", original_helper)
