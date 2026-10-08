"""Column types shared by every feature: aware UTC datetimes, ISO dates, UUIDv7 ids (PLAN §10)."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import DateTime, Dialect, String
from sqlalchemy.types import TypeDecorator


def new_id() -> str:
    """Time-ordered ids (PLAN §5.5). The server makes them: phones on plain HTTP have no
    crypto.randomUUID() (PLAN §17 risk 6)."""
    return str(uuid.uuid7())


class UTCDateTime(TypeDecorator[datetime]):
    """Stores UTC; always returns timezone-aware datetimes (naive values are a bug)."""

    impl = DateTime(timezone=False)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("UTCDateTime needs a timezone-aware datetime")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC)


class IsoDate(TypeDecorator[date]):
    """A calendar date with no time zone (birthdays, all-day events), stored as ``YYYY-MM-DD``
    text so it reads the same in every zone and sorts as text."""

    impl = String(10)
    cache_ok = True

    def process_bind_param(self, value: date | None, dialect: Dialect) -> str | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            raise TypeError("IsoDate columns take a date, not a datetime")
        return value.isoformat()

    def process_result_value(self, value: Any, dialect: Dialect) -> date | None:
        if value is None:
            return None
        return date.fromisoformat(str(value))


def utcnow() -> datetime:
    return datetime.now(UTC)
