from datetime import date
from typing import Optional
import enum

from sqlalchemy import Date, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.enums import db_enum


class HouseStatus(str, enum.Enum):
    ACTIVE = "active"
    MAINTENANCE = "maintenance"
    INACTIVE = "inactive"


class BatchStatus(str, enum.Enum):
    ACTIVE = "active"
    DEPLETED = "depleted"
    SLAUGHTERED = "slaughtered"
    SOLD = "sold"


class VaccinationStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PoultryHouse(Base):
    __tablename__ = "poultry_houses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    capacity: Mapped[int] = mapped_column(Integer)
    status: Mapped[HouseStatus] = mapped_column(db_enum(HouseStatus, name="housestatus"), default=HouseStatus.ACTIVE)

    sections: Mapped[list["PoultryHouseSection"]] = relationship(
        "PoultryHouseSection",
        back_populates="house",
        cascade="all, delete-orphan",
        order_by="PoultryHouseSection.id",
    )
    batches: Mapped[list["Batch"]] = relationship("Batch", back_populates="house")


class PoultryHouseSection(Base):
    __tablename__ = "poultry_house_sections"
    __table_args__ = (UniqueConstraint("house_id", "name", name="uq_house_section_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("poultry_houses.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    section_type: Mapped[str] = mapped_column(String(80), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[HouseStatus] = mapped_column(db_enum(HouseStatus, name="housestatus"), default=HouseStatus.ACTIVE)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    house: Mapped["PoultryHouse"] = relationship("PoultryHouse", back_populates="sections")
    batches: Mapped[list["Batch"]] = relationship("Batch", back_populates="section")


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("poultry_houses.id"))
    section_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("poultry_house_sections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    stock_item_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("stock_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    breed: Mapped[str] = mapped_column(String(100))
    source: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    arrival_date: Mapped[date] = mapped_column(Date)
    initial_quantity: Mapped[int] = mapped_column(Integer)
    active_quantity: Mapped[int] = mapped_column(Integer)
    status: Mapped[BatchStatus] = mapped_column(db_enum(BatchStatus, name="batchstatus"), default=BatchStatus.ACTIVE)

    house: Mapped["PoultryHouse"] = relationship("PoultryHouse", back_populates="batches")
    section: Mapped[Optional["PoultryHouseSection"]] = relationship("PoultryHouseSection", back_populates="batches")
    stock_item: Mapped[Optional["StockItem"]] = relationship("StockItem", foreign_keys=[stock_item_id])
    mortality_logs: Mapped[list["MortalityLog"]] = relationship("MortalityLog", back_populates="batch", cascade="all, delete-orphan")
    vaccinations: Mapped[list["VaccinationLog"]] = relationship("VaccinationLog", back_populates="batch", cascade="all, delete-orphan")
    growth_logs: Mapped[list["GrowthLog"]] = relationship("GrowthLog", back_populates="batch", cascade="all, delete-orphan")


class MortalityLog(Base):
    __tablename__ = "mortality_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    record_date: Mapped[date] = mapped_column(Date)
    quantity: Mapped[int] = mapped_column(Integer)
    cause: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="mortality_logs")


class VaccinationLog(Base):
    __tablename__ = "vaccination_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    vaccine_name: Mapped[str] = mapped_column(String(150))
    scheduled_date: Mapped[date] = mapped_column(Date)
    administered_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[VaccinationStatus] = mapped_column(
        db_enum(VaccinationStatus, name="vaccinationstatus"),
        default=VaccinationStatus.PENDING,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="vaccinations")


class GrowthLog(Base):
    __tablename__ = "growth_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    record_date: Mapped[date] = mapped_column(Date)
    avg_weight_grams: Mapped[float] = mapped_column(Float)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    batch: Mapped["Batch"] = relationship("Batch", back_populates="growth_logs")
