"""The weather API's shapes (PLAN §11.3, UX §3 "the rail block"). Times are the household's wall
time without an offset ("2026-10-07T18:42"), as the board's are; temperatures are whole degrees
in the household's units; ``code`` is the WMO weather code Open-Meteo sends."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel

Units = Literal["fahrenheit", "celsius"]


class CurrentOut(BaseModel):
    time: dt.datetime
    temperature: int
    code: int
    is_day: bool


class HourOut(BaseModel):
    time: dt.datetime
    temperature: int
    code: int
    precipitation: int | None  # the chance of rain or snow, in percent


class DayOut(BaseModel):
    date: dt.date
    code: int
    high: int
    low: int
    precipitation: int | None  # the day's highest chance, in percent
    sunrise: dt.datetime | None
    sunset: dt.datetime | None


class WeatherOut(BaseModel):
    """``status``: ok (a forecast, maybe stale), no_location (Settings → Household → Location
    isn't set), waiting (set, nothing fetched yet), error (nothing to show, ``message`` says
    why)."""

    status: Literal["ok", "no_location", "waiting", "error"]
    location_label: str | None
    units: Units
    current: CurrentOut | None
    hourly: list[HourOut]  # from this hour, the next 24
    daily: list[DayOut]  # from today, up to 7 days
    fetched_at: dt.datetime | None
    stale: bool  # the forecast is over 3 hours old ("as of 9:10")
    message: str | None


class PlaceOut(BaseModel):
    """A town the location search found."""

    label: str  # "Springfield, Illinois, United States"
    latitude: float
    longitude: float
    timezone: str | None
