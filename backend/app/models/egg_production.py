"""
Egg Production model for daily egg collection tracking.
"""

from datetime import date
from typing import Optional

from sqlalchemy import Date, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EggProductionLog(Base):
    """Daily egg production record linked to a batch."""

    __tablename__ = "egg_production_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), index=True)
    record_date: Mapped[date] = mapped_column(Date, index=True)

    good_eggs: Mapped[int] = mapped_column(Integer, default=0)
    cracked_eggs: Mapped[int] = mapped_column(Integer, default=0)
    damaged_eggs: Mapped[int] = mapped_column(Integer, default=0)

    # Computed helpers stored for quick reporting
    total_eggs: Mapped[int] = mapped_column(Integer, default=0)
    total_trays: Mapped[float] = mapped_column(Float, default=0.0)  # 30 eggs per tray

    production_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # % of birds laying

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    batch: Mapped["Batch"] = relationship("Batch")  # type: ignore[name-defined]
