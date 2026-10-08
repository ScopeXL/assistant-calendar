"""The countdowns plugin's table (PLAN §10.3).

A countdown is a day the family looks forward to ("Beach trip", "Last day of school") with an
optional emoji, person, color and time. A yearly one counts down to its next date every year;
any other leaves for Recently removed the day after (``deleted_at``), and is gone 7 days later.
Birthdays aren't rows: they come from people's birthdays (household's ``members``).
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import IsoDate, UTCDateTime, new_id, utcnow


class Countdown(Base):
    __tablename__ = "countdowns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(80))
    emoji: Mapped[str | None] = mapped_column(String(16), default=None)
    color: Mapped[str | None] = mapped_column(String(8), default=None)  # a person color's name
    date: Mapped[dt.date] = mapped_column(IsoDate(), index=True)
    time: Mapped[str | None] = mapped_column(String(5), default=None)  # "HH:MM"
    repeat_yearly: Mapped[bool] = mapped_column(Boolean, default=False)
    member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    show_on_display: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    created_at: Mapped[dt.datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[dt.datetime | None] = mapped_column(UTCDateTime(), default=None)


TABLES = ("countdowns",)
EXPORT_TABLES = TABLES
