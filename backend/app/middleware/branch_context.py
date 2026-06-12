from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class BranchContextMiddleware(BaseHTTPMiddleware):
    """Extract X-Branch-ID header and attach to request.state."""
    async def dispatch(self, request: Request, call_next):
        branch_id_str = request.headers.get("X-Branch-ID", "").strip()
        if branch_id_str.isdigit():
            request.state.active_branch_id = int(branch_id_str)
        else:
            request.state.active_branch_id = None
        return await call_next(request)
