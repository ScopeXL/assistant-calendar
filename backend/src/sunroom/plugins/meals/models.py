"""The meals plugin's tables (PLAN §10.3).

A meal entry is one thing on one day in one slot (Dinner by default): free text with an optional
emoji, recipe link, note and the person cooking. Typing a new meal also keeps it as a saved meal,
so next week it's one tap; saved meals count how often they're made and can carry the
ingredients that "Add ingredients to Groceries" sends to the Lists plugin's Groceries.

Only one live entry holds a spot (day, slot, position): a partial unique index, so an entry
removed with Undo still keeps its place in history. Removing stamps ``deleted_at``; archiving a
saved meal does too. Both show in Recently removed for 7 days.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy import text as sql
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import IsoDate, UTCDateTime, new_id, utcnow


class MealSlot(StrEnum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"


class SavedMeal(Base):
    __tablename__ = "saved_meals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    text: Mapped[str] = mapped_column(String(120))
    emoji: Mapped[str | None] = mapped_column(String(16), default=None)
    recipe_url: Mapped[str | None] = mapped_column(String(500), default=None)
    ingredients_json: Mapped[str] = mapped_column(Text, default="[]")  # ["Tortillas", …]
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class MealEntry(Base):
    __tablename__ = "meal_entries"
    __table_args__ = (
        Index(
            "uq_meal_entries_spot",
            "day",
            "slot",
            "position",
            unique=True,
            sqlite_where=sql("deleted_at IS NULL"),
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    day: Mapped[date] = mapped_column(IsoDate(), index=True)
    slot: Mapped[str] = mapped_column(String(16), default=MealSlot.DINNER)
    position: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(String(120))
    emoji: Mapped[str | None] = mapped_column(String(16), default=None)
    recipe_url: Mapped[str | None] = mapped_column(String(500), default=None)
    note: Mapped[str | None] = mapped_column(String(300), default=None)
    member_id: Mapped[str | None] = mapped_column(
        ForeignKey("members.id"), default=None
    )  # who cooks
    saved_meal_id: Mapped[str | None] = mapped_column(ForeignKey("saved_meals.id"), default=None)
    source_url: Mapped[str | None] = mapped_column(
        String(500), default=None
    )  # reserved: a later Dinner Bell link (PLAN §19)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


TABLES = ("saved_meals", "meal_entries")
EXPORT_TABLES = TABLES
