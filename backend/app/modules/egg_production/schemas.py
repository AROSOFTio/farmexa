"""
Egg production module schemas.
"""
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class EggProductionCreate(BaseModel):
    batch_id: int
    record_date: date
    good_eggs: int = Field(default=0, ge=0)
    cracked_eggs: int = Field(default=0, ge=0)
    damaged_eggs: int = Field(default=0, ge=0)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def compute_totals(self) -> "EggProductionCreate":
        self.total_eggs = self.good_eggs + self.cracked_eggs + self.damaged_eggs
        self.total_trays = round(self.total_eggs / 30, 2)
        return self

    total_eggs: int = 0
    total_trays: float = 0.0


class EggProductionUpdate(BaseModel):
    good_eggs: Optional[int] = Field(default=None, ge=0)
    cracked_eggs: Optional[int] = Field(default=None, ge=0)
    damaged_eggs: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None


class EggProductionOut(BaseModel):
    id: int
    batch_id: int
    record_date: date
    good_eggs: int
    cracked_eggs: int
    damaged_eggs: int
    total_eggs: int
    total_trays: float
    production_rate: Optional[float]
    notes: Optional[str]

    model_config = {"from_attributes": True}


class EggProductionSummary(BaseModel):
    total_good: int
    total_cracked: int
    total_damaged: int
    total_eggs: int
    total_trays: float
    avg_production_rate: Optional[float]
    records_count: int
