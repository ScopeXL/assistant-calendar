"""The weather plugin's table (PLAN §10.3): one row, the last forecast Open-Meteo sent for the
household's place, so the wall shows weather straight after a restart and keeps showing the last
one ("as of 9:10") when Open-Meteo doesn't answer. It's a cache: never exported.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import UTCDateTime


class WeatherCache(Base):
    __tablename__ = "weather_cache"
    __table_args__ = (CheckConstraint("id = 1", name="one_row"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    units: Mapped[str] = mapped_column(String(12))  # fahrenheit or celsius
    payload_json: Mapped[str | None] = mapped_column(Text, default=None)  # Open-Meteo's answer
    fetched_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    last_error: Mapped[str | None] = mapped_column(String(300), default=None)  # plain English
    last_error_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


TABLES = ("weather_cache",)
EXPORT_TABLES: tuple[str, ...] = ()
