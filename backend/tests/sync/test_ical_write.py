"""Writing calendars for a push (PLAN §7.5, §8.1, ADR 0005): a CalDAV resource is patched where
Sunroom changed something and keeps the rest (alarms, attendees, X-APPLE-* properties) as the
server wrote it; a series without one becomes a new VCALENDAR that reads back the same.

A New York household; 2026. Synthetic data only."""

from __future__ import annotations

from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from textwrap import dedent
from typing import cast
from zoneinfo import ZoneInfo

import pytest
from icalendar import Calendar, Component, Event, Timezone

from sunroom.calendar.synced import SyncedEvent, SyncedOverride, SyncedSeries
from sunroom.domain.recurrence import Timing
from sunroom.domain.timeparts import from_local
from sunroom.plugins.calendar_sync.ical import PRODID, build_calendar, parse_calendar

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "ics"
NY = ZoneInfo("America/New_York")
NOW = datetime(2026, 10, 8, 14, 0, tzinfo=UTC)
STAMP = b"20261008T140000Z"

RESOURCE = dedent("""\
    BEGIN:VCALENDAR
    VERSION:2.0
    PRODID:-//Apple Inc.//macOS 15.0//EN
    CALSCALE:GREGORIAN
    BEGIN:VTIMEZONE
    TZID:America/New_York
    BEGIN:DAYLIGHT
    TZOFFSETFROM:-0500
    RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
    DTSTART:20070311T020000
    TZNAME:EDT
    TZOFFSETTO:-0400
    END:DAYLIGHT
    BEGIN:STANDARD
    TZOFFSETFROM:-0400
    RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
    DTSTART:20071104T020000
    TZNAME:EST
    TZOFFSETTO:-0500
    END:STANDARD
    END:VTIMEZONE
    BEGIN:VEVENT
    CREATED:20260901T120000Z
    UID:sample-swim-class
    DTEND;TZID=America/New_York:20261007T170000
    TRANSP:OPAQUE
    X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC
    SUMMARY:Sample swim class
    LAST-MODIFIED:20260901T120000Z
    DTSTAMP:20260901T120000Z
    DTSTART;TZID=America/New_York:20261007T160000
    SEQUENCE:2
    RRULE:FREQ=WEEKLY;BYDAY=WE
    EXDATE;TZID=America/New_York:20261021T160000
    LOCATION:Sample pool\\n1 Sample Street
    X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-ADDRESS="1 Sample Street";X-APPLE-
     RADIUS=70;X-TITLE="Sample pool":geo:0.000000,0.000000
    ATTENDEE;CN="Ana Sample";CUTYPE=INDIVIDUAL;EMAIL=ana@example.com;PARTSTAT=AC
     CEPTED;ROLE=REQ-PARTICIPANT:mailto:ana@example.com
    ORGANIZER;CN="Sam Sample";EMAIL=sam@example.com:mailto:sam@example.com
    CATEGORIES:Sports,Kids
    URL;VALUE=URI:https://example.com/swim
    X-SAMPLE-UNKNOWN;X-SAMPLE-PARAM=keep:keep me as I am
    BEGIN:VALARM
    X-WR-ALARMUID:00000000-0000-0000-0000-00000000A1A1
    UID:00000000-0000-0000-0000-00000000A1A1
    TRIGGER:-PT15M
    ATTACH;VALUE=URI:Chord
    ACTION:AUDIO
    END:VALARM
    END:VEVENT
    BEGIN:VEVENT
    CREATED:20260901T120000Z
    UID:sample-swim-class
    DTEND;TZID=America/New_York:20261014T180000
    TRANSP:OPAQUE
    SUMMARY:Sample swim class (late)
    LAST-MODIFIED:20260905T120000Z
    DTSTAMP:20260905T120000Z
    DTSTART;TZID=America/New_York:20261014T170000
    SEQUENCE:3
    RECURRENCE-ID;TZID=America/New_York:20261014T160000
    X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC
    BEGIN:VALARM
    X-WR-ALARMUID:00000000-0000-0000-0000-00000000B2B2
    UID:00000000-0000-0000-0000-00000000B2B2
    TRIGGER:-PT30M
    ACTION:DISPLAY
    DESCRIPTION:Reminder
    END:VALARM
    END:VEVENT
    END:VCALENDAR
""")
UNMODELED = (
    "CREATED",
    "TRANSP",
    "X-APPLE-TRAVEL-ADVISORY-BEHAVIOR",
    "X-APPLE-STRUCTURED-LOCATION",
    "ATTENDEE",
    "ORGANIZER",
    "CATEGORIES",
    "URL",
    "X-SAMPLE-UNKNOWN",
)


