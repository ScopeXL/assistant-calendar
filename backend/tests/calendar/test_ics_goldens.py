"""The ICS fixtures and their goldens (PLAN §14.6, M1): every occurrence in 2026 as a New York
household sees it, from our engine (through the test-only importer) and from
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

from sunroom.domain.recurrence import Occurrence, Window, expand
from sunroom.domain.timeparts import from_local, to_local
from tests.calendar import ical_import

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


def ours(name: str) -> list[Row]:
    rows: list[Row] = []
    for item in ical_import.load(FIXTURES / f"{name}.ics", HOUSEHOLD):
        rows.extend(row_of(found) for found in expand(item.series, item.overrides, WINDOW))
    return in_order(rows)


def oracle(name: str) -> list[Row]:
    calendar = Calendar.from_ical((FIXTURES / f"{name}.ics").read_bytes())
    zones: dict[str, ZoneInfo] = {}
    repeating: set[str] = set()
    for event in calendar.events:
        if event.RECURRENCE_ID is None:
            zones[event.uid] = ical_import.zone_of(event.start, HOUSEHOLD)
            if event.rrules or event.rdates:
                repeating.add(event.uid)
    rows: list[Row] = []
    for event in recurring_ical_events.of(calendar).between(START, END):
        assert isinstance(event, Event)
        if str(event.get("STATUS", "")).upper() == "CANCELLED":
            continue
        rid = None
        if event.uid in repeating:  # the oracle gives every occurrence a RECURRENCE-ID
            assert event.RECURRENCE_ID is not None
            rid = ical_import.rid(event.RECURRENCE_ID, zones[event.uid])
        all_day = not isinstance(event.start, datetime)
        start, end = moment(event.start), moment(event.end)
        rows.append(Row(rid=rid, all_day=all_day, start=start, end=end))
    return in_order(rows)


def golden(name: str) -> list[Row]:
    return cast(list[Row], json.loads((FIXTURES / f"{name}.golden.json").read_text()))


def write_golden(name: str, rows: list[Row]) -> None:
    lines = ",\n".join(f"  {json.dumps(row)}" for row in rows)
    (FIXTURES / f"{name}.golden.json").write_text(f"[\n{lines}\n]\n")


def test_there_are_twelve_fixtures() -> None:
    assert len(NAMES) == 12


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
