"""
Application configuration using Pydantic Settings.
All values loaded from environment variables / .env file.
"""

from functools import lru_cache
from typing import Any, List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────
    APP_NAME: str = "PERP"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # ── Database ─────────────────────────────────────────
    POSTGRES_SERVER: str = "db"
    POSTGRES_USER: str = "perp_user"
    POSTGRES_PASSWORD: str = ""
    POSTGRES_DB: str = "perp_db"
    POSTGRES_PORT: str = "5432"
    
    @property
    def ASYNC_DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def SYNC_DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Legacy support
    DATABASE_URL: str | None = None
    DATABASE_URL_SYNC: str | None = None

    # ── Redis ────────────────────────────────────────────
    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str

    # ── JWT ──────────────────────────────────────────────
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ─────────────────────────────────────────────
    # Accepts comma-separated string OR JSON array in .env:
    #   ALLOWED_ORIGINS=http://localhost:3000,https://farmexa.arosoft.io
    #   ALLOWED_ORIGINS=["http://localhost:3000","https://farmexa.arosoft.io"]
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost"

    # ── Seeder ───────────────────────────────────────────
    SEED_ADMIN_EMAIL: str = "admin@perp.local"
    SEED_ADMIN_PASSWORD: str = "Admin@2025!"
    SEED_ADMIN_FULL_NAME: str = "System Administrator"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings: Settings = get_settings()
