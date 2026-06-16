from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.deps import get_current_user
from app.db.tenant_db import get_tenant_sync_db


@dataclass
class BranchContext:
    all_allowed_ids: list[int] = field(default_factory=list)
    active_id: Optional[int] = None
    filter_ids: list[int] = field(default_factory=list)


def get_branch_context(
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_tenant_sync_db),
) -> BranchContext:
    """
    Resolves branch access for the current user.
    Platform admins and tenant owners see all branches.
    Regular users see only their assigned branches.
    If X-Branch-ID header is present, validates membership.
    """
    from app.models.branch import Branch, UserBranchAccess
    PLATFORM_ADMIN_ROLES = {"super_manager", "developer_admin", "platform_admin"}
    TENANT_WIDE_ROLES = {"tenant_admin", "manager", "hr_officer"}

    role_name = getattr(getattr(current_user, "role", None), "name", "") or ""
    is_admin = role_name in PLATFORM_ADMIN_ROLES
    is_tenant_wide = role_name in TENANT_WIDE_ROLES
    is_owner = getattr(current_user, "is_tenant_owner", False)

    tenant_id = getattr(current_user, "tenant_id", None)

    if is_admin or is_tenant_wide or is_owner:
        all_branches = (
            db.query(Branch)
            .filter(Branch.tenant_id == tenant_id, Branch.is_active == True)
            .all()
        )
        allowed_ids = [b.id for b in all_branches]
    else:
        accesses = (
            db.query(UserBranchAccess)
            .filter(UserBranchAccess.user_id == current_user.id)
            .all()
        )
        allowed_ids = [a.branch_id for a in accesses]

    active_id = getattr(request.state, "active_branch_id", None)
    if active_id is not None and active_id not in allowed_ids:
        raise HTTPException(
            status_code=403,
            detail=f"You do not have access to branch {active_id}."
        )

    filter_ids = [active_id] if active_id else allowed_ids
    return BranchContext(
        all_allowed_ids=allowed_ids,
        active_id=active_id,
        filter_ids=filter_ids,
    )