def fetched(text: str = RESOURCE) -> SyncedSeries:
    parsed = parse_calendar(text, NY, remote_id="/calendars/sample/swim.ics", keep_raw=True)
    assert parsed.refused == []
    assert len(parsed.series) == 1
    return parsed.series[0]


def reread(text: str) -> SyncedSeries:
    parsed = parse_calendar(text, NY)
    assert parsed.refused == []
    assert len(parsed.series) == 1
    return parsed.series[0]


def events(text: str) -> list[Event]:
    return [c for c in Calendar.from_ical(text.encode()).subcomponents if isinstance(c, Event)]


def wire(component: Component, name: str) -> list[tuple[bytes, dict[str, str]]]:
    """A property's values as the server would read them: value text and parameters."""
    value: object = component.get(name)
    values = cast("list[object]", value) if isinstance(value, list) else [value]
    found: list[tuple[bytes, dict[str, str]]] = []
    for item in values:
        to_ical = getattr(item, "to_ical", None)
        assert to_ical is not None, name
        params = getattr(item, "params", {})
        found.append((to_ical(), {str(k): str(v) for k, v in params.items()}))
    return found


def alarms(component: Component) -> list[Component]:
    return [sub for sub in component.subcomponents if sub.name == "VALARM"]


def wall(text: str, zone: ZoneInfo = NY) -> datetime:
    return from_local(datetime.fromisoformat(text), zone)


def moved(event: SyncedEvent, delta: timedelta) -> SyncedEvent:
    timing = event.timing
    assert timing.start_utc is not None and timing.end_utc is not None
    return replace(
        event,
        timing=replace(timing, start_utc=timing.start_utc + delta, end_utc=timing.end_utc + delta),
    )


def test_a_push_changes_what_changed_and_keeps_everything_else() -> None:
    """The title changes and the class moves to 4:30 for good. The calendar moves the skipped
    week and the changed occurrence with it (PLAN §7.4), as here."""
    before = fetched()
    assert before.master is not None
    late = before.overrides[0]
    after = replace(
        before,
        master=replace(moved(before.master, timedelta(minutes=30)), title="Sample swim lesson"),
        exdates=("2026-10-21T16:30:00",),
        overrides=(replace(late, recurrence_id="2026-10-14T16:30:00"),),
    )
    text = build_calendar(after, base=before.raw_ical, now=NOW)

    again = reread(text)
    assert again.master is not None
    assert again.master.title == "Sample swim lesson"
    assert again.master.timing.start_utc == wall("2026-10-07T16:30:00")
    assert again.master.timing.end_utc == wall("2026-10-07T17:30:00")
    assert (again.rrule, again.exdates) == ("FREQ=WEEKLY;BYDAY=WE", ("2026-10-21T16:30:00",))
    assert again.overrides == (replace(late, recurrence_id="2026-10-14T16:30:00"),)
    assert again.sequence == 3  # the time and the rule's dates changed

    old_master, old_late = events(RESOURCE)
    new_master, new_late = events(text)
    for name in UNMODELED:
        assert wire(new_master, name) == wire(old_master, name), name
    assert alarms(new_master) == alarms(old_master)
    assert wire(new_master, "DTSTAMP")[0][0] == STAMP
    assert wire(new_master, "LAST-MODIFIED")[0][0] == STAMP
    # The changed occurrence is the server's own component, under its new RECURRENCE-ID.
    assert wire(new_late, "RECURRENCE-ID") == [(b"20261014T163000", {"TZID": "America/New_York"})]
    assert alarms(new_late) == alarms(old_late)
    assert wire(new_late, "SEQUENCE") == [(b"4", {})]
    assert wire(new_late, "DTSTART") == wire(old_late, "DTSTART")

    old_calendar = Calendar.from_ical(RESOURCE.encode())
    new_calendar = Calendar.from_ical(text.encode())
    assert new_calendar.get("PRODID") == old_calendar.get("PRODID")
    assert [c for c in new_calendar.subcomponents if isinstance(c, Timezone)] == [
        c for c in old_calendar.subcomponents if isinstance(c, Timezone)
    ]


