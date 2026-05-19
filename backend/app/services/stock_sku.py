import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.inventory import StockItem


def _sku_base(prefix: str, name: str, max_name_length: int = 20) -> str:
    slug = re.sub(r"[^A-Z0-9]+", "-", (name or "").upper()).strip("-")
    if not slug:
        slug = "ITEM"
    return f"{prefix}-{slug[:max_name_length]}".strip("-")


def generate_unique_sku(db: Session, prefix: str, name: str) -> str:
    base = _sku_base(prefix, name)
    candidate = base
    suffix = 2
    while db.query(StockItem.id).filter(StockItem.sku == candidate).first() is not None:
        suffix_text = f"-{suffix}"
        candidate = f"{base[: max(1, 32 - len(suffix_text))]}{suffix_text}"
        suffix += 1
    return candidate


async def generate_unique_sku_async(db: AsyncSession, prefix: str, name: str) -> str:
    base = _sku_base(prefix, name)
    candidate = base
    suffix = 2
    while True:
        existing = (
            await db.execute(select(StockItem.id).where(StockItem.sku == candidate))
        ).scalar_one_or_none()
        if existing is None:
            return candidate
        suffix_text = f"-{suffix}"
        candidate = f"{base[: max(1, 32 - len(suffix_text))]}{suffix_text}"
        suffix += 1
