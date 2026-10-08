"""Reading calendars into synced series (PLAN §7.2, §7.5, §8.3): times and zones, rules and
their dates, changed occurrences, duplicates, text, and everything Sunroom refuses out loud.

A New York household unless a test says otherwise. 2026: New York falls back on Nov 1, London
on Oct 25. Synthetic data only."""

from __future__ import annotations

from datetime import UTC, date, datetime
from textwrap import dedent
from zoneinfo import ZoneInfo

import pytest

from sunroom.calendar.synced import SyncedEvent, SyncedSeries
from sunroom.domain.recurrence import Timing
from sunroom.plugins.calendar_sync import ical
from sunroom.plugins.calendar_sync.ical import ParsedCalendar, Refusal, parse_calendar

NY = ZoneInfo("America/New_York")
HEAD = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Sunroom//Tests//EN\n"


def vevent(text: str) -> str:
    return f"BEGIN:VEVENT\n{dedent(text).strip()}\nEND:VEVENT\n"


def calendar(*events: str, head: str = "") -> str:
    return (
        HEAD + dedent(head).strip() + "\n" + "".join(vevent(e) for e in events) + "END:VCALENDAR\n"
    )


def read(*events: str, head: str = "", household: ZoneInfo = NY) -> ParsedCalendar:
    return parse_calendar(calendar(*events, head=head), household)


def only(parsed: ParsedCalendar) -> SyncedSeries:
    assert parsed.refused == []
    assert len(parsed.series) == 1
    return parsed.series[0]


def master(parsed: ParsedCalendar) -> SyncedEvent:
    event = only(parsed).master
    assert event is not None
    return event


