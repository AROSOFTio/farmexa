import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.modules.developer_admin.catalog import DEFAULT_MODULES, DEFAULT_PLAN_MODULES
from app.modules.developer_admin.service import DeveloperAdminService
from app.services import cloudflare_service
from app.services.cloudflare_service import create_tenant_dns_record
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
    assert DeveloperAdminService(None)._default_platform_domain("ngali") == "ngali.arosoft.io"


def test_full_trial_plan_includes_every_module():
    all_module_keys = {module["key"] for module in DEFAULT_MODULES}
    assert set(DEFAULT_PLAN_MODULES["full_trial"]) == all_module_keys


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


@pytest.mark.asyncio
async def test_cloudflare_dns_reuses_matching_record(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_CLOUDFLARE_DNS_AUTOMATION", True)
    monkeypatch.setattr(settings, "CLOUDFLARE_API_TOKEN", "token")
    monkeypatch.setattr(settings, "CLOUDFLARE_ZONE_ID", "zone")
    monkeypatch.setattr(settings, "TENANT_DNS_TARGET_TYPE", "CNAME")
    monkeypatch.setattr(settings, "TENANT_DNS_TARGET_VALUE", "farmexa.arosoft.io")
    monkeypatch.setattr(settings, "TENANT_DNS_PROXIED", True)
    monkeypatch.setattr(settings, "TENANT_DNS_TTL", 1)

    class FakeResponse:
        is_success = True
        status_code = 200
        text = ""

        def json(self):
            return {
                "success": True,
                "result": [
                    {
                        "id": "record-1",
                        "content": "farmexa.arosoft.io",
                        "proxied": True,
                        "ttl": 1,
                    }
                ],
            }

    class FakeClient:
        def __init__(self, *args, **kwargs):
            self.post_called = False
            self.put_called = False

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, *args, **kwargs):
            return FakeResponse()

        async def post(self, *args, **kwargs):
            self.post_called = True
            raise AssertionError("Matching Cloudflare records must be reused.")

        async def put(self, *args, **kwargs):
            self.put_called = True
            raise AssertionError("Matching Cloudflare records must not be updated.")

    monkeypatch.setattr(cloudflare_service.httpx, "AsyncClient", FakeClient)

    result = await create_tenant_dns_record("ngali.arosoft.io")

    assert result.ok is True
    assert result.record_id == "record-1"
    assert result.record_type == "CNAME"
    assert result.target == "farmexa.arosoft.io"
