"""Decimal helpers for money/quantity arithmetic.

Centralizes None -> Decimal('0') normalization and ROUND_HALF_UP quantization
so service-layer code never mixes float accumulators with Decimal-backed
ORM/Pydantic values (NUMERIC columns from migration 024).
"""

from decimal import Decimal, ROUND_HALF_UP

TWO_PLACES = Decimal("0.01")
FOUR_PLACES = Decimal("0.0001")


def to_decimal(value) -> Decimal:
    """Normalize None/int/float/Decimal/str to Decimal.

    - None -> Decimal('0')
    - Decimal -> passthrough
    - everything else -> Decimal(str(value)) (avoids binary-float artifacts)
    """
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def quantize_money(value, places: Decimal = TWO_PLACES) -> Decimal:
    """Quantize a Decimal/float/int/None to `places` using ROUND_HALF_UP."""
    return to_decimal(value).quantize(places, rounding=ROUND_HALF_UP)
