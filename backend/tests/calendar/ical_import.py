"""A test-only importer: an .ics file's VEVENTs as the recurrence engine's types.

Just enough for the ICS goldens (the sync plugin brings the real importer in M2). One series
per UID: the VEVENT without RECURRENCE-ID is the master, the others are overrides, and a
cancelled one cancels its occurrence. Floating times take the household's zone, recurrence ids
are wall times in the master's zone, and RRULE goes through ``validate_rrule`` as a write
would."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from icalendar import Calendar, Event

from sunroom.domain.recurrence import Override, Series, Timing, validate_rrule
from sunroom.domain.timeparts import UTC, from_local, rid_date, rid_timed, to_local


@dataclass
class Imported:
    uid: str
    title: str
    series: Series
    overrides: list[Override] = field(default_factory=list[Override])


def zone_of(value: date | datetime, household: ZoneInfo) -> ZoneInfo:
    """The zone a DTSTART runs in: its TZID, or the household's for a floating time."""
    if isinstance(value, datetime) and isinstance(value.tzinfo, ZoneInfo):
        return value.tzinfo
    if isinstance(value, datetime) and value.tzinfo is not None:
        raise ValueError(f"not an IANA zone: {value.tzinfo!r}")
    return household


def instant(value: datetime, household: ZoneInfo) -> datetime:
    if value.tzinfo is None:
        return from_local(value, household)
    return value.astimezone(UTC)


def rid(value: date | datetime, zone: ZoneInfo) -> str:
    """A RECURRENCE-ID, EXDATE or RDATE value as a recurrence id in the series' zone."""
    if not isinstance(value, datetime):
        return rid_date(value)
    if value.tzinfo is None:
        return rid_timed(value)
    return rid_timed(to_local(value.astimezone(UTC), zone))


def timing_of(event: Event, household: ZoneInfo) -> Timing:
    start, end = event.start, event.end
    if not isinstance(start, datetime):
        assert not isinstance(end, datetime)
        return Timing(all_day=True, start_date=start, end_date=end)
    assert isinstance(end, datetime)
    return Timing(
        all_day=False, start_utc=instant(start, household), end_utc=instant(end, household)
    )


def load(path: Path, household: ZoneInfo) -> list[Imported]:
    calendar = Calendar.from_ical(path.read_bytes())
    found: dict[str, Imported] = {}
    changes: list[Event] = []
    for event in calendar.events:
        if event.RECURRENCE_ID is not None:
            changes.append(event)
            continue
        zone = zone_of(event.start, household)
        timing = timing_of(event, household)
        rules = event.rrules
        if len(rules) > 1:
            raise ValueError("one RRULE per event")
        rrule = validate_rrule(rules[0].to_ical().decode(), timing, zone.key) if rules else None
        rdates: list[str] = []
        for start, end in event.rdates:
            if end is not None:
                raise ValueError("RDATE periods aren't supported here")
            rdates.append(rid(start, zone))
        series = Series(
            timing=timing,
            tzid=zone.key,
            rrule=rrule,
            rdates=tuple(sorted(rdates)),
            exdates=frozenset(rid(day, zone) for day in event.exdates),
        )
        found[event.uid] = Imported(event.uid, event.summary or "", series)
    for event in changes:
        master = found[event.uid]
        assert event.RECURRENCE_ID is not None
        original = rid(event.RECURRENCE_ID, ZoneInfo(master.series.tzid))
        cancelled = str(event.get("STATUS", "")).upper() == "CANCELLED"
        timing = None if cancelled else timing_of(event, household)
        master.overrides.append(Override(original, timing))
    return list(found.values())
