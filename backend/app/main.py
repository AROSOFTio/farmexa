"""
Farmexa ERP FastAPI application entry point.
"""

from contextlib import asynccontextmanager
import json
from pathlib import Path
import re

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.db.seeder import run_seed
from app.db.session import engine, sync_engine
from app.db.tenant_db import dispose_tenant_engines
from app.middleware.error_handler import register_exception_handlers
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.tenant_domain import TenantDomainResolverMiddleware


setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    await run_seed()
    yield
    await dispose_tenant_engines()
    await engine.dispose()
    sync_engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Farmexa ERP API for poultry operations, inventory, sales, and finance workflows.",
    openapi_url=None if settings.is_production else f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    lifespan=lifespan,
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(TenantDomainResolverMiddleware)

register_exception_handlers(app)

origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
if settings.ALLOWED_ORIGINS.strip().startswith("["):
    origins = json.loads(settings.ALLOWED_ORIGINS)

# Also allow all *.{tenant_domain_suffix} origins so tenant subdomains can make API calls.
_cf_suffix = re.escape(settings.tenant_domain_suffix)
_tenant_origin_regex = rf"^https?://[a-zA-Z0-9][a-zA-Z0-9-]+\.{_cf_suffix}(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=_tenant_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.is_production:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

register_exception_handlers(app)
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "version": settings.APP_VERSION,
        "service": settings.APP_NAME,
    }


frontend_dist = Path(__file__).resolve().parents[1] / "frontend_dist"


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend(full_path: str):
    if not frontend_dist.exists():
        raise HTTPException(status_code=503, detail="Frontend assets are not available.")

    requested_file = frontend_dist / full_path
    if requested_file.is_file():
        return FileResponse(requested_file)

    return FileResponse(frontend_dist / "index.html")
