"""The ICS fixtures and their goldens (PLAN §14.6, M1): every occurrence in 2026 as a New York
household sees it, from our engine (read by the sync plugin's ``parse_calendar``) and from
recurring-ical-events, the oracle.

Rebuild the goldens from the oracle with

    REGENERATE_GOLDENS=1 uv run pytest tests/calendar/test_ics_goldens.py

and read the diff before committing: a golden is a claim about what the wall should show. The
oracle adds a series' length with wall-clock arithmetic and we add it as an absolute delta, so
no fixture has an occurrence that spans a daylight-saving change or starts in its gap.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, date, datetime
from pathlib import Path
from typing import TypedDict, cast
from zoneinfo import ZoneInfo

import pytest
import recurring_ical_events
from icalendar import Calendar, Event

from sunroom.calendar.synced import SyncedSeries
from sunroom.domain.recurrence import Occurrence, Override, Series, Window, expand
from sunroom.domain.timeparts import from_local, rid_date, rid_timed, to_local
from sunroom.plugins.calendar_sync.ical import parse_calendar

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures" / "ics"
HOUSEHOLD = ZoneInfo("America/New_York")
START = datetime(2026, 1, 1, tzinfo=HOUSEHOLD)
END = datetime(2027, 1, 1, tzinfo=HOUSEHOLD)
WINDOW = Window(START.astimezone(UTC), END.astimezone(UTC), START.date(), END.date())
NAMES = sorted(path.stem for path in FIXTURES.glob("*.ics"))
REGENERATE = os.environ.get("REGENERATE_GOLDENS") == "1"


class Row(TypedDict):
    rid: str | None
    all_day: bool
    start: str  # a date for all-day occurrences, else a UTC instant
    end: str


def moment(value: date | datetime) -> str:
    if not isinstance(value, datetime):
        return value.isoformat()
    instant = from_local(value, HOUSEHOLD) if value.tzinfo is None else value.astimezone(UTC)
    return instant.strftime("%Y-%m-%dT%H:%M:%SZ")


def in_order(rows: list[Row]) -> list[Row]:
    return sorted(rows, key=lambda row: (row["start"], row["rid"] or "", row["end"]))


def row_of(occurrence: Occurrence) -> Row:
    timing = occurrence.timing
    if timing.all_day:
        assert timing.start_date is not None and timing.end_date is not None
        start, end = moment(timing.start_date), moment(timing.end_date)
    else:
        assert timing.start_utc is not None and timing.end_utc is not None
        start, end = moment(timing.start_utc), moment(timing.end_utc)
    return Row(rid=occurrence.recurrence_id, all_day=timing.all_day, start=start, end=end)


def read(name: str) -> list[SyncedSeries]:
    parsed = parse_calendar((FIXTURES / f"{name}.ics").read_bytes(), HOUSEHOLD)
    assert parsed.refused == []
    return parsed.series


def engine_series(item: SyncedSeries) -> tuple[Series, list[Override]]:
    """A synced series as the recurrence engine's types, as the calendar stores it."""
    master = item.master
    assert master is not None
    series = Series(
        timing=master.timing,
        tzid=master.tzid or "UTC",
        rrule=item.rrule,
        rdates=item.rdates,
        exdates=frozenset(item.exdates),
    )
    overrides = [
        Override(o.recurrence_id, None if o.event.cancelled else o.event.timing)
        for o in item.overrides
    ]
    return series, overrides


def ours(name: str) -> list[Row]:
    rows: list[Row] = []
    for item in read(name):
        series, overrides = engine_series(item)
        rows.extend(row_of(found) for found in expand(series, overrides, WINDOW))
    return in_order(rows)


def oracle_rid(value: date | datetime, zone: ZoneInfo | None) -> str:
    """The oracle's RECURRENCE-ID as a recurrence id in the series' zone (None: all-day)."""
    if not isinstance(value, datetime):
        return rid_date(value)
    if zone is None:
        return rid_date(value.date())
    if value.tzinfo is None:
        return rid_timed(value)
    return rid_timed(to_local(value.astimezone(UTC), zone))


def oracle(name: str) -> list[Row]:
    calendar = Calendar.from_ical((FIXTURES / f"{name}.ics").read_bytes())
    # Recurrence ids are labels in each series' zone, which the oracle can't name for a TZID
    # such as "Eastern Standard Time"; the times it gives are its own.
    zones: dict[str, ZoneInfo | None] = {}
    for item in read(name):
        assert item.master is not None
        zones[item.uid] = ZoneInfo(item.master.tzid) if item.master.tzid else None
    repeating: set[str] = set()
    for event in calendar.events:
        if event.RECURRENCE_ID is None and (event.rrules or event.rdates):
            repeating.add(event.uid)
    rows: list[Row] = []
    for event in recurring_ical_events.of(calendar).between(START, END):
        assert isinstance(event, Event)
        if str(event.get("STATUS", "")).upper() == "CANCELLED":
            continue
        rid = None
        if event.uid in repeating:  # the oracle gives every occurrence a RECURRENCE-ID
            assert event.RECURRENCE_ID is not None
            rid = oracle_rid(event.RECURRENCE_ID, zones[event.uid])
        all_day = not isinstance(event.start, datetime)
        start, end = moment(event.start), moment(event.end)
        rows.append(Row(rid=rid, all_day=all_day, start=start, end=end))
    return in_order(rows)


def golden(name: str) -> list[Row]:
    return cast(list[Row], json.loads((FIXTURES / f"{name}.golden.json").read_text()))


