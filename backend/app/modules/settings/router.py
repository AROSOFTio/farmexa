from typing import List

from fastapi import APIRouter, Depends
from datetime import timezone, datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.db.tenant_db import get_tenant_sync_db
from app.models.auth import AuditLog
from app.models.settings import MasterDataRequest, SystemSettings
from app.modules.settings import schemas, service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/public", response_model=schemas.PublicSystemSettingsOut)
async def public_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SystemSettings).order_by(SystemSettings.id).limit(1))
    settings_row = result.scalar_one_or_none()
    if settings_row is None:
        settings_row = SystemSettings()
        db.add(settings_row)
        await db.commit()
        await db.refresh(settings_row)
    return settings_row


@router.get("/config", response_model=List[schemas.SystemConfigOut])
def list_configs(
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:read")),
):
    return service.settings_service.get_configs(db)


@router.post("/config", response_model=schemas.SystemConfigOut)
def set_config(
    config: schemas.SystemConfigCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:write")),
):
    return service.settings_service.set_config(db, config)


@router.get("/products", response_model=List[schemas.ProductCatalogOut])
def list_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:read")),
):
    return service.settings_service.get_products(db, skip, limit)


@router.post("/products", response_model=schemas.ProductCatalogOut)
def create_product(
    product: schemas.ProductCatalogCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:write")),
):
    return service.settings_service.create_product(db, product)


@router.post("/master-data-requests", response_model=schemas.MasterDataRequestOut)
def create_master_data_request(
    payload: schemas.MasterDataRequestCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(get_current_user),
):
    request = MasterDataRequest(
        request_type=payload.request_type.strip().lower(),
        suggested_name=payload.suggested_name.strip(),
        source_module=payload.source_module,
        note=payload.note,
        requester_user_id=getattr(current_user, "id", None),
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.get("/master-data-requests", response_model=List[schemas.MasterDataRequestOut])
def list_master_data_requests(
    status_filter: str = "pending",
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:write")),
):
    query = db.query(MasterDataRequest).order_by(MasterDataRequest.created_at.desc())
    if status_filter != "all":
        query = query.filter(MasterDataRequest.status == status_filter)
    return query.limit(100).all()


@router.patch("/master-data-requests/{request_id}", response_model=schemas.MasterDataRequestOut)
def resolve_master_data_request(
    request_id: int,
    payload: schemas.MasterDataRequestResolve,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:write")),
):
    request = db.get(MasterDataRequest, request_id)
    if request is None:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Missing item request not found")
    normalized_status = payload.status.strip().lower()
    if normalized_status not in {"approved", "rejected", "closed"}:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be approved, rejected, or closed")
    request.status = normalized_status
    request.resolution_note = payload.resolution_note
    request.resolved_by_user_id = getattr(current_user, "id", None)
    request.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(request)
    return request


from app.models.branch import Branch, UserBranchAccess

@router.get("/branches", response_model=List[schemas.BranchOut])
def list_branches(
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:read")),
):
    """List all branches. Global admins see all, staff see only what they have access to."""
    query = db.query(Branch)
    # The global ORM filter `_add_branch_filter` already limits this to allowed branches automatically
    # but wait, the ORM filter only filters if `branch_id` exists. `Branch` has `id` instead of `branch_id`.
    # Let's manually filter if the user is not a platform admin.
    if current_user.role and current_user.role.name not in {"super_manager", "developer_admin", "manager"}:
        allowed = db.query(UserBranchAccess.branch_id).filter(UserBranchAccess.user_id == current_user.id).all()
        allowed_ids = [a[0] for a in allowed]
        query = query.filter(Branch.id.in_(allowed_ids))
    return query.order_by(Branch.name).all()

@router.post("/branches", response_model=schemas.BranchOut)
def create_branch(
    payload: schemas.BranchCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:write")),
):
    branch = Branch(**payload.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch

@router.patch("/branches/{branch_id}", response_model=schemas.BranchOut)
def update_branch(
    branch_id: int,
    payload: schemas.BranchUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:write")),
):
    branch = db.get(Branch, branch_id)
    if not branch:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Branch not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(branch, key, value)
    
    db.commit()
    db.refresh(branch)
    return branch


@router.get("/audit-log", response_model=List[schemas.AuditLogOut])
def list_audit_log(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("settings:read")),
):
    return (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(skip)
        .limit(min(limit, 500))
        .all()
    )
