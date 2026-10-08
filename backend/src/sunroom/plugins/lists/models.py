"""The lists plugin's tables (PLAN §10.3).

A list is a shared checklist: groceries, a to-do list, packing. Its items can carry a quantity, a
note, a person and a day. Checking an item keeps it, struck, under Done; **Clear done** stamps
``cleared_at`` and hides it, so Undo can bring it back and the list's history still knows what the
family buys (its Usuals). Removing a list or an item stamps ``deleted_at`` instead: those show in
Recently removed for 7 days.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import IsoDate, UTCDateTime, new_id, utcnow


class ListKind(StrEnum):
    GROCERY = "grocery"  # "12 to get"; Usuals start with the staples
    TODO = "todo"  # "4 to do"
    PACKING = "packing"  # "9 to pack"
    CUSTOM = "custom"  # "3 left"


class ShoppingList(Base):
    """A list. Named so it doesn't shadow the builtin; the table is ``lists``."""

    __tablename__ = "lists"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(16), default=ListKind.CUSTOM)
    icon: Mapped[str | None] = mapped_column(String(32), default=None)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class ListItem(Base):
    __tablename__ = "list_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    list_id: Mapped[str] = mapped_column(ForeignKey("lists.id"), index=True)
    text: Mapped[str] = mapped_column(String(200))
    note: Mapped[str | None] = mapped_column(String(500), default=None)
    quantity: Mapped[str | None] = mapped_column(String(20), default=None)
    due_date: Mapped[date | None] = mapped_column(IsoDate(), default=None, index=True)
    assigned_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    checked_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    checked_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    position: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    cleared_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


TABLES = ("lists", "list_items")
EXPORT_TABLES = TABLES