def test_an_unchanged_series_goes_back_as_it_came() -> None:
    before = fetched()
    text = build_calendar(before, base=before.raw_ical, now=NOW)
    assert Calendar.from_ical(text.encode()) == Calendar.from_ical(RESOURCE.encode())


def test_a_new_title_alone_doesnt_move_the_sequence() -> None:
    before = fetched()
    assert before.master is not None
    after = replace(before, master=replace(before.master, title="Sample swim lesson"))
    master, late = events(build_calendar(after, base=before.raw_ical, now=NOW))
    assert wire(master, "SEQUENCE") == [(b"2", {})]
    assert wire(master, "LAST-MODIFIED")[0][0] == STAMP
    assert wire(late, "LAST-MODIFIED")[0][0] == b"20260905T120000Z"  # untouched


def test_what_sunroom_trims_or_fills_in_never_goes_back() -> None:
    """A long title is shown trimmed, an untitled event as "No title": neither is pushed back
    unless someone changed it."""
    long_title = "Sample " + "very " * 60 + "long title"
    text = dedent(f"""\
        BEGIN:VCALENDAR
        VERSION:2.0
        PRODID:-//Sample//Server//EN
        BEGIN:VEVENT
        UID:sample-long
        SUMMARY:{long_title}
        DTSTART;TZID=America/New_York:20261008T090000
        DTEND;TZID=America/New_York:20261008T100000
        END:VEVENT
        BEGIN:VEVENT
        UID:sample-untitled
        DTSTART;VALUE=DATE:20261009
        END:VEVENT
        END:VCALENDAR
    """)
    parsed = parse_calendar(text, NY)
    long_series, untitled = parsed.series
    assert long_series.master is not None and untitled.master is not None
    assert untitled.master.title == "No title"
    pushed = build_calendar(
        replace(long_series, master=moved(long_series.master, timedelta(hours=1))),
        base=text,
        now=NOW,
    )
    event = next(e for e in events(pushed) if str(e.get("UID")) == "sample-long")
    assert str(event.get("SUMMARY")) == long_title
    later = replace(
        untitled.master, timing=replace(untitled.master.timing, end_date=date(2026, 10, 11))
    )
    pushed = build_calendar(replace(untitled, master=later), base=text, now=NOW)
    event = next(e for e in events(pushed) if str(e.get("UID")) == "sample-untitled")
    assert "SUMMARY" not in event
    assert wire(event, "DTEND") == [(b"20261011", {"VALUE": "DATE"})]


def test_occurrences_changed_here_are_added_and_dropped() -> None:
    """Delete the late lesson (an EXDATE), and change Oct 28 to a later time."""
    before = fetched()
    assert before.master is not None
    later = SyncedEvent(
        title="Sample swim class (pool party)",
        timing=Timing(
            all_day=False,
            start_utc=wall("2026-10-28T18:00:00"),
            end_utc=wall("2026-10-28T20:00:00"),
        ),
        tzid="America/New_York",
    )
    after = replace(
        before,
        exdates=("2026-10-14T16:00:00", "2026-10-21T16:00:00"),
        overrides=(SyncedOverride("2026-10-28T16:00:00", later),),
    )
    text = build_calendar(after, base=before.raw_ical, now=NOW)

    again = reread(text)
    assert again.exdates == ("2026-10-14T16:00:00", "2026-10-21T16:00:00")
    assert again.overrides == (SyncedOverride("2026-10-28T16:00:00", later),)

    old_master = events(RESOURCE)[0]
    master, party = events(text)  # the late lesson's component is gone
    assert wire(master, "EXDATE") == [
        (b"20261021T160000", {"TZID": "America/New_York"}),  # the server's line, as it was
        (b"20261014T160000", {"TZID": "America/New_York"}),
    ]
    assert wire(party, "RECURRENCE-ID") == [(b"20261028T160000", {"TZID": "America/New_York"})]
    assert wire(party, "DTSTART") == [(b"20261028T180000", {"TZID": "America/New_York"})]
    # A new changed occurrence carries the master's other properties and its alarm (without
    # the alarm's own UID, which is the master's).
    for name in UNMODELED:
        if name != "CREATED":
            assert wire(party, name) == wire(old_master, name), name
    (alarm,) = alarms(party)
    assert "UID" not in alarm and "X-WR-ALARMUID" not in alarm
    assert wire(alarm, "TRIGGER") == wire(alarms(old_master)[0], "TRIGGER")
    assert wire(party, "SEQUENCE") == [(b"3", {})]  # the master's, which moved up


