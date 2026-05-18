from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

ReportFormat = Literal["pdf", "csv", "xlsx"]


class ReportField(BaseModel):
    key: str
    label: str
    default: bool = True


class ReportFilter(BaseModel):
    key: str
    label: str
    type: Literal["date", "text", "select"] = "text"


class ReportCatalogItem(BaseModel):
    key: str
    title: str
    category: str
    description: str
    fields: list[ReportField]
    filters: list[ReportFilter]


class ReportRequest(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    search: str | None = None
    selected_fields: list[str] = Field(default_factory=list)
    limit: int = Field(default=100, ge=1, le=500)


class ReportPreview(BaseModel):
    report: ReportCatalogItem
    selected_fields: list[str]
    filters_applied: dict[str, str | None]
    rows: list[dict[str, object]]
    totals: dict[str, float | int | str]
    row_count: int
