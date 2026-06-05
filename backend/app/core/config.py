"""
Application configuration loaded from environment variables.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "Farmexa"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    POSTGRES_SERVER: str = "db"
    POSTGRES_USER: str = "farmexa_user"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "farmexa_db"
    POSTGRES_PORT: str = "5432"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    DATABASE_URL: str | None = None
    DATABASE_URL_SYNC: str | None = None

    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost,http://localhost:5173"
    PRIMARY_PLATFORM_DOMAIN: str = "myfarm.arosoftlabs.com"
    PLATFORM_HOSTS: str = "myfarm.arosoftlabs.com,farm.arosoftlabs.com,arosoftlabs.com,localhost,127.0.0.1"
    DEFAULT_TENANT_DOMAIN_SUFFIX: str = "arosoftlabs.com"
    CLOUDFLARE_ZONE_NAME: str = "arosoftlabs.com"
    TENANT_DNS_TARGET_TYPE: str = "A"
    TENANT_DNS_TARGET_VALUE: str | None = None
    TENANT_DNS_PROXIED: bool = True
    TENANT_DNS_TTL: int = 1
    TENANT_DOMAIN_TARGET_IP: str | None = None
    CLOUDFLARE_API_TOKEN: str | None = None
    CLOUDFLARE_ZONE_ID: str | None = None
    CLOUDFLARE_DNS_RECORD_TYPE: str = "A"
    ENABLE_CLOUDFLARE_DNS_AUTOMATION: bool = True
    DOMAIN_VERIFY_TIMEOUT_SECONDS: int = 5
    CERTBOT_BIN: str = ""
    CERTBOT_WEBROOT: str = ""
    CERTBOT_EMAIL: str | None = None
    ENABLE_AUTOMATIC_SSL_PROVISIONING: bool = False
    PAYMENT_CALLBACK_SECRET: str | None = None

    SEED_ADMIN_EMAIL: str = "admin@farmexa.local"
    SEED_ADMIN_PASSWORD: str = "Admin@2026!"
    SEED_ADMIN_FULL_NAME: str = "Farmexa System Administrator"
    SEED_DEV_ADMIN_EMAIL: str = "devadmin@farmexa.local"
    SEED_DEV_ADMIN_PASSWORD: str = "DevAdmin@2026!"
    SEED_DEV_ADMIN_FULL_NAME: str = "Farmexa Developer Admin"
    SEED_DEMO_TENANT_ENABLED: bool = False
    SEED_DEMO_TENANT_NAME: str = "Farmexa Test Farm"
    SEED_DEMO_TENANT_SLUG: str = "testfarm"
    SEED_DEMO_TENANT_ADMIN_EMAIL: str = "tenantadmin@farmexa.local"
    SEED_DEMO_TENANT_ADMIN_PASSWORD: str = "TenantAdmin@2026!"
    SEED_DEMO_TENANT_ADMIN_FULL_NAME: str = "Farmexa Tenant Administrator"

    UPLOAD_DIR: str = "/app/uploads"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_FROM_NAME: str = "Farmexa"
    SMTP_USE_TLS: bool = True

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"

    @property
    def platform_hosts(self) -> list[str]:
        return [host.strip().lower() for host in self.PLATFORM_HOSTS.split(",") if host.strip()]

    @property
    def tenant_domain_suffix(self) -> str:
        suffix = self.DEFAULT_TENANT_DOMAIN_SUFFIX.strip().lower().removeprefix("www.")
        zone_name = self.CLOUDFLARE_ZONE_NAME.strip().lower().removeprefix("www.")
        platform_domain = self.PRIMARY_PLATFORM_DOMAIN.strip().lower().removeprefix("www.")
        if zone_name and suffix == platform_domain:
            return zone_name
        if zone_name and suffix.endswith(f".{zone_name}") and suffix.count(".") > zone_name.count("."):
            return zone_name
        return suffix or "arosoftlabs.com"

    @property
    def trusted_hosts(self) -> list[str]:
        hosts = set(self.platform_hosts)
        hosts.add(self.PRIMARY_PLATFORM_DOMAIN.lower())
        suffix = self.tenant_domain_suffix
        if suffix:
            hosts.add(suffix)
            hosts.add(f"*.{suffix}")
        return sorted(hosts)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
