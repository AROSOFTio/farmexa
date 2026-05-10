from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException


def validate_feed_formula_percentages(ingredients: dict[str, float]) -> None:
    total = sum(Decimal(str(value)) for value in ingredients.values())
    if total.quantize(Decimal("0.01")) != Decimal("100.00"):
        raise HTTPException(status_code=422, detail="Feed formulation ingredient percentages must total exactly 100%.")


def calculate_feed_requirements(output_kg: float, percentages: dict[str, float]) -> dict[str, float]:
    validate_feed_formula_percentages(percentages)
    output = Decimal(str(output_kg))
    return {
        ingredient: float((output * Decimal(str(percent)) / Decimal("100")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP))
        for ingredient, percent in percentages.items()
    }


def ensure_sufficient_stock(required: dict[str, float], available: dict[str, float]) -> None:
    shortages = [
        f"{item}: required {qty}, available {available.get(item, 0)}"
        for item, qty in required.items()
        if Decimal(str(available.get(item, 0))) < Decimal(str(qty))
    ]
    if shortages:
        raise HTTPException(status_code=400, detail=f"Insufficient stock. {'; '.join(shortages)}")


def calculate_slaughter_yield(live_weight_kg: float, dressed_weight_kg: float) -> float:
    if live_weight_kg <= 0:
        raise HTTPException(status_code=422, detail="Live weight must be greater than zero.")
    return float((Decimal(str(dressed_weight_kg)) / Decimal(str(live_weight_kg)) * Decimal("100")).quantize(Decimal("0.01")))


@dataclass
class PosSaleResult:
    total: float
    remaining_stock_kg: float


def calculate_pos_sale(*, available_kg: float, requested_kg: float, price_per_kg: float) -> PosSaleResult:
    if requested_kg <= 0:
        raise HTTPException(status_code=422, detail="Sale quantity must be greater than zero.")
    if Decimal(str(available_kg)) < Decimal(str(requested_kg)):
        raise HTTPException(status_code=400, detail="Insufficient sales store stock.")
    total = Decimal(str(requested_kg)) * Decimal(str(price_per_kg))
    remaining = Decimal(str(available_kg)) - Decimal(str(requested_kg))
    return PosSaleResult(total=float(total.quantize(Decimal("0.01"))), remaining_stock_kg=float(remaining))
