"""Public holidays (PLAN §8.1), made offline by the ``holidays`` package: no address, no
network. A country, and optionally a state or region, gives one read-only calendar from last
year to two years ahead, made again when the year turns."""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from datetime import date, datetime, timedelta

import holidays as holidays_lib

from sunroom.calendar.synced import PendingSeries, SyncedEvent, SyncedSeries
from sunroom.domain.recurrence import Timing
from sunroom.plugins.calendar_sync.providers.base import (
    Changes,
    ErrorKind,
    Pushed,
    RemoteCalendar,
    SyncError,
)

GENERATION = 1  # bump to make every holidays calendar again after a change here
READ_ONLY = "Holidays come from Sunroom's own list; they can't be changed."


def supported() -> dict[str, list[str]]:
    """Country codes and their state or region codes."""
    return {
        code: sorted(subdivisions)
        for code, subdivisions in holidays_lib.list_supported_countries().items()
        if len(code) == 2
    }


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "holiday"


class HolidaysProvider:
    def __init__(self, country: str, subdivision: str | None, now_of: Callable[[], datetime]):
        self._country = country.upper()
        self._subdivision = subdivision.upper() if subdivision else None
        self._now_of = now_of

    def remote_id(self) -> str:
        return f"holidays-{self._country}" + (f"-{self._subdivision}" if self._subdivision else "")

    async def calendars(self) -> list[RemoteCalendar]:
        return [RemoteCalendar(self.remote_id(), "Holidays", None, read_only=True)]

    def days(self, years: list[int]) -> dict[date, list[str]]:
        try:
            found = holidays_lib.country_holidays(
                self._country, subdiv=self._subdivision, years=years
            )
        except (NotImplementedError, KeyError) as exc:
            raise SyncError(
                ErrorKind.BAD_DATA, "Sunroom doesn't have holidays for that place."
            ) from exc
        out: dict[date, list[str]] = {}
        for day, names in found.items():
            out[day] = [name.strip() for name in str(names).split(";") if name.strip()]
        return out

    async def changes(
        self, calendar: RemoteCalendar, cursor: str | None, known: Mapping[str, str | None]
    ) -> Changes:
        year = self._now_of().year
        fresh = f"{GENERATION}:{self.remote_id()}:{year}"
        if cursor == fresh:
            return Changes()
        series: list[SyncedSeries] = []
        for day, names in sorted(self.days([year - 1, year, year + 1, year + 2]).items()):
            for name in names:
                series.append(
                    SyncedSeries(
                        uid=f"{day.isoformat()}-{_slug(name)}@holidays.sunroom",
                        master=SyncedEvent(
                            title=name,
                            timing=Timing(
                                all_day=True, start_date=day, end_date=day + timedelta(days=1)
                            ),
                        ),
                        etag=f"{GENERATION}:{name}",
                    )
                )
        return Changes(series=series, complete=True, cursor=fresh)

    async def push(self, calendar: RemoteCalendar, pending: PendingSeries) -> Pushed:
        raise SyncError(ErrorKind.REFUSED, READ_ONLY)

    async def delete(self, calendar: RemoteCalendar, pending: PendingSeries) -> None:
        raise SyncError(ErrorKind.REFUSED, READ_ONLY)
