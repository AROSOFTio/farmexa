"""
FastAPI dependency injection: current user, permission checks, and tenant module access.
"""

from typing import Annotated
from datetime import date

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db

security_scheme = HTTPBearer()


def _is_platform_admin(user) -> bool:
    return bool(user.role and user.role.name in {"super_manager", "developer_admin"})


def _module_key_from_request_path(path: str) -> str | None:
    if "/api/v1/analytics/kpis" in path:
        return "dashboard"
    if "/api/v1/analytics/" in path or "/api/v1/reports/" in path:
        return "reports"
    if "/api/v1/eggs" in path:
        return "egg_production"
    if "/api/v1/farm/houses" in path:
        return "houses"
    if "/api/v1/farm/batches/" in path and "/mortality" in path:
        return "mortality"
    if "/api/v1/farm/batches/" in path and "/vaccinations" in path:
        return "vaccination"
    if "/api/v1/farm/vaccinations/" in path:
        return "vaccination"
    if "/api/v1/farm/batches/" in path and "/growth" in path:
        return "growth_tracking"
    if "/api/v1/farm/batches" in path:
        return "batches"
    if "/api/v1/feed/suppliers" in path:
        return "feed_suppliers"
    if "/api/v1/feed/purchases" in path:
        return "feed_purchases"
    if "/api/v1/feed/consumptions" in path:
        return "feed_consumption"
    if "/api/v1/feed/" in path:
        return "feed_stock"
    if "/api/v1/inventory/movements" in path:
        return "inventory_movements"
    if "/api/v1/inventory/items" in path:
        return "inventory_items"
    if "/api/v1/slaughter/records/" in path and "/outputs" in path:
        return "slaughter_outputs"
    if "/api/v1/slaughter/records" in path:
        return "slaughter_records"
    if "/api/v1/sales/customers" in path:
        return "customers"
    if "/api/v1/sales/orders" in path:
        return "sales_orders"
    if "/api/v1/sales/invoices/" in path and "/payments" in path:
        return "payments"
    if "/api/v1/sales/invoices" in path:
        return "invoices"
    if "/api/v1/finance/expenses" in path:
        return "expenses"
    if "/api/v1/finance/incomes" in path:
        return "income"
    if "/api/v1/compliance/summary" in path:
        return "compliance_alerts"
    if "/api/v1/compliance/" in path:
        return "compliance_documents"
    if "/api/v1/users" in path:
        return "users"
    if "/api/v1/settings" in path:
        return "settings"
    return None


async def _ensure_tenant_module_access(user, request: Request, permission_code: str) -> None:
    if _is_platform_admin(user):
        return

    if permission_code.startswith("dev_admin:"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer admin access is restricted to platform administrators.",
        )

    tenant = user.tenant
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is not assigned to a tenant.",
        )
    if tenant.is_suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your tenant account is suspended.",
        )
    subscriptions = sorted(
        tenant.subscriptions,
        key=lambda record: (record.start_date, record.created_at),
        reverse=True,
    )
    latest_subscription = subscriptions[0] if subscriptions else None
    if latest_subscription:
        if latest_subscription.status.value in {"expired", "cancelled"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription is not active.",
            )
        if latest_subscription.expiry_date and latest_subscription.expiry_date < date.today():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription has expired.",
            )

    module_key = _module_key_from_request_path(str(request.url.path))
    if module_key is None:
        return

    enabled_modules = {module.module_key for module in tenant.modules if module.is_enabled}
    if module_key not in enabled_modules:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Module '{module_key}' is not enabled for your tenant.",
        )


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

    async def checker(request: Request, current_user=Depends(get_current_user)):
        from app.permissions.checker import has_permission

        if not await has_permission(current_user, permission_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: '{permission_code}' required.",
            )
        await _ensure_tenant_module_access(current_user, request, permission_code)
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


CurrentUser = Annotated[object, Depends(get_current_user)]
