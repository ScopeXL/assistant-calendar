"""Time zone names as calendars write them (PLAN §8.3): IANA names, vendor prefixes, Windows and
Outlook display names are exact; anything else is matched by its VTIMEZONE's offsets or falls
back to the household's zone, and says it guessed."""

from __future__ import annotations

from textwrap import dedent
from zoneinfo import ZoneInfo

import pytest
from icalendar import Calendar, Timezone
from icalendar.prop import vText

from sunroom.plugins.calendar_sync.tzmap import DISPLAY, WINDOWS, named_zone, zone_for

NY = ZoneInfo("America/New_York")
CHICAGO = ZoneInfo("America/Chicago")
PARIS = ZoneInfo("Europe/Paris")
LONDON = ZoneInfo("Europe/London")


def vtimezone(text: str) -> Timezone:
    body = dedent(text).strip()
    calendar = Calendar.from_ical(f"BEGIN:VCALENDAR\n{body}\nEND:VCALENDAR\n".encode())
    found = calendar.subcomponents[0]
    assert isinstance(found, Timezone)
    return found


# Outlook's own definition of US Eastern: rules from 1601, current US dates.
OUTLOOK_EASTERN = """
BEGIN:VTIMEZONE
TZID:Sample Eastern
BEGIN:STANDARD
DTSTART:16010101T020000
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=1SU;BYMONTH=11
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:16010101T020000
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
RRULE:FREQ=YEARLY;INTERVAL=1;BYDAY=2SU;BYMONTH=3
END:DAYLIGHT
END:VTIMEZONE
"""

CENTRAL_EUROPE = """
BEGIN:VTIMEZONE
TZID:Sample Central Europe
BEGIN:STANDARD
DTSTART:19701025T030000
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700329T020000
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3
END:DAYLIGHT
END:VTIMEZONE
"""


@pytest.mark.parametrize(
    ("windows", "iana"),
    [
        ("Eastern Standard Time", "America/New_York"),
        ("Central Standard Time", "America/Chicago"),
        ("Mountain Standard Time", "America/Denver"),
        ("US Mountain Standard Time", "America/Phoenix"),
        ("Pacific Standard Time", "America/Los_Angeles"),
        ("Hawaiian Standard Time", "Pacific/Honolulu"),
        ("W. Europe Standard Time", "Europe/Berlin"),
        ("Romance Standard Time", "Europe/Paris"),
        ("GMT Standard Time", "Europe/London"),
        ("Greenwich Standard Time", "Atlantic/Reykjavik"),
        ("AUS Eastern Standard Time", "Australia/Sydney"),
        ("Tokyo Standard Time", "Asia/Tokyo"),
        ("India Standard Time", "Asia/Kolkata"),  # CLDR still says Asia/Calcutta
        ("FLE Standard Time", "Europe/Kyiv"),  # CLDR still says Europe/Kiev
        ("Dateline Standard Time", "Etc/GMT+12"),
        ("UTC", "UTC"),
        ("eastern standard time", "America/New_York"),  # case doesn't matter
        ("Eastern Standard Time 1", "America/New_York"),  # Outlook numbers its copies
    ],
)
def test_windows_names_map_to_iana(windows: str, iana: str) -> None:
    assert zone_for(windows, None, LONDON) == (ZoneInfo(iana), False)


def test_the_windows_table_is_cldrs_whole_table() -> None:
    assert 135 <= len(WINDOWS) <= 145
    for name, iana in WINDOWS.items():
        zone = named_zone(iana)
        assert zone is not None and zone.key == iana, name
    assert set(DISPLAY.values()) <= set(WINDOWS)


@pytest.mark.parametrize(
    ("tzid", "iana"),
    [
        ("/mozilla.org/20050126_1/America/New_York", "America/New_York"),
        ("/freeassociation.sourceforge.net/Tzfile/Europe/London", "Europe/London"),
        ("/freeassociation.sourceforge.net/Europe/Paris", "Europe/Paris"),
        ("/softwarestudio.org/Olson_20011030_5/America/Chicago", "America/Chicago"),
        ("/citadel.org/20190914_1/America/Argentina/Cordoba", "America/Argentina/Cordoba"),
    ],
)
def test_vendor_prefixes_are_stripped(tzid: str, iana: str) -> None:
    assert zone_for(tzid, None, LONDON) == (ZoneInfo(iana), False)


