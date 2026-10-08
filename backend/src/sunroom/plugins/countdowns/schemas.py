"""The countdowns API's shapes (PLAN §11.3, UX §4 "Countdowns room")."""

from __future__ import annotations

import datetime as dt
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints

from sunroom.household.schemas import PersonColor

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Emoji = Annotated[str, StringConstraints(strip_whitespace=True, max_length=16)]
Clock = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


class CountdownOut(BaseModel):
    id: str
    title: str
    emoji: str | None
    color: PersonColor | None
    date: dt.date  # as set (a yearly one's first date)
    time: str | None  # "HH:MM"
    repeat_yearly: bool
    member_id: str | None
    show_on_display: bool
    created_by_member_id: str | None
    created_at: dt.datetime


class CountdownIn(BaseModel):
    title: Title
    date: dt.date
    emoji: Emoji | None = None
    color: PersonColor | None = None
    time: Clock | None = None
    repeat_yearly: bool = False
    member_id: str | None = None
    show_on_display: bool = True


class CountdownPatch(BaseModel):
    """Only what's sent changes; an empty emoji clears it."""

    title: Title | None = None
    date: dt.date | None = None
    emoji: Emoji | None = None
    color: PersonColor | None = None
    clear_color: bool = False
    time: Clock | None = None
    clear_time: bool = False
    repeat_yearly: bool | None = None
    member_id: str | None = None
    clear_member: bool = False
    show_on_display: bool | None = None


class UpcomingOut(BaseModel):
    """One thing coming up: a countdown, or a person's birthday (from their birthday in Family)."""

    key: str  # "countdown:<id>" or "birthday:<member id>"
    kind: Literal["countdown", "birthday"]
    countdown_id: str | None
    title: str  # a birthday's is written out: "Mia's birthday"
    emoji: str | None
    color: PersonColor | None  # the countdown's own; None: the person's color, or neutral
    member_id: str | None
    date: dt.date  # when it next comes round
    time: str | None
    days: int  # 0 today, 1 tomorrow…
    turning: int | None  # a birthday's age
    show_on_display: bool


class UpcomingListOut(BaseModel):
    today: dt.date
    items: list[UpcomingOut]  # soonest first


class RemovedCountdownOut(BaseModel):
    id: str
    title: str
    date: dt.date
    deleted_at: dt.datetime
