import pytest
from fastapi import HTTPException

from app.modules.developer_admin.service import DeveloperAdminService
from app.services.erp_rules import (
    calculate_feed_requirements,
    calculate_pos_sale,
    calculate_slaughter_yield,
    ensure_sufficient_stock,
    validate_feed_formula_percentages,
)


def test_slug_generation_uses_clean_farm_name():
    assert DeveloperAdminService._slugify("Ngali Poultry Farm") == "ngali"
    assert DeveloperAdminService._slugify("Golden Farm Ltd") == "golden"


def test_feed_formula_percentages_must_equal_100():
    validate_feed_formula_percentages({"maize": 45, "concentrate": 20, "soya": 18, "sunflower": 10, "limestone": 7})
    with pytest.raises(HTTPException):
        validate_feed_formula_percentages({"maize": 45, "concentrate": 20})


def test_feed_production_requirements_by_percentage():
    requirements = calculate_feed_requirements(1200, {"maize": 50, "soya": 25, "limestone": 25})
    assert requirements == {"maize": 600.0, "soya": 300.0, "limestone": 300.0}
    ensure_sufficient_stock(requirements, {"maize": 600, "soya": 300, "limestone": 301})
    with pytest.raises(HTTPException):
        ensure_sufficient_stock(requirements, {"maize": 599, "soya": 300, "limestone": 301})


def test_slaughter_yield_calculation():
    assert calculate_slaughter_yield(1450, 952) == 65.66


def test_pos_stock_deduction_blocks_insufficient_stock():
    result = calculate_pos_sale(available_kg=100, requested_kg=12.5, price_per_kg=15000)
    assert result.total == 187500
    assert result.remaining_stock_kg == 87.5
    with pytest.raises(HTTPException):
        calculate_pos_sale(available_kg=2, requested_kg=3, price_per_kg=15000)
