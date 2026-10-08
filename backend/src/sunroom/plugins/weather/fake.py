"""The test server's weather (SUNROOM_TEST_MODE: ``just seed``, screenshots, end-to-end runs): a
made-up week in Open-Meteo's own answer shape, and two made-up places for the town search, so
the test server never touches the network. Deterministic: the same moment, zone and units give
the same forecast, with October-ish numbers and the sun up from about 7:05 AM to 6:30 PM.
Synthetic only.
"""

from __future__ import annotations

import math
from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sunroom.domain.timeparts import to_local
from sunroom.plugins.weather.schemas import PlaceOut, Units

# From today: the high and the low (°C), the WMO code, the day's highest chance of rain (%).
WEEK: tuple[tuple[float, float, int, int], ...] = (
    (18.4, 10.2, 2, 10),  # partly cloudy
    (19.6, 11.5, 1, 5),  # mainly clear
    (16.1, 11.0, 61, 70),  # light rain
    (14.7, 8.3, 3, 25),  # overcast
    (17.2, 7.9, 0, 0),  # clear
    (19.0, 10.4, 2, 15),
    (17.8, 12.1, 80, 55),  # showers
)
SUNRISE = time(7, 5)  # a minute later each day
SUNSET = time(18, 30)  # a minute and a half earlier each day

PLACES = (
    PlaceOut(
        label="Sample Town, Sample State, United States",
        latitude=40.71,
        longitude=-74.01,
        timezone="America/New_York",
    ),
    PlaceOut(
        label="Sample Harbour, Sample County, United Kingdom",
        latitude=51.48,
        longitude=0.0,
        timezone="Europe/London",
    ),
)


def places(name: str) -> list[PlaceOut]:
    """The made-up places with ``name`` in their label ("Sample" finds both)."""
    wanted = name.casefold()
    return [place for place in PLACES if wanted in place.label.casefold()]


def forecast(
    *, now: datetime, zone: ZoneInfo, units: Units, latitude: float, longitude: float
) -> dict[str, Any]:
    """A week from the household's today, as Open-Meteo would answer for this place."""
    local = to_local(now, zone)
    today = local.date()
    unit = "°F" if units == "fahrenheit" else "°C"
    times: list[str] = []
    temperatures: list[float] = []
    codes: list[int] = []
    chances: list[int] = []
    days: list[str] = []
    highs: list[float] = []
    lows: list[float] = []
    day_codes: list[int] = []
    day_chances: list[int] = []
    sunrises: list[str] = []
    sunsets: list[str] = []
    for offset, (high, low, code, chance) in enumerate(WEEK):
        day = today + timedelta(days=offset)
        for hour in range(24):
            warmth = _warmth(hour)
            times.append(_wall(datetime.combine(day, time(hour))))
            temperatures.append(_degrees(low + (high - low) * warmth, units))
            codes.append(code if code < 51 or 11 <= hour <= 19 else 3)  # rain in the afternoon
            chances.append(round(chance * (0.3 + 0.7 * warmth)))
        days.append(day.isoformat())
        highs.append(_degrees(high, units))
        lows.append(_degrees(low, units))
        day_codes.append(code)
        day_chances.append(chance)
        sunrises.append(_wall(datetime.combine(day, SUNRISE) + timedelta(minutes=offset)))
        sunsets.append(_wall(datetime.combine(day, SUNSET) - timedelta(minutes=3 * offset // 2)))
    sun_up = datetime.combine(today, SUNRISE) <= local < datetime.combine(today, SUNSET)
    offset_now = now.astimezone(zone).utcoffset() or timedelta()
    return {
        "latitude": latitude,
        "longitude": longitude,
        "generationtime_ms": 0.1,
        "utc_offset_seconds": int(offset_now.total_seconds()),
        "timezone": zone.key,
        "timezone_abbreviation": now.astimezone(zone).tzname() or "",
        "elevation": 10.0,
        "current_units": {
            "time": "iso8601",
            "interval": "seconds",
            "temperature_2m": unit,
            "weather_code": "wmo code",
            "is_day": "",
        },
        "current": {
            "time": _wall(local.replace(minute=local.minute // 15 * 15, second=0, microsecond=0)),
            "interval": 900,
            "temperature_2m": temperatures[local.hour],
            "weather_code": codes[local.hour],
            "is_day": int(sun_up),
        },
        "hourly_units": {
            "time": "iso8601",
            "temperature_2m": unit,
            "weather_code": "wmo code",
            "precipitation_probability": "%",
        },
        "hourly": {
            "time": times,
            "temperature_2m": temperatures,
            "weather_code": codes,
            "precipitation_probability": chances,
        },
        "daily_units": {
            "time": "iso8601",
            "weather_code": "wmo code",
            "temperature_2m_max": unit,
            "temperature_2m_min": unit,
            "precipitation_probability_max": "%",
            "sunrise": "iso8601",
            "sunset": "iso8601",
        },
        "daily": {
            "time": days,
            "weather_code": day_codes,
            "temperature_2m_max": highs,
            "temperature_2m_min": lows,
            "precipitation_probability_max": day_chances,
            "sunrise": sunrises,
            "sunset": sunsets,
        },
    }


def _warmth(hour: int) -> float:
    """How far through the day's swing an hour is: 0 at its coolest (6 AM), 1 at its warmest
    (3 PM)."""
    if 6 <= hour <= 15:
        return 0.5 - 0.5 * math.cos(math.pi * (hour - 6) / 9)
    since = (hour - 15) % 24  # hours since 3 PM
    return 0.5 + 0.5 * math.cos(math.pi * since / 15)


def _degrees(celsius: float, units: Units) -> float:
    return round(celsius * 9 / 5 + 32 if units == "fahrenheit" else celsius, 1)


def _wall(at: datetime) -> str:
    return at.isoformat(timespec="minutes")  # "2026-10-07T10:00", as Open-Meteo writes it