def utc(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


def timed(start: str, end: str) -> Timing:
    return Timing(all_day=False, start_utc=utc(start), end_utc=utc(end))


def days(first: str, last: str) -> Timing:
    return Timing(
        all_day=True, start_date=date.fromisoformat(first), end_date=date.fromisoformat(last)
    )


# --- Times and zones -----------------------------------------------------------------------------


def test_a_timed_event_is_utc_instants_in_its_zone() -> None:
    event = master(
        read("""
            UID:sample-1
            SUMMARY:Sample dentist
            DTSTART;TZID=America/Chicago:20261008T143000
            DTEND;TZID=America/Chicago:20261008T151500
        """)
    )
    assert event.timing == timed("2026-10-08T19:30:00", "2026-10-08T20:15:00")
    assert (event.tzid, event.floating, event.title) == ("America/Chicago", False, "Sample dentist")


def test_a_time_in_utc_runs_in_utc() -> None:
    event = master(read("UID:sample-1\nDTSTART:20261008T143000Z\nDTEND:20261008T150000Z"))
    assert event.timing == timed("2026-10-08T14:30:00", "2026-10-08T15:00:00")
    assert event.tzid == "UTC"


def test_a_floating_time_is_the_households() -> None:
    event = master(read("UID:sample-1\nDTSTART:20261008T193000\nDTEND:20261008T200000"))
    assert event.timing == timed("2026-10-08T23:30:00", "2026-10-09T00:00:00")
    assert (event.tzid, event.floating) == ("America/New_York", True)
    london = master(
        read(
            "UID:sample-1\nDTSTART:20261008T193000\nDTEND:20261008T200000",
            household=ZoneInfo("Europe/London"),
        )
    )
    assert london.timing == timed("2026-10-08T18:30:00", "2026-10-08T19:00:00")


def test_an_end_in_another_zone_is_its_own_instant() -> None:
    event = master(
        read("""
            UID:sample-1
            DTSTART;TZID=America/New_York:20261008T090000
            DTEND;TZID=Europe/London:20261008T150000
        """)
    )
    assert event.timing == timed("2026-10-08T13:00:00", "2026-10-08T14:00:00")


@pytest.mark.parametrize(
    ("lines", "expected"),
    [
        (
            "DTSTART;VALUE=DATE:20261008\nDTEND;VALUE=DATE:20261011",
            days("2026-10-08", "2026-10-11"),
        ),
        ("DTSTART;VALUE=DATE:20261008", days("2026-10-08", "2026-10-09")),  # one day
        ("DTSTART;VALUE=DATE:20261008\nDURATION:P3D", days("2026-10-08", "2026-10-11")),
        ("DTSTART;VALUE=DATE:20261008\nDURATION:P1W", days("2026-10-08", "2026-10-15")),
        (
            "DTSTART;VALUE=DATE:20261008\nDTEND;VALUE=DATE:20261008",
            days("2026-10-08", "2026-10-09"),
        ),
    ],
)
def test_all_day_events_end_the_day_after(lines: str, expected: Timing) -> None:
    event = master(read(f"UID:sample-1\n{lines}"))
    assert (event.timing, event.tzid) == (expected, None)


@pytest.mark.parametrize(
    ("lines", "end"),
    [
        ("", "2026-10-08T13:00:00"),  # no end: no length (RFC 5545)
        ("DURATION:PT45M", "2026-10-08T13:45:00"),
        ("DURATION:P1DT1H", "2026-10-09T14:00:00"),
        ("DTEND;TZID=America/New_York:20261008T080000", "2026-10-08T13:00:00"),  # before: none
    ],
)
def test_a_timed_event_without_an_end(lines: str, end: str) -> None:
    event = master(read(f"UID:sample-1\nDTSTART;TZID=America/New_York:20261008T090000\n{lines}"))
    assert event.timing == timed("2026-10-08T13:00:00", end)


def test_a_day_of_duration_is_a_calendar_day_across_daylight_saving() -> None:
    event = master(
        read("UID:sample-1\nDTSTART;TZID=America/New_York:20261031T090000\nDURATION:P1D")
    )
    # 9:00 on Oct 31 to 9:00 on Nov 1, which is 25 hours.
    assert event.timing == timed("2026-10-31T13:00:00", "2026-11-01T14:00:00")


@pytest.mark.filterwarnings("ignore::icalendar.error.GloballyUniqueTZIDGuessed")
def test_windows_and_vendor_tzids_read_as_iana() -> None:
    windows = master(
        read("UID:sample-1\nDTSTART;TZID=Eastern Standard Time:20261103T154500\nDURATION:PT1H")
    )
    assert windows.tzid == "America/New_York"
    assert windows.timing.start_utc == utc("2026-11-03T20:45:00")
    mozilla = master(
        read("UID:sample-1\nDTSTART;TZID=/mozilla.org/20050126_1/Europe/London:20261008T090000")
    )
    assert mozilla.tzid == "Europe/London"


def test_an_unknown_tzid_without_a_vtimezone_is_read_in_the_households_zone() -> None:
    event = master(read("UID:sample-1\nDTSTART;TZID=Sample/Nowhere:20261008T090000"))
    assert event.tzid == "America/New_York"
    assert event.timing.start_utc == utc("2026-10-08T13:00:00")


def test_google_feeds_move_utc_times_into_the_calendars_zone() -> None:
    """X-WR-TIMEZONE: a weekly 6 PM in London stays 6 PM after the clocks go back."""
    series = only(
        read(
            """
            UID:sample-1
            DTSTART:20261021T170000Z
            DTEND:20261021T180000Z
            RRULE:FREQ=WEEKLY;COUNT=3
            EXDATE:20261104T180000Z
            """,
            head="X-WR-TIMEZONE:Europe/London",
        )
    )
    assert series.master is not None
    assert series.master.tzid == "Europe/London"
    assert series.master.timing.start_utc == utc("2026-10-21T17:00:00")
    assert series.exdates == ("2026-11-04T18:00:00",)


# --- Rules and their dates -----------------------------------------------------------------------


def test_the_rule_is_normalized_and_dates_are_recurrence_ids_in_the_series_zone() -> None:
    series = only(
        read("""
            UID:sample-1
            DTSTART;TZID=America/New_York:20260901T163000
            DTEND;TZID=America/New_York:20260901T180000
            RRULE:freq=weekly;byday=TU,TH;until=20261119T230000Z
            EXDATE;TZID=America/New_York:20260915T163000,20260917T163000
            EXDATE:20261006T203000Z
            EXDATE;TZID=Europe/London:20261008T213000
            EXDATE;VALUE=DATE:20261126
            RDATE;TZID=America/New_York:20261210T163000
            RDATE;VALUE=PERIOD:20261212T150000Z/PT1H
        """)
    )
    assert series.rrule == "FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261119T230000Z"
    assert series.exdates == (
        "2026-09-15T16:30:00",
        "2026-09-17T16:30:00",
        "2026-10-06T16:30:00",  # written in UTC
        "2026-10-08T16:30:00",  # written in London's time
        "2026-11-26",  # a date on a timed series: that whole day
    )
    assert series.rdates == ("2026-12-10T16:30:00", "2026-12-12T10:00:00")  # a period's start


def test_an_all_day_series_has_date_ids() -> None:
    series = only(
        read("""
            UID:sample-1
            DTSTART;VALUE=DATE:20260103
            DTEND;VALUE=DATE:20260104
            RRULE:FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=20261227
            EXDATE;VALUE=DATE:20260111
            RDATE;VALUE=DATE:20261231
        """)
    )
    assert (series.rrule, series.exdates, series.rdates) == (
        "FREQ=WEEKLY;BYDAY=SA,SU;UNTIL=20261227",
        ("2026-01-11",),
        ("2026-12-31",),
    )


# --- Changed occurrences -------------------------------------------------------------------------

PIANO = """
    UID:sample-piano
    SUMMARY:Sample piano lesson
    DTSTART;TZID=America/New_York:20261007T150000
    DTEND;TZID=America/New_York:20261007T154500
    RRULE:FREQ=WEEKLY
"""


def test_changed_occurrences_are_overrides_by_their_original_start() -> None:
    series = only(
        read(
            PIANO,
            """
            UID:sample-piano
            RECURRENCE-ID;TZID=America/New_York:20261014T150000
            SUMMARY:Sample piano lesson (Thursday)
            DTSTART;TZID=America/New_York:20261015T161500
            DTEND;TZID=America/New_York:20261015T170000
            """,
            """
            UID:sample-piano
            RECURRENCE-ID:20261021T190000Z
            STATUS:CANCELLED
            DTSTART;TZID=America/New_York:20261021T150000
            DTEND;TZID=America/New_York:20261021T154500
            """,
            """
            UID:sample-piano
            RECURRENCE-ID;RANGE=THISANDFUTURE;TZID=America/New_York:20261028T150000
            SUMMARY:Sample piano lesson (new room)
            DTSTART;TZID=America/New_York:20261028T150000
            DTEND;TZID=America/New_York:20261028T154500
            """,
            """
            UID:sample-piano
            RECURRENCE-ID;VALUE=DATE:20261104
            SUMMARY:Sample piano lesson (no start of its own)
            """,
        )
    )
    moved, cancelled, future, bare = series.overrides
    assert moved.recurrence_id == "2026-10-14T15:00:00"
    assert moved.event.title == "Sample piano lesson (Thursday)"
    assert moved.event.timing == timed("2026-10-15T20:15:00", "2026-10-15T21:00:00")
    assert (cancelled.recurrence_id, cancelled.event.cancelled) == ("2026-10-21T15:00:00", True)
    # RANGE=THISANDFUTURE is read as a change to that one occurrence.
    assert (future.recurrence_id, future.event.title) == (
        "2026-10-28T15:00:00",
        "Sample piano lesson (new room)",
    )
    # A date RECURRENCE-ID on a timed series means the series' time that day; without a
    # DTSTART of its own, the occurrence keeps its original start and the master's length.
    assert bare.recurrence_id == "2026-11-04T15:00:00"
    assert bare.event.timing == timed("2026-11-04T20:00:00", "2026-11-04T20:45:00")


def test_an_orphan_occurrence_is_its_own_event() -> None:
    """An invitation to one occurrence of someone else's series: no master in the calendar."""
    parsed = read("""
        UID:sample-invite
        RECURRENCE-ID;TZID=America/New_York:20261015T100000
        SUMMARY:Sample school meeting
        DTSTART;TZID=America/New_York:20261015T110000
        DTEND;TZID=America/New_York:20261015T120000
    """)
    series = only(parsed)
    assert (series.rrule, series.rdates, series.overrides) == (None, (), ())
    assert series.master == SyncedEvent(
        title="Sample school meeting",
        timing=timed("2026-10-15T15:00:00", "2026-10-15T16:00:00"),
        tzid="America/New_York",
    )


def test_several_orphan_occurrences_are_one_series_with_extra_dates() -> None:
    series = only(
        read(
            """
            UID:sample-invite
            RECURRENCE-ID;TZID=America/New_York:20261022T100000
            SUMMARY:Sample school meeting (second)
            DTSTART;TZID=America/New_York:20261022T100000
            DTEND;TZID=America/New_York:20261022T110000
            """,
            """
            UID:sample-invite
            RECURRENCE-ID;TZID=America/New_York:20261015T100000
            SUMMARY:Sample school meeting
            DTSTART;TZID=America/New_York:20261015T100000
            DTEND;TZID=America/New_York:20261015T110000
            """,
            """
            UID:sample-invite
            RECURRENCE-ID;TZID=America/New_York:20261029T100000
            STATUS:CANCELLED
            DTSTART;TZID=America/New_York:20261029T100000
            DTEND;TZID=America/New_York:20261029T110000
            """,
        )
    )
    assert series.master is not None
    assert series.master.title == "Sample school meeting"  # the earliest
    assert series.rdates == ("2026-10-22T10:00:00",)
    assert [o.recurrence_id for o in series.overrides] == ["2026-10-22T10:00:00"]
    assert series.overrides[0].event.title == "Sample school meeting (second)"


def test_a_cancelled_master_is_left_out_and_a_tentative_one_shown() -> None:
    gone = read("UID:sample-1\nSTATUS:CANCELLED\nDTSTART;VALUE=DATE:20261008")
    assert (gone.series, gone.refused) == ([], [])
    tentative = master(read("UID:sample-1\nSTATUS:TENTATIVE\nDTSTART;VALUE=DATE:20261008"))
    assert tentative.cancelled is False


@pytest.mark.parametrize(
    ("first", "second", "winner"),
    [
        ("SEQUENCE:2", "SEQUENCE:1", "first"),
        ("SEQUENCE:1\nLAST-MODIFIED:20261001T000000Z", "SEQUENCE:1", "first"),
        ("LAST-MODIFIED:20261001T000000Z", "LAST-MODIFIED:20261002T000000Z", "second"),
        ("SEQUENCE:0", "SEQUENCE:0", "second"),  # a tie: the last one
    ],
)
def test_of_two_copies_of_an_event_the_newer_wins(first: str, second: str, winner: str) -> None:
    parsed = read(
        f"UID:sample-1\nSUMMARY:first\nDTSTART;VALUE=DATE:20261008\n{first}",
        f"UID:sample-1\nSUMMARY:second\nDTSTART;VALUE=DATE:20261009\n{second}",
    )
    assert master(parsed).title == winner


# --- Text and other fields -----------------------------------------------------------------------


def test_text_is_trimmed_to_what_the_calendar_holds() -> None:
    event = master(
        read(
            f"""
            UID:sample-1
            DTSTART;VALUE=DATE:20261008
            SUMMARY:  Sample  {"x" * 300}
            LOCATION:{"y" * 400}
            DESCRIPTION:{"z" * 6000}
            """
        )
    )
    assert event.title == "Sample " + "x" * 193
    assert (len(event.title), len(event.location), len(event.description)) == (200, 300, 5000)
    untitled = master(read("UID:sample-1\nDTSTART;VALUE=DATE:20261008"))
    assert (untitled.title, untitled.location, untitled.description) == ("No title", "", "")


def test_escaped_text_is_read_as_written() -> None:
    event = master(
        read(r"""
            UID:sample-1
            DTSTART;VALUE=DATE:20261008
            SUMMARY:Sample pizza\, games\; and cake
            LOCATION:Sample pool\n1 Sample Street
            DESCRIPTION:Bring:\n- towel\n- goggles
        """)
    )
    assert event.title == "Sample pizza, games; and cake"
    assert event.location == "Sample pool\n1 Sample Street"
    assert event.description == "Bring:\n- towel\n- goggles"


def test_sequence_and_the_latest_change_come_along() -> None:
    series = only(
        read(
            dedent(PIANO) + "SEQUENCE:4\nLAST-MODIFIED:20261001T120000Z",
            """
            UID:sample-piano
            RECURRENCE-ID;TZID=America/New_York:20261014T150000
            DTSTART;TZID=America/New_York:20261014T160000
            LAST-MODIFIED:20261005T080000Z
            """,
        )
    )
    assert series.sequence == 4
    assert series.updated_at == utc("2026-10-05T08:00:00")


def test_a_caldav_resource_carries_its_href_etag_and_text() -> None:
    text = calendar(PIANO)
    parsed = parse_calendar(
        text.encode(), NY, remote_id="/calendars/sample/piano.ics", etag='"7"', keep_raw=True
    )
    series = only(parsed)
    assert (series.remote_id, series.etag, series.raw_ical) == (
        "/calendars/sample/piano.ics",
        '"7"',
        text,
    )
    assert only(parse_calendar(text, NY)).raw_ical is None


def test_the_calendars_name_and_color() -> None:
    parsed = read(PIANO, head="X-WR-CALNAME:Sample family\nX-APPLE-CALENDAR-COLOR:#1BADF8FF")
    assert (parsed.name, parsed.color) == ("Sample family", "#1BADF8")
    named = read(PIANO, head="NAME:Sample school\nCOLOR:dodgerblue")
    assert (named.name, named.color) == ("Sample school", None)  # names aren't read; hex is
    assert read(PIANO, head="COLOR:#abc").color == "#AABBCC"
    assert read(PIANO, head="X-APPLE-CALENDAR-COLOR:sample").color is None
    assert (read(PIANO).name, read(PIANO).color) == (None, None)


def test_an_event_without_a_uid_gets_one_that_stays_the_same() -> None:
    event = "SUMMARY:Sample bake sale\nDTSTART;VALUE=DATE:20261008"
    first = only(read(event))
    assert first.uid.startswith("sunroom-no-uid-")
    assert only(read(event)).uid == first.uid
    assert only(read(event.replace("08", "09"))).uid != first.uid


def test_bytes_in_other_encodings_are_read() -> None:
    text = calendar("UID:sample-1\nSUMMARY:Sample café\nDTSTART;VALUE=DATE:20261008")
    for data in (text.encode("utf-8-sig"), text.encode("cp1252"), text.replace("\n", "\r\n")):
        assert master(parse_calendar(data, NY)).title == "Sample café"


# --- What Sunroom refuses, out loud --------------------------------------------------------------


def refusal(parsed: ParsedCalendar) -> Refusal:
    assert len(parsed.refused) == 1
    return parsed.refused[0]


@pytest.mark.parametrize(
    ("lines", "reason"),
    [
        ("RRULE:FREQ=HOURLY", "repeats every hour, which Sunroom can't show"),
        ("RRULE:FREQ=MINUTELY;INTERVAL=15", "repeats every minute, which Sunroom can't show"),
        (
            "RRULE:FREQ=WEEKLY\nRRULE:FREQ=MONTHLY",
            "repeats in two different ways at once, which Sunroom can't show",
        ),
        (
            "RRULE:FREQ=DAILY\nEXRULE:FREQ=WEEKLY;BYDAY=SA,SU",
            "skips some of its repeats by a rule, which Sunroom can't show",
        ),
        ("RRULE:FREQ=YEARLY;BYWEEKNO=20", "repeats in a way Sunroom can't show"),
        (
            "RRULE:FREQ=DAILY;COUNT=2000",
            "has a repeat Sunroom can't follow (a repeat can happen 1 to 1,000 times)",
        ),
        (
            "RRULE:FREQ=FORTNIGHTLY",
            "has a repeat Sunroom can't follow (a repeat happens daily, weekly, monthly or yearly)",
        ),
    ],
)
def test_rules_sunroom_cant_show_are_refused(lines: str, reason: str) -> None:
    parsed = read(
        "UID:sample-1\nSUMMARY:Sample standup\n"
        f"DTSTART;TZID=America/New_York:20261008T090000\n{lines}",
        "UID:sample-2\nSUMMARY:Sample lunch\nDTSTART;VALUE=DATE:20261008",
    )
    assert refusal(parsed) == Refusal("sample-1", "Sample standup", reason)
    assert [s.uid for s in parsed.series] == ["sample-2"]  # the rest of the calendar is fine


def test_an_event_without_a_start_or_with_an_unreadable_time_is_refused() -> None:
    parsed = read(
        "UID:sample-1\nSUMMARY:Sample mystery",
        "UID:sample-2\nSUMMARY:Sample typo\nDTSTART:2026-10-08 09:00",
        "UID:sample-3\nSUMMARY:Sample bad end\nDTSTART;VALUE=DATE:20261008\nDTEND:soon",
        "UID:sample-4\nSUMMARY:Sample lunch\nDTSTART;VALUE=DATE:20261008",
    )
    assert parsed.refused == [
        Refusal("sample-1", "Sample mystery", "has no start time, so Sunroom can't place it"),
        Refusal("sample-2", "Sample typo", "has a date or time Sunroom can't read"),
        Refusal("sample-3", "Sample bad end", "has a date or time Sunroom can't read"),
    ]
    assert [s.uid for s in parsed.series] == ["sample-4"]


def test_a_changed_occurrence_that_cant_be_read_refuses_its_series() -> None:
    parsed = read(PIANO, "UID:sample-piano\nRECURRENCE-ID:someday\nDTSTART:20261015T160000Z")
    assert refusal(parsed) == Refusal(
        "sample-piano", "Sample piano lesson", "has a date or time Sunroom can't read"
    )


def test_an_orphan_occurrence_is_not_refused() -> None:
    parsed = read(
        "UID:sample-1\nRECURRENCE-ID;VALUE=DATE:20261015\nDTSTART;VALUE=DATE:20261016\n"
        "SUMMARY:Sample trip (moved)"
    )
    assert master(parsed).timing == days("2026-10-16", "2026-10-17")


def test_past_the_cap_one_refusal_says_how_many(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ical, "MAX_SERIES", 3)
    events = [f"UID:sample-{n}\nDTSTART;VALUE=DATE:2026100{n}" for n in range(1, 6)]
    parsed = read(*events)
    assert [s.uid for s in parsed.series] == ["sample-1", "sample-2", "sample-3"]
    assert parsed.refused == [
        Refusal(
            "", "2 more events", "go past the 3 one calendar can hold, so Sunroom leaves them out"
        )
    ]


# --- Broken files -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "",
        "<!doctype html><html><body>Sign in</body></html>",
        '{"error": "not found"}',
        "BEGIN:VEVENT\nUID:sample-1\nDTSTART;VALUE=DATE:20261008\nEND:VEVENT\n",
    ],
)
def test_what_isnt_a_calendar_raises_a_plain_message(text: str) -> None:
    with pytest.raises(ValueError, match="isn't a calendar file"):
        parse_calendar(text, NY)


