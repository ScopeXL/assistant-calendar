"""Injectable time, so tests never depend on the wall clock."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Protocol


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


class FakeClock:
    """Stands still until told to move (unit and API tests)."""

    def __init__(self, start: datetime) -> None:
        if start.tzinfo is None:
            raise ValueError("FakeClock needs a timezone-aware start time")
        self._now = start

    def now(self) -> datetime:
        return self._now

    def advance(self, **kwargs: float) -> None:
        self._now += timedelta(**kwargs)

    def set(self, value: datetime) -> None:
        self._now = value


class ShiftableClock:
    """Real time plus an offset (end-to-end runs: POST /api/_test/clock). Time keeps flowing,
    so the display's clock ticks, but a test can jump to sunset or past midnight."""

    def __init__(self) -> None:
        self._offset = timedelta()

    def now(self) -> datetime:
        return datetime.now(UTC) + self._offset

    def advance(self, **kwargs: float) -> None:
        self._offset += timedelta(**kwargs)

    def set(self, value: datetime) -> None:
        if value.tzinfo is None:
            raise ValueError("the clock needs a timezone-aware time")
        self._offset = value - datetime.now(UTC)

    def reset(self) -> None:
        self._offset = timedelta()
