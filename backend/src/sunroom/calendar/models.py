"""Calendars and events (PLAN §7.1, §10.1).

An event row is a series master (``parent_event_id`` NULL) or an override of one occurrence
(``parent_event_id`` and ``recurrence_id`` set). Timed rows hold UTC instants and the zone the
rule runs in; all-day rows hold dates with an exclusive end. ``window_*`` bound every occurrence
of a master (overrides included) for indexed range queries.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import IsoDate, UTCDateTime, new_id, utcnow


class CalendarKind(StrEnum):
    LOCAL = "local"
    SYNC = "sync"


class EventStatus(StrEnum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class EventSource(StrEnum):
    LOCAL = "local"
    SYNC = "sync"


class RevisionAction(StrEnum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    MOVE = "move"
    RESTORE = "restore"


class Calendar(Base):
    __tablename__ = "calendars"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(80))
    color: Mapped[str] = mapped_column(String(8))  # one of the eight person colors
    kind: Mapped[str] = mapped_column(String(8), default=CalendarKind.LOCAL)
    owner_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    read_only: Mapped[bool] = mapped_column(Boolean, default=False)
    visible_on_display: Mapped[bool] = mapped_column(Boolean, default=True)
    # Bumped on every event write in this calendar: the occurrence cache's key.
    version: Mapped[int] = mapped_column(Integer, default=1)
    remote_ref: Mapped[str | None] = mapped_column(String(500), default=None)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        UniqueConstraint("calendar_id", "remote_uid", "recurrence_id"),
        CheckConstraint(
            "(all_day = 0 AND start_utc IS NOT NULL AND end_utc IS NOT NULL AND tzid IS NOT NULL"
            " AND start_date IS NULL AND end_date IS NULL) OR "
            "(all_day = 1 AND start_date IS NOT NULL AND end_date IS NOT NULL"
            " AND start_utc IS NULL AND end_utc IS NULL)",
            name="one_timing",
        ),
        CheckConstraint(
            "recurrence_id IS NULL OR parent_event_id IS NOT NULL", name="override_has_parent"
        ),
        Index("ix_events_range", "calendar_id", "window_start_utc", "window_end_utc"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    calendar_id: Mapped[str] = mapped_column(ForeignKey("calendars.id"))
    parent_event_id: Mapped[str | None] = mapped_column(
        ForeignKey("events.id"), index=True, default=None
    )
    # An override's original occurrence start: a naive local "YYYY-MM-DDTHH:MM:SS" or a date.
    recurrence_id: Mapped[str | None] = mapped_column(String(19), default=None)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    location: Mapped[str] = mapped_column(String(300), default="")
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    start_utc: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    end_utc: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    tzid: Mapped[str | None] = mapped_column(String(64), default=None)
    start_date: Mapped[date | None] = mapped_column(IsoDate(), default=None)
    end_date: Mapped[date | None] = mapped_column(IsoDate(), default=None)  # exclusive
    floating: Mapped[bool] = mapped_column(Boolean, default=False)
    rrule: Mapped[str | None] = mapped_column(String(500), default=None)
    rdates_json: Mapped[str] = mapped_column(Text, default="[]")
    exdates_json: Mapped[str] = mapped_column(Text, default="[]")
    window_start_utc: Mapped[datetime] = mapped_column(UTCDateTime())
    window_end_utc: Mapped[datetime] = mapped_column(UTCDateTime())
    status: Mapped[str] = mapped_column(String(10), default=EventStatus.CONFIRMED)
    color: Mapped[str | None] = mapped_column(String(8), default=None)
    source: Mapped[str] = mapped_column(String(8), default=EventSource.LOCAL)
    remote_uid: Mapped[str | None] = mapped_column(String(500), default=None)
    remote_id: Mapped[str | None] = mapped_column(String(500), default=None)
    etag: Mapped[str | None] = mapped_column(String(200), default=None)
    remote_updated_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    remote_sequence: Mapped[int | None] = mapped_column(Integer, default=None)
    pending_push: Mapped[bool] = mapped_column(Boolean, default=False)
    pending_delete: Mapped[bool] = mapped_column(Boolean, default=False)
    raw_ical: Mapped[str | None] = mapped_column(Text, default=None)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class EventMember(Base):
    """Who an event is for; no rows means Everyone."""

    __tablename__ = "event_members"

    event_id: Mapped[str] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), primary_key=True
    )
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), primary_key=True)


class EventReminder(Base):
    """A toast on the kitchen screen this many minutes before the start."""

    __tablename__ = "event_reminders"

    event_id: Mapped[str] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), primary_key=True
    )
    minutes_before: Mapped[int] = mapped_column(Integer, primary_key=True)


class EventRevision(Base):
    """What a change replaced, so Undo can put it back (30 days; PLAN §7.4).

    ``before_json`` snapshots every series the change touched (masters with their overrides,
    people and reminders); ``created_ids_json`` lists rows the change made, which Undo
    removes (a new event, the second half of a split)."""

    __tablename__ = "event_revisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    series_id: Mapped[str] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(10))
    before_json: Mapped[str] = mapped_column(Text, default="[]")
    created_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    device_id: Mapped[str | None] = mapped_column(String(36), default=None)
    member_id: Mapped[str | None] = mapped_column(String(36), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)
    undone_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
