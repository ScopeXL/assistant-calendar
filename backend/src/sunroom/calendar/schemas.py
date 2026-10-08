"""The calendar API's shapes (PLAN §7, §11.1).

Times go in as the household's wall time: a timed event's ``start``/``end`` are naive local
datetimes in its zone (``tzid``, the household's by default); an all-day event has dates with
an exclusive end. Occurrences come back with UTC instants and the household's wall time.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from sunroom.household.schemas import PersonColor

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
CalendarName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Reminder = Annotated[int, Field(ge=0, le=7 * 24 * 60)]
Scope = Literal["this", "following", "all"]


class CalendarOut(BaseModel):
    id: str
    name: str
    color: PersonColor
    kind: Literal["local", "sync"]
    owner_member_id: str | None
    read_only: bool
    visible_on_display: bool
    version: int
    is_default: bool
    deleted: bool


class CalendarCreate(BaseModel):
    name: CalendarName
    color: PersonColor = "sky"
    owner_member_id: str | None = None
    visible_on_display: bool = True


class CalendarUpdate(BaseModel):
    name: CalendarName | None = None
    color: PersonColor | None = None
    owner_member_id: str | None = None
    visible_on_display: bool | None = None
    is_default: bool | None = None


class EventFields(BaseModel):
    """The editable parts of an event; on an update, only the fields sent change."""

    calendar_id: str | None = None
    title: Title | None = None
    description: Annotated[str, StringConstraints(max_length=5000)] | None = None
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None
    all_day: bool | None = None
    start: datetime | None = None  # timed: naive wall time in tzid
    end: datetime | None = None
    start_date: date | None = None  # all-day: end exclusive
    end_date: date | None = None
    tzid: Annotated[str, StringConstraints(max_length=64)] | None = None
    rrule: Annotated[str, StringConstraints(max_length=500)] | None = None
    member_ids: list[str] | None = None
    reminders: list[Reminder] | None = None
    color: PersonColor | None = None


class EventCreate(EventFields):
    title: Title = Field(...)  # pyright: ignore[reportIncompatibleVariableOverride]


class EventUpdate(EventFields):
    """PATCH a whole series (``scope`` all) or, at an occurrence, ``this`` / ``following``.
    ``clear_rrule``/``clear_color`` say "remove it" (None means "leave it")."""

    scope: Scope = "all"
    expected_version: int | None = None
    clear_rrule: bool = False
    clear_color: bool = False


class MoveIn(BaseModel):
    """The drag fast path: to another day, keeping the time of day and the length."""

    to_date: date
    recurrence_id: str | None = None
    scope: Scope = "all"


class UndoIn(BaseModel):
    revision_id: str | None = None


class EventOut(BaseModel):
    id: str
    calendar_id: str
    title: str
    description: str
    location: str
    all_day: bool
    start: datetime | None  # wall time in tzid
    end: datetime | None
    start_date: date | None
    end_date: date | None
    tzid: str | None
    rrule: str | None
    repeat_text: str | None  # "Every week on Thu"
    exdates: list[str]
    member_ids: list[str]
    reminders: list[int]
    color: PersonColor | None
    status: str
    source: str
    read_only: bool
    version: int
    is_override: bool
    parent_event_id: str | None
    recurrence_id: str | None
    created_by_member_id: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class ChangeOut(BaseModel):
    """What a change did: the series now (None when it was removed), the revision Undo
    reverses, and how many one-off changes it had to drop."""

    event: EventOut | None
    revision_id: str
    dropped_overrides: int = 0


class OccurrenceOut(BaseModel):
    key: str  # "<event id>|<recurrence id>"
    event_id: str | None  # None for an overlay
    recurrence_id: str | None
    calendar_id: str | None
    title: str
    location: str
    all_day: bool
    start_utc: datetime | None
    end_utc: datetime | None
    start_local: datetime | None  # the household's wall time
    end_local: datetime | None
    start_date: date | None
    end_date: date | None  # exclusive
    member_ids: list[str]
    color: PersonColor | None
    calendar_color: PersonColor | None
    is_recurring: bool
    is_override: bool
    read_only: bool
    source: str
    status: str
    overlay: str | None
    reminders: list[int]
    version: int  # the series' version, for an update's expected_version


class OccurrencesOut(BaseModel):
    from_date: date
    to_date: date
    timezone: str
    calendar_versions: dict[str, int]
    occurrences: list[OccurrenceOut]


class DescribeOut(BaseModel):
    text: str
    rrule: str  # normalized


class SearchHit(BaseModel):
    event: EventOut
    next_start_local: datetime | None  # the next (or last) occurrence, wall time
    next_start_date: date | None
