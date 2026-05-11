from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_db
from app.modules.feed.schemas import (
    FeedCategoryCreate,
    FeedCategoryOut,
    FeedConsumptionCreate,
    FeedConsumptionOut,
    FeedItemCreate,
    FeedItemOut,
    FeedPurchaseCreate,
    FeedPurchaseOut,
    FeedFormulationCreate,
    FeedFormulationOut,
    FeedProductionCreate,
    FeedProductionOut,
    SupplierCreate,
    SupplierOut,
)
from app.modules.feed.service import FeedService

router = APIRouter(prefix="/feed", tags=["Feed Management"])


@router.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers(
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:read")),
):
    return await FeedService(db).get_suppliers()


@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:write")),
):
    return await FeedService(db).create_supplier(data)


@router.get("/categories", response_model=list[FeedCategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:read")),
):
    return await FeedService(db).get_categories()


@router.post("/categories", response_model=FeedCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: FeedCategoryCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:write")),
):
    return await FeedService(db).create_category(data)


@router.get("/items", response_model=list[FeedItemOut])
async def list_items(
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:read")),
):
    return await FeedService(db).get_items()


@router.post("/items", response_model=FeedItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: FeedItemCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:write")),
):
    return await FeedService(db).create_item(data)


@router.get("/purchases", response_model=list[FeedPurchaseOut])
async def list_purchases(
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:read")),
):
    return await FeedService(db).get_purchases()


@router.post("/purchases", response_model=FeedPurchaseOut, status_code=status.HTTP_201_CREATED)
async def create_purchase(
    data: FeedPurchaseCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:write")),
):
    return await FeedService(db).create_purchase(data)


@router.get("/consumptions", response_model=list[FeedConsumptionOut])
async def list_consumptions(
    batch_id: int | None = None,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:read")),
):
    return await FeedService(db).get_consumptions(batch_id)


@router.post("/consumptions", response_model=FeedConsumptionOut, status_code=status.HTTP_201_CREATED)
async def create_consumption(
    data: FeedConsumptionCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:write")),
):
    return await FeedService(db).create_consumption(data)


@router.get("/formulations", response_model=list[FeedFormulationOut])
async def list_formulations(
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:read")),
):
    return await FeedService(db).get_formulations()


@router.post("/formulations", response_model=FeedFormulationOut, status_code=status.HTTP_201_CREATED)
async def create_formulation(
    data: FeedFormulationCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:write")),
):
    return await FeedService(db).create_formulation(data)


@router.get("/productions", response_model=list[FeedProductionOut])
async def list_productions(
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:read")),
):
    return await FeedService(db).get_productions()


@router.post("/productions", response_model=FeedProductionOut, status_code=status.HTTP_201_CREATED)
async def create_production(
    data: FeedProductionCreate,
    db: AsyncSession = Depends(get_tenant_db),
    current_user=Depends(require_permission("feed:write")),
):
    return await FeedService(db).create_production(data)