def test_a_calendar_cut_short_is_never_read_as_complete() -> None:
    whole = calendar(PIANO, "UID:sample-2\nDTSTART;VALUE=DATE:20261008")
    with pytest.raises(ValueError, match="cut short"):
        parse_calendar(whole[: whole.index("BEGIN:VEVENT", 100)], NY)


def test_one_broken_piece_doesnt_sink_the_calendar() -> None:
    """icalendar gives up on the whole file for a bad alarm, a bad time zone, a stray line or
    END; Sunroom reads the rest piece by piece."""
    broken_alarm = vevent(
        dedent(PIANO) + "BEGIN:VALARM\nTRIGGER:whenever\nACTION:DISPLAY\nEND:VALARM"
    ).replace("UID:sample-piano", "UID:sample-alarm")
    text = (
        HEAD
        + "REFRESH-INTERVAL;VALUE=DURATION:soon\n"
        + "BEGIN:VTIMEZONE\nTZID:Sample Empty\nEND:VTIMEZONE\n"
        + "A LINE THAT ISN'T ICALENDAR\n"
        + broken_alarm
        + "END:VTODO\n"
        + vevent("UID:sample-2\nDTSTART;TZID=Sample Empty:20261008T090000")
        + "END:VCALENDAR\n"
    )
    parsed = parse_calendar(text, NY)
    assert parsed.refused == []
    assert [s.uid for s in parsed.series] == ["sample-alarm", "sample-2"]
    second = parsed.series[1].master
    assert second is not None and second.tzid == "America/New_York"
