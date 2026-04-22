from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.modules.feed.schemas import (
    SupplierCreate, SupplierUpdate, SupplierOut,
    FeedCategoryCreate, FeedCategoryUpdate, FeedCategoryOut,
    FeedItemCreate, FeedItemUpdate, FeedItemOut,
    FeedPurchaseCreate, FeedPurchaseOut,
    FeedConsumptionCreate, FeedConsumptionOut
)
from app.modules.feed.service import FeedService

router = APIRouter(prefix="/feed", tags=["Feed Management"])

# ── Suppliers ────────────────────────────────────────────────
@router.get("/suppliers", response_model=list[SupplierOut])
async def list_suppliers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.get_suppliers()

@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.create_supplier(data)

# ── Categories ───────────────────────────────────────────────
@router.get("/categories", response_model=list[FeedCategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.get_categories()

@router.post("/categories", response_model=FeedCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: FeedCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.create_category(data)

# ── Items ────────────────────────────────────────────────────
@router.get("/items", response_model=list[FeedItemOut])
async def list_items(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.get_items()

@router.post("/items", response_model=FeedItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: FeedItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.create_item(data)

# ── Purchases ────────────────────────────────────────────────
@router.get("/purchases", response_model=list[FeedPurchaseOut])
async def list_purchases(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.get_purchases()

@router.post("/purchases", response_model=FeedPurchaseOut, status_code=status.HTTP_201_CREATED)
async def create_purchase(
    data: FeedPurchaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.create_purchase(data)

# ── Consumptions ─────────────────────────────────────────────
@router.get("/consumptions", response_model=list[FeedConsumptionOut])
async def list_consumptions(
    batch_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.get_consumptions(batch_id)

@router.post("/consumptions", response_model=FeedConsumptionOut, status_code=status.HTTP_201_CREATED)
async def create_consumption(
    data: FeedConsumptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = FeedService(db)
    return await service.create_consumption(data)
