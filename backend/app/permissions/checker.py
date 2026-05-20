"""
Permission checker: evaluates if a user has a given permission code.
"""

from app.models.user import User


async def has_permission(user: User, permission_code: str) -> bool:
    """Check if user's role or individual user permissions include the given permission code."""
    # Check role-based permissions
    if user.role is not None:
        for rp in user.role.role_permissions:
            if rp.permission and rp.permission.code == permission_code:
                return True
    
    # Check user-specific task permissions
    for up in user.user_permissions:
        if up.permission and up.permission.code == permission_code:
            return True
    
    return False


async def get_user_permissions(user: User) -> list[str]:
    """Return flat list of permission codes for the user's role plus individual user permissions."""
    permission_codes = []
    
    # Role-based permissions
    if user.role is not None:
        permission_codes.extend([
            rp.permission.code
            for rp in user.role.role_permissions
            if rp.permission
        ])
    
    # User-specific permissions
    permission_codes.extend([
        up.permission.code
        for up in user.user_permissions
        if up.permission
    ])
    
    return permission_codes
