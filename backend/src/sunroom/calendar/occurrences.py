"""Concrete occurrences for a date range (PLAN §7.3).

Per calendar and ISO week, an LRU cache keyed by the calendar's version (and the household's
zone) holds the expanded occurrences; a miss costs three indexed queries and the expansion.
Overlays (computed, read-only occurrences from plugins: meals, countdowns, chores) are added
on request and never cached (PLAN §7.6).
"""

from __future__ import annotations

from collections import OrderedDict
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sunroom.calendar.models import (
    Calendar,
    CalendarKind,
    Event,
    EventMember,
    EventReminder,
    EventStatus,
)
from sunroom.calendar.schemas import OccurrenceOut
from sunroom.calendar.timing import override_of, series_of
from sunroom.domain import recurrence
from sunroom.domain.recurrence import Occurrence, Window
from sunroom.domain.timeparts import day_bounds, iso_monday, to_local

CACHE_SIZE = 512
MAX_DAYS = 93

# A plugin's overlay: (from, to, zone) → read-only occurrences (PLAN §7.6).
OverlayProvider = Callable[[date, date, ZoneInfo], Awaitable[Sequence[OccurrenceOut]]]
CacheKey = tuple[str, date, int, str]


@dataclass
class OccurrenceCache:
    size: int = CACHE_SIZE
    _entries: OrderedDict[CacheKey, list[OccurrenceOut]] = field(
        default_factory=OrderedDict[CacheKey, list[OccurrenceOut]]
    )
    hits: int = 0
    misses: int = 0

    def get(self, key: CacheKey) -> list[OccurrenceOut] | None:
        found = self._entries.get(key)
        if found is None:
            self.misses += 1
            return None
        self._entries.move_to_end(key)
        self.hits += 1
        return found

    def put(self, key: CacheKey, value: list[OccurrenceOut]) -> None:
        self._entries[key] = value
        self._entries.move_to_end(key)
        while len(self._entries) > self.size:
            self._entries.popitem(last=False)

    def clear(self) -> None:
        self._entries.clear()


@dataclass
class CalendarRuntime:
    """The calendar's in-memory part: the cache and the overlays plugins registered."""

    cache: OccurrenceCache = field(default_factory=OccurrenceCache)
    overlays: dict[str, OverlayProvider] = field(default_factory=dict[str, OverlayProvider])


def _out(
    calendar: Calendar,
    master: Event,
    row: Event,
    occurrence: Occurrence,
    members: dict[str, list[str]],
    reminders: dict[str, list[int]],
    zone: ZoneInfo,
) -> OccurrenceOut:
    timing = occurrence.timing
    start_local = to_local(timing.start_utc, zone) if timing.start_utc else None
    end_local = to_local(timing.end_utc, zone) if timing.end_utc else None
    people = members.get(row.id, [])
    color = row.color
    if calendar.kind == CalendarKind.SYNC:
        # A synced calendar's events are its person's (UX §5), in its color when it has none.
        if not people and calendar.owner_member_id:
            people = [calendar.owner_member_id]
        if color is None and not calendar.owner_member_id:
            color = calendar.color
    return OccurrenceOut(
        key=f"{master.id}|{occurrence.recurrence_id or ''}",
        event_id=master.id,
        recurrence_id=occurrence.recurrence_id,
        calendar_id=calendar.id,
        title=row.title,
        location=row.location,
        all_day=timing.all_day,
        start_utc=timing.start_utc,
        end_utc=timing.end_utc,
        start_local=start_local,
        end_local=end_local,
        start_date=timing.start_date,
        end_date=timing.end_date,
        member_ids=people,
        color=color,  # pyright: ignore[reportArgumentType]
        calendar_color=calendar.color,  # pyright: ignore[reportArgumentType]
        is_recurring=bool(master.rrule) or master.rdates_json not in ("", "[]"),
        is_override=occurrence.is_override,
        read_only=calendar.read_only,
        source=master.source,
        pending=master.pending_push or master.pending_delete,
        status=row.status,
        overlay=None,
        reminders=reminders.get(row.id, []),
        version=master.version,
    )


