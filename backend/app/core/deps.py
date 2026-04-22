"""
FastAPI dependency injection: get current user, require permissions, etc.
"""

from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Extract and validate the current user from the Bearer token."""
    from app.modules.users.repository import UserRepository

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    repo = UserRepository(db)
    user = await repo.get_by_id(int(user_id))
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_permission(permission_code: str):
    """
    Dependency factory that enforces a specific permission code.
    Usage: Depends(require_permission("farm:write"))
    """
    async def checker(current_user=Depends(get_current_user)):
        from app.permissions.checker import has_permission
        if not await has_permission(current_user, permission_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: '{permission_code}' required.",
            )
        return current_user
    return checker


def require_roles(*role_names: str):
    """
    Dependency factory that enforces role membership.
    Usage: Depends(require_roles("super_manager", "farm_manager"))
    """
    async def checker(current_user=Depends(get_current_user)):
        if current_user.role is None or current_user.role.name not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role for this operation.",
            )
        return current_user
    return checker


# Typed shorthand
CurrentUser = Annotated[object, Depends(get_current_user)]
