import pytest

from app.core.config import settings
from app.utils.domains import is_platform_host, infer_domain_type, tenant_domain_suffix, default_platform_domain


def test_platform_hosts_are_recognized():
    monkeypatch_hosts = "farm.arosoftlabs.com,cp.arosoftlabs.com,www.arosoftlabs.com,localhost,127.0.0.1"
    # ensure detection honors configured PLATFORM_HOSTS
    settings.PLATFORM_HOSTS = monkeypatch_hosts
    assert is_platform_host("farm.arosoftlabs.com") is True
    assert is_platform_host("cp.arosoftlabs.com") is True
    assert is_platform_host("www.arosoftlabs.com") is True


def test_tenant_and_forbidden_hosts():
    # tenant under farm.* should be considered platform_subdomain
    assert infer_domain_type("mugizi.farm.arosoftlabs.com") == "platform_subdomain"
    # tenant directly under arosoftlabs.com must not be considered a platform subdomain
    assert infer_domain_type("mugizi.arosoftlabs.com") == "custom"
    # default platform domain is correctly formed
    assert default_platform_domain("mugizi") == f"mugizi.{tenant_domain_suffix()}"
