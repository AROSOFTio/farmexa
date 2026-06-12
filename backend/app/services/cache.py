"""Redis caching service for expensive read queries."""
from __future__ import annotations
import json
import hashlib
from decimal import Decimal
from typing import Any, Optional
import redis as redis_lib
from app.core.config import settings


class _DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)


_client: Optional[redis_lib.Redis] = None


def _get_client() -> Optional[redis_lib.Redis]:
    global _client
    if _client is None:
        try:
            _client = redis_lib.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            _client.ping()
        except Exception:
            _client = None
    return _client


def cache_key(*parts) -> str:
    raw = ":".join(str(p) for p in parts if p is not None)
    return f"farmexa:{raw}"


def cache_get(key: str) -> Any | None:
    try:
        r = _get_client()
        if not r:
            return None
        raw = r.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    try:
        r = _get_client()
        if not r:
            return
        r.setex(key, ttl, json.dumps(value, cls=_DecimalEncoder, default=str))
    except Exception:
        pass


def cache_delete(key: str) -> None:
    try:
        r = _get_client()
        if r:
            r.delete(key)
    except Exception:
        pass


def cache_delete_pattern(pattern: str) -> None:
    try:
        r = _get_client()
        if not r:
            return
        keys = r.keys(pattern)
        if keys:
            r.delete(*keys)
    except Exception:
        pass