def test_a_cancelled_occurrence_the_calendar_keeps_as_an_exdate_stays_as_the_server_wrote_it() -> (
    None
):
    base = RESOURCE.replace(
        "SUMMARY:Sample swim class (late)", "SUMMARY:Sample swim class (late)\nSTATUS:CANCELLED"
    )
    before = fetched(base)
    assert before.overrides[0].event.cancelled
    # The calendar stores a cancelled occurrence as an EXDATE (calendar/sync_merge.py).
    stored = replace(before, exdates=("2026-10-14T16:00:00", *before.exdates), overrides=())
    assert stored.master is not None
    after = replace(stored, master=replace(stored.master, title="Sample swim lesson"))
    master, late = events(build_calendar(after, base=base, now=NOW))
    assert str(late.get("STATUS")) == "CANCELLED"
    assert wire(master, "EXDATE") == wire(events(RESOURCE)[0], "EXDATE")


def test_a_windows_tzid_is_kept_when_a_time_changes() -> None:
    base = (FIXTURES / "13-outlook-windows-tzid.ics").read_text()
    before = fetched(base)
    thursday = before.overrides[0]
    after = replace(
        before, overrides=(replace(thursday, event=moved(thursday.event, timedelta(minutes=30))),)
    )
    text = build_calendar(after, base=base, now=NOW)
    assert reread(text).overrides == after.overrides
    master, thursday_component = events(text)
    assert wire(thursday_component, "DTSTART") == [
        (b"20261029T163000", {"TZID": "Eastern Standard Time"})
    ]
    assert wire(master, "DTSTART") == wire(events(base)[0], "DTSTART")
    timezones = [
        c for c in Calendar.from_ical(text.encode()).subcomponents if isinstance(c, Timezone)
    ]
    assert [str(tz.get("TZID")) for tz in timezones] == ["Eastern Standard Time"]


def test_an_invitation_to_one_occurrence_keeps_its_recurrence_id() -> None:
    base = dedent("""\
        BEGIN:VCALENDAR
        VERSION:2.0
        PRODID:-//Sample//Server//EN
        BEGIN:VEVENT
        UID:sample-invite
        RECURRENCE-ID;TZID=America/New_York:20261015T100000
        SUMMARY:Sample school meeting
        DTSTART;TZID=America/New_York:20261015T110000
        DTEND;TZID=America/New_York:20261015T120000
        ORGANIZER;CN=Sample School:mailto:office@example.com
        END:VEVENT
        END:VCALENDAR
    """)
    before = fetched(base)
    assert before.master is not None
    after = replace(
        before,
        master=replace(moved(before.master, timedelta(hours=1)), title="Sample school meeting!"),
    )
    text = build_calendar(after, base=base, now=NOW)
    (event,) = events(text)
    assert wire(event, "RECURRENCE-ID") == [(b"20261015T100000", {"TZID": "America/New_York"})]
    assert wire(event, "DTSTART") == [(b"20261015T120000", {"TZID": "America/New_York"})]
    assert "RRULE" not in event
    again = reread(text)
    assert again.master == after.master


# --- A new calendar -----------------------------------------------------------------------------


def timed(start: str, end: str, zone: str = "America/New_York") -> Timing:
    return Timing(
        all_day=False, start_utc=wall(start, ZoneInfo(zone)), end_utc=wall(end, ZoneInfo(zone))
    )


