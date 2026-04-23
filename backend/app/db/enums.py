"""
Helpers for SQLAlchemy enums backed by explicit database enum values.
"""

from enum import Enum as PyEnum

from sqlalchemy import Enum


def db_enum(enum_cls: type[PyEnum], *, name: str) -> Enum:
    return Enum(
        enum_cls,
        name=name,
        values_callable=lambda members: [member.value for member in members],
        validate_strings=True,
    )
