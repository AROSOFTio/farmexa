from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.session import get_sync_db
from app.modules.settings import schemas, service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/config", response_model=List[schemas.SystemConfigOut])
def list_configs(
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("settings:read")),
):
    return service.settings_service.get_configs(db)


@router.post("/config", response_model=schemas.SystemConfigOut)
def set_config(
    config: schemas.SystemConfigCreate,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("settings:write")),
):
    return service.settings_service.set_config(db, config)


@router.get("/products", response_model=List[schemas.ProductCatalogOut])
def list_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("settings:read")),
):
    return service.settings_service.get_products(db, skip, limit)


@router.post("/products", response_model=schemas.ProductCatalogOut)
def create_product(
    product: schemas.ProductCatalogCreate,
    db: Session = Depends(get_sync_db),
    current_user=Depends(require_permission("settings:write")),
):
    return service.settings_service.create_product(db, product)
