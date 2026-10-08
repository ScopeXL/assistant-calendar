"""Time zone names as calendars write them, read as IANA zones (PLAN §8.3).

A calendar names a zone in one of four ways: an IANA name ("America/New_York"); the same behind
a vendor's prefix ("/mozilla.org/20050126_1/America/New_York"); a Windows name from Outlook or
Exchange ("Eastern Standard Time"); or an Outlook display name ("(UTC-05:00) Eastern Time (US &
Canada)"). Those are exact. Anything else is a guess: the zone whose offsets match the
calendar's own VTIMEZONE in the event's year (the household's zone when it matches), or else
the household's zone.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta, tzinfo
from functools import cache, lru_cache
from typing import cast
from zoneinfo import ZoneInfo, available_timezones

from icalendar import Timezone
from icalendar.prop import vDDDTypes
from icalendar.timezone import tzp

# Windows zone names: CLDR's windowsZones.xml, territory "001". Where CLDR keeps an old
# spelling, this has the current IANA name (Asia/Calcutta is Asia/Kolkata, Europe/Kiev is
# Europe/Kyiv), and Windows "UTC" is plain UTC.
WINDOWS: dict[str, str] = {
    "AUS Central Standard Time": "Australia/Darwin",
    "AUS Eastern Standard Time": "Australia/Sydney",
    "Afghanistan Standard Time": "Asia/Kabul",
    "Alaskan Standard Time": "America/Anchorage",
    "Aleutian Standard Time": "America/Adak",
    "Altai Standard Time": "Asia/Barnaul",
    "Arab Standard Time": "Asia/Riyadh",
    "Arabian Standard Time": "Asia/Dubai",
    "Arabic Standard Time": "Asia/Baghdad",
    "Argentina Standard Time": "America/Argentina/Buenos_Aires",
    "Astrakhan Standard Time": "Europe/Astrakhan",
    "Atlantic Standard Time": "America/Halifax",
    "Aus Central W. Standard Time": "Australia/Eucla",
    "Azerbaijan Standard Time": "Asia/Baku",
    "Azores Standard Time": "Atlantic/Azores",
    "Bahia Standard Time": "America/Bahia",
    "Bangladesh Standard Time": "Asia/Dhaka",
    "Belarus Standard Time": "Europe/Minsk",
    "Bougainville Standard Time": "Pacific/Bougainville",
    "Canada Central Standard Time": "America/Regina",
    "Cape Verde Standard Time": "Atlantic/Cape_Verde",
    "Caucasus Standard Time": "Asia/Yerevan",
    "Cen. Australia Standard Time": "Australia/Adelaide",
    "Central America Standard Time": "America/Guatemala",
    "Central Asia Standard Time": "Asia/Bishkek",
    "Central Brazilian Standard Time": "America/Cuiaba",
    "Central Europe Standard Time": "Europe/Budapest",
    "Central European Standard Time": "Europe/Warsaw",
    "Central Pacific Standard Time": "Pacific/Guadalcanal",
    "Central Standard Time": "America/Chicago",
    "Central Standard Time (Mexico)": "America/Mexico_City",
    "Chatham Islands Standard Time": "Pacific/Chatham",
    "China Standard Time": "Asia/Shanghai",
    "Cuba Standard Time": "America/Havana",
    "Dateline Standard Time": "Etc/GMT+12",
    "E. Africa Standard Time": "Africa/Nairobi",
    "E. Australia Standard Time": "Australia/Brisbane",
    "E. Europe Standard Time": "Europe/Chisinau",
    "E. South America Standard Time": "America/Sao_Paulo",
    "Easter Island Standard Time": "Pacific/Easter",
    "Eastern Standard Time": "America/New_York",
    "Eastern Standard Time (Mexico)": "America/Cancun",
    "Egypt Standard Time": "Africa/Cairo",
    "Ekaterinburg Standard Time": "Asia/Yekaterinburg",
    "FLE Standard Time": "Europe/Kyiv",
    "Fiji Standard Time": "Pacific/Fiji",
    "GMT Standard Time": "Europe/London",
    "GTB Standard Time": "Europe/Bucharest",
    "Georgian Standard Time": "Asia/Tbilisi",
    "Greenland Standard Time": "America/Nuuk",
    "Greenwich Standard Time": "Atlantic/Reykjavik",
    "Haiti Standard Time": "America/Port-au-Prince",
    "Hawaiian Standard Time": "Pacific/Honolulu",
    "India Standard Time": "Asia/Kolkata",
    "Iran Standard Time": "Asia/Tehran",
    "Israel Standard Time": "Asia/Jerusalem",
    "Jordan Standard Time": "Asia/Amman",
    "Kaliningrad Standard Time": "Europe/Kaliningrad",
    "Korea Standard Time": "Asia/Seoul",
    "Libya Standard Time": "Africa/Tripoli",
    "Line Islands Standard Time": "Pacific/Kiritimati",
    "Lord Howe Standard Time": "Australia/Lord_Howe",
    "Magadan Standard Time": "Asia/Magadan",
    "Magallanes Standard Time": "America/Punta_Arenas",
    "Marquesas Standard Time": "Pacific/Marquesas",
    "Mauritius Standard Time": "Indian/Mauritius",
    "Middle East Standard Time": "Asia/Beirut",
    "Montevideo Standard Time": "America/Montevideo",
    "Morocco Standard Time": "Africa/Casablanca",
    "Mountain Standard Time": "America/Denver",
    "Mountain Standard Time (Mexico)": "America/Mazatlan",
    "Myanmar Standard Time": "Asia/Yangon",
    "N. Central Asia Standard Time": "Asia/Novosibirsk",
    "Namibia Standard Time": "Africa/Windhoek",
    "Nepal Standard Time": "Asia/Kathmandu",
    "New Zealand Standard Time": "Pacific/Auckland",
    "Newfoundland Standard Time": "America/St_Johns",
    "Norfolk Standard Time": "Pacific/Norfolk",
    "North Asia East Standard Time": "Asia/Irkutsk",
    "North Asia Standard Time": "Asia/Krasnoyarsk",
    "North Korea Standard Time": "Asia/Pyongyang",
    "Omsk Standard Time": "Asia/Omsk",
    "Pacific SA Standard Time": "America/Santiago",
    "Pacific Standard Time": "America/Los_Angeles",
    "Pacific Standard Time (Mexico)": "America/Tijuana",
    "Pakistan Standard Time": "Asia/Karachi",
    "Paraguay Standard Time": "America/Asuncion",
    "Qyzylorda Standard Time": "Asia/Qyzylorda",
    "Romance Standard Time": "Europe/Paris",
    "Russia Time Zone 10": "Asia/Srednekolymsk",
    "Russia Time Zone 11": "Asia/Kamchatka",
    "Russia Time Zone 3": "Europe/Samara",
    "Russian Standard Time": "Europe/Moscow",
    "SA Eastern Standard Time": "America/Cayenne",
    "SA Pacific Standard Time": "America/Bogota",
    "SA Western Standard Time": "America/La_Paz",
    "SE Asia Standard Time": "Asia/Bangkok",
    "Saint Pierre Standard Time": "America/Miquelon",
    "Sakhalin Standard Time": "Asia/Sakhalin",
    "Samoa Standard Time": "Pacific/Apia",
    "Sao Tome Standard Time": "Africa/Sao_Tome",
    "Saratov Standard Time": "Europe/Saratov",
    "Singapore Standard Time": "Asia/Singapore",
    "South Africa Standard Time": "Africa/Johannesburg",
    "South Sudan Standard Time": "Africa/Juba",
    "Sri Lanka Standard Time": "Asia/Colombo",
    "Sudan Standard Time": "Africa/Khartoum",
    "Syria Standard Time": "Asia/Damascus",
    "Taipei Standard Time": "Asia/Taipei",
    "Tasmania Standard Time": "Australia/Hobart",
    "Tocantins Standard Time": "America/Araguaina",
    "Tokyo Standard Time": "Asia/Tokyo",
    "Tomsk Standard Time": "Asia/Tomsk",
    "Tonga Standard Time": "Pacific/Tongatapu",
    "Transbaikal Standard Time": "Asia/Chita",
    "Turkey Standard Time": "Europe/Istanbul",
    "Turks And Caicos Standard Time": "America/Grand_Turk",
    "US Eastern Standard Time": "America/Indiana/Indianapolis",
    "US Mountain Standard Time": "America/Phoenix",
    "UTC": "UTC",
    "UTC+12": "Etc/GMT-12",
    "UTC+13": "Etc/GMT-13",
    "UTC-02": "Etc/GMT+2",
    "UTC-08": "Etc/GMT+8",
    "UTC-09": "Etc/GMT+9",
    "UTC-11": "Etc/GMT+11",
    "Ulaanbaatar Standard Time": "Asia/Ulaanbaatar",
    "Venezuela Standard Time": "America/Caracas",
    "Vladivostok Standard Time": "Asia/Vladivostok",
    "Volgograd Standard Time": "Europe/Volgograd",
    "W. Australia Standard Time": "Australia/Perth",
    "W. Central Africa Standard Time": "Africa/Lagos",
    "W. Europe Standard Time": "Europe/Berlin",
    "W. Mongolia Standard Time": "Asia/Hovd",
    "West Asia Standard Time": "Asia/Tashkent",
    "West Bank Standard Time": "Asia/Hebron",
    "West Pacific Standard Time": "Pacific/Port_Moresby",
    "Yakutsk Standard Time": "Asia/Yakutsk",
    "Yukon Standard Time": "America/Whitehorse",
}

# Outlook's display names, after their "(UTC-05:00) " prefix, as Windows names. Older Outlook
# wrote "(GMT-05:00)" or "(GMT-05.00)", and some city lists changed over the years.
DISPLAY: dict[str, str] = {
    "International Date Line West": "Dateline Standard Time",
    "Coordinated Universal Time-11": "UTC-11",
    "Aleutian Islands": "Aleutian Standard Time",
    "Hawaii": "Hawaiian Standard Time",
    "Marquesas Islands": "Marquesas Standard Time",
    "Alaska": "Alaskan Standard Time",
    "Coordinated Universal Time-09": "UTC-09",
    "Baja California": "Pacific Standard Time (Mexico)",
    "Coordinated Universal Time-08": "UTC-08",
    "Pacific Time (US & Canada)": "Pacific Standard Time",
    "Pacific Time (US & Canada); Tijuana": "Pacific Standard Time",
    "Arizona": "US Mountain Standard Time",
    "Chihuahua, La Paz, Mazatlan": "Mountain Standard Time (Mexico)",
    "La Paz, Mazatlan": "Mountain Standard Time (Mexico)",
    "Mountain Time (US & Canada)": "Mountain Standard Time",
    "Yukon": "Yukon Standard Time",
    "Central America": "Central America Standard Time",
    "Central Time (US & Canada)": "Central Standard Time",
    "Easter Island": "Easter Island Standard Time",
    "Guadalajara, Mexico City, Monterrey": "Central Standard Time (Mexico)",
    "Saskatchewan": "Canada Central Standard Time",
    "Bogota, Lima, Quito": "SA Pacific Standard Time",
    "Bogota, Lima, Quito, Rio Branco": "SA Pacific Standard Time",
    "Chetumal": "Eastern Standard Time (Mexico)",
    "Eastern Time (US & Canada)": "Eastern Standard Time",
    "Haiti": "Haiti Standard Time",
    "Havana": "Cuba Standard Time",
    "Indiana (East)": "US Eastern Standard Time",
    "Turks and Caicos": "Turks And Caicos Standard Time",
    "Asuncion": "Paraguay Standard Time",
    "Atlantic Time (Canada)": "Atlantic Standard Time",
    "Caracas": "Venezuela Standard Time",
    "Cuiaba": "Central Brazilian Standard Time",
    "Georgetown, La Paz, Manaus, San Juan": "SA Western Standard Time",
    "Santiago": "Pacific SA Standard Time",
    "Newfoundland": "Newfoundland Standard Time",
    "Araguaina": "Tocantins Standard Time",
    "Brasilia": "E. South America Standard Time",
    "Cayenne, Fortaleza": "SA Eastern Standard Time",
    "City of Buenos Aires": "Argentina Standard Time",
    "Buenos Aires": "Argentina Standard Time",
    "Greenland": "Greenland Standard Time",
    "Montevideo": "Montevideo Standard Time",
    "Punta Arenas": "Magallanes Standard Time",
    "Saint Pierre and Miquelon": "Saint Pierre Standard Time",
    "Salvador": "Bahia Standard Time",
    "Coordinated Universal Time-02": "UTC-02",
    "Azores": "Azores Standard Time",
    "Cabo Verde Is.": "Cape Verde Standard Time",
    "Cape Verde Is.": "Cape Verde Standard Time",
    "Coordinated Universal Time": "UTC",
    "Dublin, Edinburgh, Lisbon, London": "GMT Standard Time",
    "Greenwich Mean Time : Dublin, Edinburgh, Lisbon, London": "GMT Standard Time",
    "Monrovia, Reykjavik": "Greenwich Standard Time",
    "Casablanca, Monrovia": "Greenwich Standard Time",
    "Casablanca, Monrovia, Reykjavik": "Greenwich Standard Time",
    "Sao Tome": "Sao Tome Standard Time",
    "Casablanca": "Morocco Standard Time",
    "Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna": "W. Europe Standard Time",
    "Belgrade, Bratislava, Budapest, Ljubljana, Prague": "Central Europe Standard Time",
    "Brussels, Copenhagen, Madrid, Paris": "Romance Standard Time",
    "Sarajevo, Skopje, Warsaw, Zagreb": "Central European Standard Time",
    "West Central Africa": "W. Central Africa Standard Time",
    "Amman": "Jordan Standard Time",
    "Athens, Bucharest": "GTB Standard Time",
    "Athens, Bucharest, Istanbul": "GTB Standard Time",
    "Beirut": "Middle East Standard Time",
    "Cairo": "Egypt Standard Time",
    "Chisinau": "E. Europe Standard Time",
    "Damascus": "Syria Standard Time",
    "Gaza, Hebron": "West Bank Standard Time",
    "Harare, Pretoria": "South Africa Standard Time",
    "Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius": "FLE Standard Time",
    "Helsinki, Kiev, Riga, Sofia, Tallinn, Vilnius": "FLE Standard Time",
    "Jerusalem": "Israel Standard Time",
    "Juba": "South Sudan Standard Time",
    "Kaliningrad": "Kaliningrad Standard Time",
    "Khartoum": "Sudan Standard Time",
    "Tripoli": "Libya Standard Time",
    "Windhoek": "Namibia Standard Time",
    "Baghdad": "Arabic Standard Time",
    "Istanbul": "Turkey Standard Time",
    "Kuwait, Riyadh": "Arab Standard Time",
    "Minsk": "Belarus Standard Time",
    "Moscow, St. Petersburg": "Russian Standard Time",
    "Moscow, St. Petersburg, Volgograd": "Russian Standard Time",
    "Nairobi": "E. Africa Standard Time",
    "Volgograd": "Volgograd Standard Time",
    "Tehran": "Iran Standard Time",
    "Abu Dhabi, Muscat": "Arabian Standard Time",
    "Astrakhan, Ulyanovsk": "Astrakhan Standard Time",
    "Baku": "Azerbaijan Standard Time",
    "Izhevsk, Samara": "Russia Time Zone 3",
    "Port Louis": "Mauritius Standard Time",
    "Saratov": "Saratov Standard Time",
    "Tbilisi": "Georgian Standard Time",
    "Yerevan": "Caucasus Standard Time",
    "Kabul": "Afghanistan Standard Time",
    "Ashgabat, Tashkent": "West Asia Standard Time",
    "Ekaterinburg": "Ekaterinburg Standard Time",
    "Islamabad, Karachi": "Pakistan Standard Time",
    "Qyzylorda": "Qyzylorda Standard Time",
    "Chennai, Kolkata, Mumbai, New Delhi": "India Standard Time",
    "Sri Jayawardenepura": "Sri Lanka Standard Time",
    "Kathmandu": "Nepal Standard Time",
    "Astana": "Central Asia Standard Time",
    "Bishkek": "Central Asia Standard Time",
    "Dhaka": "Bangladesh Standard Time",
    "Omsk": "Omsk Standard Time",
    "Yangon (Rangoon)": "Myanmar Standard Time",
    "Bangkok, Hanoi, Jakarta": "SE Asia Standard Time",
    "Barnaul, Gorno-Altaysk": "Altai Standard Time",
    "Hovd": "W. Mongolia Standard Time",
    "Krasnoyarsk": "North Asia Standard Time",
    "Novosibirsk": "N. Central Asia Standard Time",
    "Tomsk": "Tomsk Standard Time",
    "Beijing, Chongqing, Hong Kong, Urumqi": "China Standard Time",
    "Irkutsk": "North Asia East Standard Time",
    "Kuala Lumpur, Singapore": "Singapore Standard Time",
    "Perth": "W. Australia Standard Time",
    "Taipei": "Taipei Standard Time",
    "Ulaanbaatar": "Ulaanbaatar Standard Time",
    "Eucla": "Aus Central W. Standard Time",
    "Chita": "Transbaikal Standard Time",
    "Osaka, Sapporo, Tokyo": "Tokyo Standard Time",
    "Pyongyang": "North Korea Standard Time",
    "Seoul": "Korea Standard Time",
    "Yakutsk": "Yakutsk Standard Time",
    "Adelaide": "Cen. Australia Standard Time",
    "Darwin": "AUS Central Standard Time",
    "Brisbane": "E. Australia Standard Time",
    "Canberra, Melbourne, Sydney": "AUS Eastern Standard Time",
    "Guam, Port Moresby": "West Pacific Standard Time",
    "Hobart": "Tasmania Standard Time",
    "Vladivostok": "Vladivostok Standard Time",
    "Lord Howe Island": "Lord Howe Standard Time",
    "Bougainville Island": "Bougainville Standard Time",
    "Chokurdakh": "Russia Time Zone 10",
    "Magadan": "Magadan Standard Time",
    "Norfolk Island": "Norfolk Standard Time",
    "Sakhalin": "Sakhalin Standard Time",
    "Solomon Is., New Caledonia": "Central Pacific Standard Time",
    "Anadyr, Petropavlovsk-Kamchatsky": "Russia Time Zone 11",
    "Auckland, Wellington": "New Zealand Standard Time",
    "Coordinated Universal Time+12": "UTC+12",
    "Fiji": "Fiji Standard Time",
    "Chatham Islands": "Chatham Islands Standard Time",
    "Coordinated Universal Time+13": "UTC+13",
    "Nuku'alofa": "Tonga Standard Time",
    "Samoa": "Samoa Standard Time",
    "Kiritimati Island": "Line Islands Standard Time",
}

# Names for "no offset, ever": all of them mean UTC, which is what a time ending in Z says.
_UTC_NAMES = frozenset(
    {
        "utc",
        "z",
        "uct",
        "zulu",
        "universal",
        "gmt",
        "gmt0",
        "gmt+0",
        "gmt-0",
        "greenwich",
        "etc/utc",
        "etc/uct",
        "etc/zulu",
        "etc/universal",
        "etc/gmt",
        "etc/gmt0",
        "etc/gmt+0",
        "etc/gmt-0",
        "etc/greenwich",
    }
)
_NOT_ZONES = frozenset({"factory", "localtime", "posixrules"})
# When several zones share a VTIMEZONE's offsets all year, the one most people mean.
_PREFERRED = (
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Phoenix",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Halifax",
    "America/St_Johns",
    "America/Regina",
    "America/Mexico_City",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Paris",
    "Europe/Athens",
    "Europe/Helsinki",
    "Europe/Moscow",
    "Asia/Jerusalem",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Australia/Perth",
    "Australia/Adelaide",
    "Australia/Darwin",
    "Australia/Brisbane",
    "Australia/Sydney",
    "Pacific/Auckland",
)
_DISPLAY_PREFIX = re.compile(
    r"\(\s*(?:UTC|GMT)\s*(?:[+-]\s*[0-9]{1,2}(?:[:.]?[0-9]{2})?)?\s*\)\s*(?P<tail>.+)",
    re.IGNORECASE,
)
_NUMBERED = re.compile(r"\s+[0-9]+$")  # Outlook's "Eastern Standard Time 1"
_SAMPLE_DAYS = tuple((month, day) for month in range(1, 13) for day in (1, 15))
# A VTIMEZONE's rules usually start in 1601 or 1970 and run on; without the event's year, its
# offsets are compared in a year that today's rules cover.
_EARLIEST_YEAR, _LATEST_YEAR = 2000, 2100


def zone_for(
    tzid: str | None,
    vtimezone: Timezone | None,
    household: ZoneInfo,
    *,
    year: int | None = None,
) -> tuple[ZoneInfo, bool]:
    """The IANA zone a TZID means, and whether that's a guess (True when it fell back).

    ``vtimezone`` is the calendar's VTIMEZONE for this TZID, if it has one; ``year`` is the
    event's year, for matching that VTIMEZONE's offsets (by default, the latest year it names).
    """
    name = _clean(tzid)
    if name:
        known = named_zone(name)
        if known is not None:
            return known, False
    if vtimezone is not None:
        matched = _by_offsets(vtimezone, household, year)
        if matched is not None:
            return matched, True
    return household, True


def named_zone(name: str) -> ZoneInfo | None:
    """The zone a name means exactly (IANA, vendor-prefixed IANA, Windows or Outlook display
    name), or None."""
    name = _clean(name)
    if not name:
        return None
    found = _iana(name)
    if found is not None:
        return found
    if "/" in name:  # "/mozilla.org/20050126_1/America/New_York": the longest IANA tail
        parts = [part for part in name.split("/") if part]
        for start in range(1, len(parts)):
            found = _iana("/".join(parts[start:]))
            if found is not None:
                return found
    windows = _windows().get(_fold(name)) or _windows().get(_fold(_NUMBERED.sub("", name)))
    if windows is not None:
        return _iana(windows)
    match = _DISPLAY_PREFIX.fullmatch(name)
    tail = match.group("tail") if match else name
    windows = _display().get(_fold(tail))
    return _iana(WINDOWS[windows]) if windows is not None else None


def _clean(tzid: str | None) -> str:
    return (tzid or "").strip().strip('"').strip()


def _fold(text: str) -> str:
    return " ".join(text.split()).casefold()


@cache
def _zone_keys() -> dict[str, str]:
    """Every IANA name this system knows, by its lowercase spelling (so a lookup never
    depends on whether the file system ignores case)."""
    keys: dict[str, str] = {}
    for key in sorted(available_timezones()):
        if key.casefold() not in _NOT_ZONES:
            keys[key.casefold()] = key
    return keys


@cache
def _windows() -> dict[str, str]:
    return {_fold(name): zone for name, zone in WINDOWS.items()}


@cache
def _display() -> dict[str, str]:
    return {_fold(tail): windows for tail, windows in DISPLAY.items()}


def _iana(name: str) -> ZoneInfo | None:
    folded = name.casefold()
    if folded in _UTC_NAMES:
        return ZoneInfo("UTC")
    key = _zone_keys().get(folded)
    return ZoneInfo(key) if key is not None else None


# --- Matching a VTIMEZONE by its offsets ------------------------------------------------------


def _by_offsets(vtimezone: Timezone, household: ZoneInfo, year: int | None) -> ZoneInfo | None:
    """The zone whose UTC offsets through ``year`` best match the VTIMEZONE's: only zones
    with the same set of offsets count; the fewest differing days wins, then the household's
    zone, then one in its region, then the one most people mean."""
    year = _year_of(vtimezone, year)
    try:
        wanted = _signature(_custom_zone(vtimezone), year)
    except Exception:  # a VTIMEZONE too broken to read: nothing to match
        return None
    offsets = set(wanted)
    region = household.key.split("/")[0]
    best: tuple[int, int, int] | None = None
    best_key = ""
    candidates = [(household.key, _signature(household, year)), *_table(year)]
    for rank, (key, found) in enumerate(candidates):
        if set(found) != offsets:
            continue
        tier = 0 if key == household.key else 1 if key.split("/")[0] == region else 2
        score = (sum(a != b for a, b in zip(found, wanted, strict=True)), tier, rank)
        if best is None or score < best:
            best, best_key = score, key
    return ZoneInfo(best_key) if best is not None else None


def _year_of(vtimezone: Timezone, year: int | None) -> int:
    if year is None:
        onsets = [
            start.dt.year
            for observance in vtimezone.subcomponents
            if isinstance(start := observance.get("DTSTART"), vDDDTypes)
            and isinstance(start.dt, datetime)
        ]
        year = max(onsets, default=_EARLIEST_YEAR)
    return min(max(year, _EARLIEST_YEAR), _LATEST_YEAR)


def _signature(zone: tzinfo, year: int) -> tuple[int, ...]:
    """The zone's UTC offset, in minutes, at noon UTC on the 1st and 15th of each month."""
    found: list[int] = []
    for month, day in _SAMPLE_DAYS:
        offset = datetime(year, month, day, 12, tzinfo=UTC).astimezone(zone).utcoffset()
        found.append((offset or timedelta(0)) // timedelta(minutes=1))
    return tuple(found)


@lru_cache(maxsize=8)
def _table(year: int) -> tuple[tuple[str, tuple[int, ...]], ...]:
    """Every zone's offsets in ``year``: the preferred zones first, then the ones Windows
    names, then the rest by name."""
    ordered = list(dict.fromkeys([*_PREFERRED, *WINDOWS.values()]))
    seen = set(ordered)
    ordered += [key for key in _zone_keys().values() if key not in seen]
    return tuple((key, _signature(ZoneInfo(key), year)) for key in ordered)


def _custom_zone(vtimezone: Timezone) -> tzinfo:
    """The VTIMEZONE as a tzinfo, as icalendar reads it (its annotations here don't resolve)."""
    return cast("tzinfo", tzp.create_timezone(vtimezone))  # pyright: ignore[reportUnknownMemberType]