NEW_SERIES = [
    SyncedSeries(
        uid="sample-new-timed",
        master=SyncedEvent(
            title="Sample soccer, at the park",
            timing=timed("2026-09-01T17:00:00", "2026-09-01T18:30:00"),
            tzid="America/New_York",
            description="Bring water;\nand shin guards",
            location="Sample Street park",
        ),
        rrule="FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261119T220000Z",
        rdates=("2026-11-21", "2026-11-22T10:00:00"),
        exdates=("2026-09-15T17:00:00", "2026-11-26"),
        overrides=(
            SyncedOverride(
                "2026-10-06T17:00:00",
                SyncedEvent(
                    title="Sample soccer (late)",
                    timing=timed("2026-10-06T18:00:00", "2026-10-06T19:30:00"),
                    tzid="America/New_York",
                ),
            ),
        ),
    ),
    SyncedSeries(
        uid="sample-new-all-day",
        master=SyncedEvent(
            title="Sample birthday",
            timing=Timing(all_day=True, start_date=date(2015, 3, 14), end_date=date(2015, 3, 15)),
        ),
        rrule="FREQ=YEARLY",
        exdates=("2020-03-14",),
    ),
    SyncedSeries(
        uid="sample-new-utc",
        master=SyncedEvent(
            title="Sample call",
            timing=timed("2026-10-08T09:00:00", "2026-10-08T09:30:00", "UTC"),
            tzid="UTC",
        ),
        rrule="FREQ=DAILY;COUNT=5",
        exdates=("2026-10-10T09:00:00",),
    ),
    SyncedSeries(
        uid="sample-new-floating",
        master=SyncedEvent(
            title="Sample bedtime story",
            timing=timed("2026-10-04T19:30:00", "2026-10-04T20:00:00"),
            tzid="America/New_York",
            floating=True,
        ),
        rrule="FREQ=WEEKLY",
    ),
    SyncedSeries(
        uid="sample-new-london",
        master=SyncedEvent(
            title="Sample choir",
            timing=timed("2026-10-07T19:00:00", "2026-10-07T20:30:00", "Europe/London"),
            tzid="Europe/London",
        ),
        rrule="FREQ=WEEKLY",
    ),
]


@pytest.mark.parametrize("series", NEW_SERIES, ids=[s.uid for s in NEW_SERIES])
def test_a_new_series_reads_back_the_same(series: SyncedSeries) -> None:
    text = build_calendar(series, now=NOW)
    calendar = Calendar.from_ical(text.encode())  # icalendar reads it
    assert str(calendar.get("PRODID")) == PRODID
    assert str(calendar.get("VERSION")) == "2.0"
    again = reread(text)
    assert again == replace(series, sequence=0, updated_at=NOW)
    assert all(wire(e, "DTSTAMP")[0][0] == STAMP for e in events(text))
    assert master_zone(calendar) == (
        series.master.tzid
        if series.master and series.master.tzid not in (None, "UTC") and not series.master.floating
        else None
    )


def master_zone(calendar: Calendar) -> str | None:
    zones = [str(c.get("TZID")) for c in calendar.subcomponents if isinstance(c, Timezone)]
    assert len(zones) <= 1
    return zones[0] if zones else None


def test_a_new_series_writes_times_as_its_zone_has_them() -> None:
    timed_series, _, utc_series, floating, _ = NEW_SERIES
    (master, late) = events(build_calendar(timed_series, now=NOW))
    assert wire(master, "DTSTART") == [(b"20260901T170000", {"TZID": "America/New_York"})]
    assert wire(master, "EXDATE") == [
        (b"20260915T170000", {"TZID": "America/New_York"}),
        (b"20261126", {"VALUE": "DATE"}),  # a date id stays a date
    ]
    assert wire(late, "RECURRENCE-ID") == [(b"20261006T170000", {"TZID": "America/New_York"})]
    (master,) = events(build_calendar(utc_series, now=NOW))
    assert wire(master, "DTSTART") == [(b"20261008T090000Z", {})]
    assert wire(master, "EXDATE") == [(b"20261010T090000Z", {})]
    (master,) = events(build_calendar(floating, now=NOW))
    assert wire(master, "DTSTART") == [(b"20261004T193000", {})]


def test_a_cancelled_occurrence_is_written_as_an_exdate() -> None:
    series = NEW_SERIES[0]
    cancelled = replace(
        series,
        overrides=(
            *series.overrides,
            SyncedOverride(
                "2026-10-08T17:00:00",
                replace(series.overrides[0].event, cancelled=True),
            ),
        ),
    )
    again = reread(build_calendar(cancelled, now=NOW))
    assert "2026-10-08T17:00:00" in again.exdates
    assert again.overrides == series.overrides


def test_writing_needs_a_master_and_an_aware_now() -> None:
    with pytest.raises(ValueError, match="main event"):
        build_calendar(SyncedSeries(uid="sample-partial", master=None), now=NOW)
    with pytest.raises(ValueError, match="aware"):
        build_calendar(NEW_SERIES[1], now=NOW.replace(tzinfo=None))
