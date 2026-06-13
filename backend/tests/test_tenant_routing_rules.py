import pytest

from app.core.config import settings
from app.utils.domains import is_platform_host, infer_domain_type, tenant_domain_suffix, default_platform_domain


def test_platform_hosts_are_recognized(monkeypatch):
    monkeypatch_hosts = "arosoftlabs.com,www.arosoftlabs.com,app.arosoftlabs.com,cp.arosoftlabs.com,farm.arosoftlabs.com,mail.arosoftlabs.com,courses.arosoftlabs.com,demo.arosoftlabs.com,my.arosoftlabs.com,arofi.arosoftlabs.com,api.arosoftlabs.com,admin.arosoftlabs.com,support.arosoftlabs.com,localhost,127.0.0.1"
    # ensure detection honors configured PLATFORM_HOSTS
    monkeypatch.setattr(settings, "PLATFORM_HOSTS", monkeypatch_hosts)
    assert is_platform_host("arosoftlabs.com") is True
    assert is_platform_host("cp.arosoftlabs.com") is True
    assert is_platform_host("app.arosoftlabs.com") is True
    assert is_platform_host("www.arosoftlabs.com") is True
    assert is_platform_host("api.arosoftlabs.com") is True
    assert is_platform_host("support.arosoftlabs.com") is True


def test_tenant_and_forbidden_hosts():
    # tenant under arosoftlabs.com should be considered platform_subdomain
    assert infer_domain_type("mugizi.arosoftlabs.com") == "platform_subdomain"
    # tenant under farm.arosoftlabs.com should also be considered a platform subdomain
    assert infer_domain_type("mugizi.farm.arosoftlabs.com") == "platform_subdomain"
    # default platform domain is correctly formed
    assert default_platform_domain("mugizi") == f"mugizi.{tenant_domain_suffix()}"