async def _expand_bucket(
    session: AsyncSession, calendar: Calendar, monday: date, zone: ZoneInfo
) -> list[OccurrenceOut]:
    start_utc, _ = day_bounds(monday, zone)
    _, end_utc = day_bounds(monday + timedelta(days=6), zone)
    masters = list(
        (
            await session.scalars(
                select(Event).where(
                    Event.calendar_id == calendar.id,
                    Event.parent_event_id.is_(None),
                    Event.deleted_at.is_(None),
                    Event.window_start_utc < end_utc,
                    Event.window_end_utc > start_utc,
                )
            )
        ).all()
    )
    if not masters:
        return []
    by_master: dict[str, list[Event]] = {m.id: [] for m in masters}
    overrides = (
        await session.scalars(
            select(Event).where(
                Event.parent_event_id.in_(list(by_master)), Event.deleted_at.is_(None)
            )
        )
    ).all()
    for row in overrides:
        by_master[row.parent_event_id or ""].append(row)
    ids = [*by_master, *(o.id for o in overrides)]
    members: dict[str, list[str]] = {}
    for event_id, member_id in (
        await session.execute(
            select(EventMember.event_id, EventMember.member_id).where(EventMember.event_id.in_(ids))
        )
    ).all():
        members.setdefault(event_id, []).append(member_id)
    reminders: dict[str, list[int]] = {}
    for event_id, minutes in (
        await session.execute(
            select(EventReminder.event_id, EventReminder.minutes_before).where(
                EventReminder.event_id.in_(ids)
            )
        )
    ).all():
        reminders.setdefault(event_id, []).append(minutes)
    for values in reminders.values():
        values.sort()

    window = Window(start_utc, end_utc, monday, monday + timedelta(days=7))
    out: list[OccurrenceOut] = []
    for master in masters:
        rows = {o.recurrence_id: o for o in by_master[master.id]}
        found = recurrence.expand(
            series_of(master), [override_of(o) for o in by_master[master.id]], window
        )
        for occurrence in found:
            row = rows.get(occurrence.recurrence_id) if occurrence.is_override else None
            out.append(_out(calendar, master, row or master, occurrence, members, reminders, zone))
    return out


def sort_key(item: OccurrenceOut) -> tuple[datetime, int, str]:
    if item.all_day:
        assert item.start_date is not None
        return datetime.combine(item.start_date, time.min), 0, item.title
    assert item.start_local is not None
    return item.start_local, 1, item.title


def _overlaps(item: OccurrenceOut, start: date, end: date, zone: ZoneInfo) -> bool:
    if item.all_day:
        assert item.start_date is not None and item.end_date is not None
        return item.start_date < end and item.end_date > start
    assert item.start_utc is not None and item.end_utc is not None
    from_utc, _ = day_bounds(start, zone)
    to_utc, _ = day_bounds(end, zone)
    if item.start_utc == item.end_utc:
        return from_utc <= item.start_utc < to_utc
    return item.start_utc < to_utc and item.end_utc > from_utc


async def occurrences(
    session: AsyncSession,
    runtime: CalendarRuntime,
    calendars: Sequence[Calendar],
    start: date,
    end: date,
    zone: ZoneInfo,
    *,
    include_cancelled: bool = False,
) -> list[OccurrenceOut]:
    """Every occurrence in [start, end) (household-zone dates) for these calendars."""
    found: dict[str, OccurrenceOut] = {}
    monday = iso_monday(start)
    while monday < end:
        for calendar in calendars:
            key: CacheKey = (calendar.id, monday, calendar.version, zone.key)
            bucket = runtime.cache.get(key)
            if bucket is None:
                bucket = await _expand_bucket(session, calendar, monday, zone)
                runtime.cache.put(key, bucket)
            for item in bucket:
                found.setdefault(item.key, item)
        monday += timedelta(days=7)
    result = [
        item
        for item in found.values()
        if _overlaps(item, start, end, zone)
        and (include_cancelled or item.status != EventStatus.CANCELLED)
    ]
    result.sort(key=sort_key)
    return result


async def overlay_occurrences(
    runtime: CalendarRuntime, keys: Sequence[str], start: date, end: date, zone: ZoneInfo
) -> list[OccurrenceOut]:
    out: list[OccurrenceOut] = []
    for key in keys:
        provider = runtime.overlays.get(key)
        if provider is not None:
            out.extend(await provider(start, end, zone))
    return out
