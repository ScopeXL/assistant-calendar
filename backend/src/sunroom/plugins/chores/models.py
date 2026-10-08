"""The chores plugin's tables (PLAN §10.3, ADR 0019, ADR 0025).

A chore is a rule, never a list of stored days: the day's due list is computed from the rule, the
assignees and the completions (domain/chores.py). A completion credits one person on one day;
Undo deletes it, taking the stamp and the stars back together. A star balance is computed too
(domain/points.py): done completions and finished routines, plus a parent's adjustments, minus
the rewards a parent said yes to.

Routines are short checklists a kid runs on their own (morning, bedtime). Their checks reset
daily because each one is stored for its day; finishing one is stored once per day, with the
stars it gave.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import IsoDate, UTCDateTime, new_id, utcnow


class AssigneeMode(StrEnum):
    FIXED = "fixed"  # each assignee has their own; one column each
    ROTATE = "rotate"  # one a day, in turn ("Mia's turn"); whoever does it gets the stars
    ANY = "any"  # one a day for anyone; the display asks "Who did it?"


class CompletionStatus(StrEnum):
    DONE = "done"
    PENDING = "pending"  # waiting for a parent's OK; no stars until then
    REJECTED = "rejected"  # a parent said it isn't done; it's due again


class RedemptionStatus(StrEnum):
    REQUESTED = "requested"
    APPROVED = "approved"  # the stars are spent
    DENIED = "denied"  # "Not now"
    CANCELLED = "cancelled"  # the kid took it back


class Chore(Base):
    __tablename__ = "chores"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(String(500), default=None)
    icon: Mapped[str | None] = mapped_column(String(32), default=None)
    points: Mapped[int] = mapped_column(Integer, default=0)
    rrule: Mapped[str | None] = mapped_column(String(500), default=None)  # None: one day only
    start_date: Mapped[date] = mapped_column(IsoDate())
    due_time: Mapped[str | None] = mapped_column(String(5), default=None)  # "HH:MM"
    assignee_mode: Mapped[str] = mapped_column(String(8), default=AssigneeMode.FIXED)
    assignee_member_ids_json: Mapped[str] = mapped_column(Text, default="[]")  # ordered
    rotation_index: Mapped[int] = mapped_column(Integer, default=0)  # whose turn the first is
    requires_approval: Mapped[bool | None] = mapped_column(Boolean, default=None)  # None: plugin
    skipped_dates_json: Mapped[str] = mapped_column(Text, default="[]")  # "Skip today"
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class ChoreCompletion(Base):
    __tablename__ = "chore_completions"
    __table_args__ = (UniqueConstraint("chore_id", "due_date", "member_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    chore_id: Mapped[str] = mapped_column(ForeignKey("chores.id"), index=True)
    due_date: Mapped[date] = mapped_column(IsoDate(), index=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"))  # who gets the credit
    completed_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    # The phone or screen it was tapped on (no foreign key: devices can be removed).
    completed_by_device_id: Mapped[str | None] = mapped_column(String(36), default=None)
    points_awarded: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default=CompletionStatus.DONE)
    approved_by_member_id: Mapped[str | None] = mapped_column(
        ForeignKey("members.id"), default=None
    )
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class PointAdjustment(Base):
    __tablename__ = "point_adjustments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), index=True)
    points: Mapped[int] = mapped_column(Integer)  # positive or negative
    reason: Mapped[str] = mapped_column(String(120), default="")
    by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Reward(Base):
    __tablename__ = "rewards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(80))
    cost_points: Mapped[int] = mapped_column(Integer)
    icon: Mapped[str | None] = mapped_column(String(32), default=None)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class Redemption(Base):
    __tablename__ = "redemptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    reward_id: Mapped[str] = mapped_column(ForeignKey("rewards.id"), index=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), index=True)
    cost_points: Mapped[int] = mapped_column(Integer)  # what it cost when asked
    status: Mapped[str] = mapped_column(String(10), default=RedemptionStatus.REQUESTED)
    requested_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    decided_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class Routine(Base):
    __tablename__ = "routines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(80))
    member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    days_json: Mapped[str] = mapped_column(Text, default="[0,1,2,3,4,5,6]")  # 0 Monday … 6 Sunday
    window_start: Mapped[str] = mapped_column(String(5))  # "HH:MM", household time
    window_end: Mapped[str] = mapped_column(String(5))
    icon: Mapped[str | None] = mapped_column(String(32), default=None)
    points: Mapped[int] = mapped_column(Integer, default=0)  # stars for finishing it
    sort: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class RoutineStep(Base):
    __tablename__ = "routine_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    routine_id: Mapped[str] = mapped_column(ForeignKey("routines.id"), index=True)
    title: Mapped[str] = mapped_column(String(80))
    icon: Mapped[str | None] = mapped_column(String(32), default=None)  # from the step library
    position: Mapped[int] = mapped_column(Integer, default=0)


class RoutineCheck(Base):
    __tablename__ = "routine_checks"

    routine_step_id: Mapped[str] = mapped_column(ForeignKey("routine_steps.id"), primary_key=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), primary_key=True)
    day: Mapped[date] = mapped_column(IsoDate(), primary_key=True)
    checked_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class RoutineFinish(Base):
    __tablename__ = "routine_finishes"

    routine_id: Mapped[str] = mapped_column(ForeignKey("routines.id"), primary_key=True)
    member_id: Mapped[str] = mapped_column(ForeignKey("members.id"), primary_key=True)
    day: Mapped[date] = mapped_column(IsoDate(), primary_key=True)
    finished_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    points_awarded: Mapped[int] = mapped_column(Integer, default=0)


TABLES = (
    "chores",
    "chore_completions",
    "point_adjustments",
    "rewards",
    "redemptions",
    "routines",
    "routine_steps",
    "routine_checks",
    "routine_finishes",
)
EXPORT_TABLES = TABLES
