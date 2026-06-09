"""
Branch utilities and dependencies for multi-branch access control.
"""

from typing import Annotated
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.tenant_db import get_tenant_db
from app.models.user import User
from app.models.branch import UserBranchAccess


async def get_user_branch_ids(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_tenant_db)],
) -> list[int] | None:
    """
    Returns a list of branch IDs the current user is allowed to access.
    Returns None if the user is a global administrator (sees all branches).
    """
    if current_user.role and current_user.role.name in {"super_manager", "developer_admin", "manager"}:
        # Managers and global admins see all branches
        return None

    result = await db.execute(
        select(UserBranchAccess.branch_id)
        .where(UserBranchAccess.user_id == current_user.id)
    )
    branch_ids = result.scalars().all()
    
    if not branch_ids:
        # If no explicit access is granted and they are not an admin, they have no access
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to any branches in this workspace.",
        )
        
    return list(branch_ids)


UserBranchIds = Annotated[list[int] | None, Depends(get_user_branch_ids)]
