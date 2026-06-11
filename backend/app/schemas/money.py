"""Shared Decimal field types for monetary, quantity, and weight values.

These mirror the precision/scale of the corresponding NUMERIC database
columns (see migration 024_numeric_money_columns) so that Pydantic
validation and serialization never reintroduce IEEE-754 float rounding
errors for financial data.
"""

from pydantic import condecimal

# Money: matches NUMERIC(18, 4) columns
Money = condecimal(max_digits=18, decimal_places=4)
PositiveMoney = condecimal(max_digits=18, decimal_places=4, gt=0)
NonNegativeMoney = condecimal(max_digits=18, decimal_places=4, ge=0)

# Quantity: matches NUMERIC(14, 4) columns
Quantity = condecimal(max_digits=14, decimal_places=4)
PositiveQuantity = condecimal(max_digits=14, decimal_places=4, gt=0)
NonNegativeQuantity = condecimal(max_digits=14, decimal_places=4, ge=0)

# Weight (kg): matches NUMERIC(12, 3) columns
Weight = condecimal(max_digits=12, decimal_places=3)
NonNegativeWeight = condecimal(max_digits=12, decimal_places=3, ge=0)
