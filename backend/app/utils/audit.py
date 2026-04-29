from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auth import AuditLog


async def write_audit_log(
    db: AsyncSession,
    *,
    user_id: int | None,
    action: str,
    entity: str,
    entity_id: int | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            meta=json.dumps(meta or {}, default=str),
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.flush()
