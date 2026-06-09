from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_permission, get_current_user
from app.db.tenant_db import get_tenant_sync_db
from app.models.branch_transfer import TransferStatus
from app.modules.inventory import branch_transfer_schemas as schemas
from app.modules.inventory import branch_transfer_service as service

router = APIRouter(prefix="/inventory/branch-transfers", tags=["Branch Transfers"])


@router.get("", response_model=List[schemas.BranchTransferOut])
def list_branch_transfers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    tenant_id = current_user.tenant_id
    return service.get_transfers(db, skip, limit, tenant_id)


@router.get("/{transfer_id}", response_model=schemas.BranchTransferOut)
def get_branch_transfer(
    transfer_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:read")),
):
    transfer = service.get_transfer(db, transfer_id)
    return transfer


@router.post("", response_model=schemas.BranchTransferOut)
def create_branch_transfer(
    transfer: schemas.BranchTransferCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    # Determine the from_branch_id from the user's active branch or header
    # Usually X-Branch-ID is processed by get_tenant_sync_db, but we need the exact ID for the record.
    # The active branch ID is usually available via session.info.get("branch_ids") which contains [active_branch]
    branch_ids = db.info.get("branch_ids")
    if not branch_ids:
        # Fallback to the first branch the user has access to if no header was provided?
        # A branch transfer MUST originate from a specific branch.
        raise ValueError("Active branch not specified in request context")
        
    from_branch_id = branch_ids[0]
    
    return service.create_transfer(db, transfer, current_user.id, current_user.tenant_id, from_branch_id)


@router.patch("/{transfer_id}/status", response_model=schemas.BranchTransferOut)
def update_branch_transfer_status(
    transfer_id: int,
    payload: schemas.BranchTransferStatusUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("inventory:write")),
):
    return service.update_transfer_status(db, transfer_id, payload, current_user.id, current_user.tenant_id)