@pytest.mark.parametrize(
    ("tzid", "iana"),
    [
        ("America/New_York", "America/New_York"),
        ("america/new_york", "America/New_York"),  # the same on every file system
        (" Europe/London ", "Europe/London"),
        ('"Asia/Tokyo"', "Asia/Tokyo"),
        ("Asia/Calcutta", "Asia/Calcutta"),  # an old name still works as itself
        ("UTC", "UTC"),
        ("Etc/UTC", "UTC"),
        ("GMT", "UTC"),
        ("Z", "UTC"),
    ],
)
def test_iana_names_pass_through(tzid: str, iana: str) -> None:
    assert zone_for(tzid, None, LONDON) == (ZoneInfo(iana), False)


@pytest.mark.parametrize(
    ("display", "iana"),
    [
        ("(UTC-05:00) Eastern Time (US & Canada)", "America/New_York"),
        ("(GMT-05:00) Eastern Time (US & Canada)", "America/New_York"),
        ("(GMT-05.00) Eastern Time (US & Canada)", "America/New_York"),
        ('"(UTC-06:00) Central Time (US & Canada)"', "America/Chicago"),
        ("(UTC-08:00) Pacific Time (US & Canada)", "America/Los_Angeles"),
        ("(UTC+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna", "Europe/Berlin"),
        ("(UTC+00:00) Dublin, Edinburgh, Lisbon, London", "Europe/London"),
        ("(GMT) Greenwich Mean Time : Dublin, Edinburgh, Lisbon, London", "Europe/London"),
        ("(UTC+10:00) Canberra, Melbourne, Sydney", "Australia/Sydney"),
        ("(UTC) Coordinated Universal Time", "UTC"),
        ("Eastern Time (US & Canada)", "America/New_York"),
    ],
)
def test_outlook_display_names_map(display: str, iana: str) -> None:
    assert zone_for(display, None, LONDON) == (ZoneInfo(iana), False)


def test_an_unknown_tzid_is_matched_by_its_vtimezones_offsets() -> None:
    eastern = vtimezone(OUTLOOK_EASTERN)
    assert zone_for("Sample Eastern", eastern, NY, year=2026) == (NY, True)
    # Not the household's offsets: the zone most people mean, never a lookalike such as Havana.
    assert zone_for("Sample Eastern", eastern, CHICAGO, year=2026) == (NY, True)
    assert zone_for("Sample Eastern", eastern, LONDON, year=2026) == (NY, True)
    # Without the event's year it compares a year today's rules cover.
    assert zone_for("Sample Eastern", eastern, LONDON) == (NY, True)

    europe = vtimezone(CENTRAL_EUROPE)
    assert zone_for("Sample Central Europe", europe, PARIS, year=2026) == (PARIS, True)
    assert zone_for("Sample Central Europe", europe, NY, year=2026) == (
        ZoneInfo("Europe/Berlin"),
        True,
    )


def test_a_fixed_offset_vtimezone_matches_a_zone_without_daylight_saving() -> None:
    fixed = vtimezone("""
        BEGIN:VTIMEZONE
        TZID:Sample India
        BEGIN:STANDARD
        DTSTART:19700101T000000
        TZOFFSETFROM:+0530
        TZOFFSETTO:+0530
        END:STANDARD
        END:VTIMEZONE
    """)
    assert zone_for("Sample India", fixed, NY, year=2026) == (ZoneInfo("Asia/Kolkata"), True)


def test_without_a_match_it_falls_back_to_the_household() -> None:
    assert zone_for("Nowhere/Special", None, NY) == (NY, True)
    assert zone_for(None, None, NY) == (NY, True)
    assert zone_for("", None, NY) == (NY, True)
    odd = vtimezone("""
        BEGIN:VTIMEZONE
        TZID:Sample Odd
        BEGIN:STANDARD
        DTSTART:19700101T000000
        TZOFFSETFROM:+0517
        TZOFFSETTO:+0517
        END:STANDARD
        END:VTIMEZONE
    """)
    assert zone_for("Sample Odd", odd, NY, year=2026) == (NY, True)
    empty = Timezone()  # no observances: icalendar can't even read it from text
    empty["TZID"] = vText("Sample Empty")
    assert zone_for("Sample Empty", empty, NY, year=2026) == (NY, True)
