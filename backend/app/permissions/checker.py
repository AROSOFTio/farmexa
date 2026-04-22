"""
Permission checker: evaluates if a user has a given permission code.
"""

from app.models.user import User


async def has_permission(user: User, permission_code: str) -> bool:
    """Check if user's role includes the given permission code."""
    if user.role is None:
        return False
    for rp in user.role.role_permissions:
        if rp.permission and rp.permission.code == permission_code:
            return True
    return False


async def get_user_permissions(user: User) -> list[str]:
    """Return flat list of permission codes for the user's role."""
    if user.role is None:
        return []
    return [
        rp.permission.code
        for rp in user.role.role_permissions
        if rp.permission
    ]