def write_golden(name: str, rows: list[Row]) -> None:
    lines = ",\n".join(f"  {json.dumps(row)}" for row in rows)
    (FIXTURES / f"{name}.golden.json").write_text(f"[\n{lines}\n]\n")


def test_there_are_fourteen_fixtures() -> None:
    assert len(NAMES) == 14


@pytest.mark.parametrize("name", NAMES)
def test_the_golden_is_what_the_oracle_says(name: str) -> None:
    found = oracle(name)
    if REGENERATE:
        write_golden(name, found)
    assert golden(name) == found


@pytest.mark.parametrize("name", NAMES)
def test_expand_matches_the_golden(name: str) -> None:
    assert ours(name) == golden(name)


# What a paper calendar says, worked out by hand: how many occurrences each fixture has in 2026.
COUNTS = {
    "01-weekly-with-exdates": 52 + 53 - 4,  # Tuesdays and Thursdays, four taken out
    "02-moved-occurrences": 52,  # Wednesdays; Dec 30 moves out, Jan 6 2027 moves in
    "03-cancelled-occurrence": 26 - 2,  # Saturdays to Jun 27, two cancelled
    "04-count": 10 + 5,  # ten lessons; the reading club's last five of eight
    "05-until": 24 + 6,  # Tue/Thu Sep 1 to Nov 19; the 15th, January to June
    "06-by-weekday": 12 + 12 + 1,
    "07-daily-across-dst": 31 + 30 + 31 + 30 + 31 + 31 + 30 + 31 + 7,  # Mar 1 to Nov 7
    "08-london": 52 + 1,
    "09-all-day-spans": 1 + 1 + 6 + 1,
    "10-weekly-all-day": 26 + 20 - 1,
    "11-floating": 52 - 1 + 1,
    "12-rdates": 26 - 1 + 2 + 4,
    "13-outlook-windows-tzid": 9 - 1,  # Tuesdays Oct 6 to Dec 1, Thanksgiving week out
    "14-google-x-wr-timezone": 7 - 1 + 1,  # Wednesdays Oct 7 to Nov 18, one out; half term
}


def wall_times(rows: list[Row]) -> set[str]:
    """The New York time of day each timed occurrence starts at."""
    times: set[str] = set()
    for row in rows:
        instant = datetime.fromisoformat(row["start"])
        times.add(to_local(instant, HOUSEHOLD).strftime("%H:%M"))
    return times


def test_the_goldens_agree_with_a_paper_calendar() -> None:
    assert {name: len(golden(name)) for name in NAMES} == COUNTS

    practice = golden("01-weekly-with-exdates")
    assert wall_times(practice) == {"16:30"}
    taken_out = {"2026-02-17", "2026-02-19", "2026-07-07", "2026-11-26"}
    assert not taken_out & {row["start"][:10] for row in practice}

    piano = {row["rid"]: row for row in golden("02-moved-occurrences")}
    assert "2026-12-30T15:00:00" not in piano
    assert piano["2027-01-06T15:00:00"]["start"] == "2026-12-31T15:00:00Z"
    assert piano["2026-09-09T15:00:00"]["start"] == "2026-09-10T19:00:00Z"

    assert golden("05-until")[-1] == {
        "rid": "2026-11-19T17:00:00",  # UNTIL is that very instant, and includes it
        "all_day": False,
        "start": "2026-11-19T22:00:00Z",
        "end": "2026-11-19T23:30:00Z",
    }

    drop_off = {row["rid"]: row["start"] for row in golden("07-daily-across-dst")}
    assert wall_times(golden("07-daily-across-dst")) == {"08:15"}
    assert drop_off["2026-03-07T08:15:00"] == "2026-03-07T13:15:00Z"
    assert drop_off["2026-03-08T08:15:00"] == "2026-03-08T12:15:00Z"
    assert drop_off["2026-11-01T08:15:00"] == "2026-11-01T13:15:00Z"

    choir = {row["rid"]: row["start"] for row in golden("08-london")}
    assert choir["2026-03-25T19:00:00"] == "2026-03-25T19:00:00Z"
    assert choir["2026-04-01T19:00:00"] == "2026-04-01T18:00:00Z"

    spans = golden("09-all-day-spans")
    assert spans[0] == {"rid": None, "all_day": True, "start": "2025-12-22", "end": "2026-01-05"}
    assert {"rid": None, "all_day": True, "start": "2026-03-06", "end": "2026-03-09"} in spans

    assert wall_times(golden("11-floating")) == {"19:30", "09:00"}

    # Outlook names New York "Eastern Standard Time": 3:45 stays 3:45 after Nov 1.
    band = {row["rid"]: row["start"] for row in golden("13-outlook-windows-tzid")}
    assert wall_times(golden("13-outlook-windows-tzid")) == {"15:45", "16:00"}
    assert band["2026-10-20T15:45:00"] == "2026-10-20T19:45:00Z"
    assert band["2026-11-03T15:45:00"] == "2026-11-03T20:45:00Z"
    assert "2026-11-24T15:45:00" not in band

    # Google writes UTC times and the calendar's zone: 6 PM in London on both sides of Oct 25.
    call = {row["rid"]: row["start"] for row in golden("14-google-x-wr-timezone")}
    assert call["2026-10-14T18:00:00"] == "2026-10-14T17:00:00Z"
    assert call["2026-10-28T18:00:00"] == "2026-10-28T18:00:00Z"
    assert call["2026-10-21T18:00:00"] == "2026-10-21T18:00:00Z"  # moved an hour later
    assert "2026-11-04T18:00:00" not in call
