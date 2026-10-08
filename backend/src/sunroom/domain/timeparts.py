"""Wall times, instants and recurrence ids (PLAN §7.2).

Timed events are stored as UTC instants plus a zone; recurrence rules run on naive wall times
in that zone. A recurrence id is an occurrence's original start as the rule wrote it: a naive
wall time for timed events ("2026-10-09T16:00:00") or a date for all-day ones ("2026-10-09").
``UTC`` is ``datetime.UTC``, which is ``timezone.utc``.
"""

from __future__ import annotations

import re
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

FAR_FUTURE = datetime(9999, 12, 31, tzinfo=UTC)  # the window end of a series that never ends

_RID_DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
_RID_TIMED = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}")


def to_local(instant: datetime, zone: ZoneInfo) -> datetime:
    """An aware instant as naive wall time in ``zone``."""
    if instant.tzinfo is None:
        raise ValueError("to_local needs a timezone-aware instant")
    return instant.astimezone(zone).replace(tzinfo=None)


def from_local(naive: datetime, zone: ZoneInfo) -> datetime:
    """Naive wall time in ``zone`` as an aware UTC instant. A time in the spring-forward gap
    moves forward by the gap (RFC 5545 §3.3.5: 2:30 becomes 3:30); a time that happens twice
    when clocks fall back is the first of the two."""
    if naive.tzinfo is not None:
        raise ValueError("from_local needs a naive wall time")
    return naive.replace(tzinfo=zone, fold=0).astimezone(UTC)


def rid_timed(naive_local: datetime) -> str:
    if naive_local.tzinfo is not None:
        raise ValueError("a recurrence id is a naive wall time")
    return naive_local.isoformat(timespec="seconds")


def rid_date(day: date) -> str:
    return date(day.year, day.month, day.day).isoformat()


def _read_rid(rid: str) -> datetime | date | None:
    try:
        if _RID_TIMED.fullmatch(rid):
            return datetime.fromisoformat(rid)
        if _RID_DATE.fullmatch(rid):
            return date.fromisoformat(rid)
    except ValueError:  # a day or hour that doesn't exist
        return None
    return None


def parse_rid(rid: str) -> datetime | date:
    """A naive datetime for a timed id, a date for an all-day id."""
    value = _read_rid(rid)
    if isinstance(value, datetime):
        if rid_timed(value) == rid:
            return value
    elif value is not None and rid_date(value) == rid:
        return value
    raise ValueError(f"not a recurrence id: {rid!r}")


def day_bounds(day: date, zone: ZoneInfo) -> tuple[datetime, datetime]:
    """[local midnight, next local midnight) as aware UTC instants."""
    midnight = datetime.combine(day, time())
    return from_local(midnight, zone), from_local(midnight + timedelta(days=1), zone)


def iso_monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def week_start(day: date, week_starts_on: int) -> date:
    """The first day of ``day``'s week; ``week_starts_on`` is 0 (Monday) to 6 (Sunday)."""
    if not 0 <= week_starts_on <= 6:
        raise ValueError("week_starts_on is 0 (Monday) to 6 (Sunday)")
    return day - timedelta(days=(day.weekday() - week_starts_on) % 7)
