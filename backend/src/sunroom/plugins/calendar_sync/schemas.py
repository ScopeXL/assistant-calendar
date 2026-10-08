"""The calendar_sync API's shapes (PLAN §11.2). Nothing secret ever goes out: passwords, keys
and tokens are write-only, and a feed's address comes back with its secret part hidden."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

from sunroom.household.schemas import PersonColor

Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=4, max_length=2000)]
ProviderName = Literal["ics", "caldav", "google", "holidays", "fake"]
StatusName = Literal["connected", "needs_reconnect", "error", "paused"]


class RemoteCalendarOut(BaseModel):
    id: str
    name: str
    color_hint: str | None
    read_only: bool
    mapped: bool
    calendar_id: str | None
    color: PersonColor | None  # the Sunroom calendar's color, once mapped
    owner_member_id: str | None
    visible_on_display: bool
    last_synced_at: datetime | None
    last_error: str | None
    suggested_owner_id: str | None  # guessed from the name: "Ana's calendar" → Ana


class AccountOut(BaseModel):
    id: str
    provider: ProviderName
    label: str
    status: StatusName
    address: str | None  # what's safe to show: a host, or a feed with its secret part hidden
    owner_member_id: str | None
    interval_min: int
    read_only: bool  # the account only shows events (an address, holidays)
    syncing: bool
    last_sync_at: datetime | None
    last_success_at: datetime | None
    next_sync_at: datetime | None
    last_error: str | None
    last_error_at: datetime | None
    helper_email: str | None = None  # Google: the helper's address to share calendars with
    calendars: list[RemoteCalendarOut]


class IcsIn(BaseModel):
    url: Address
    label: Label | None = None
    owner_member_id: str | None = None
    color: PersonColor | None = None
    interval_min: int = Field(default=30, ge=5, le=360)
    allow_private: bool = False  # "This server is on your home network"


class HolidaysIn(BaseModel):
    country: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=2)]
    subdivision: Annotated[str, StringConstraints(strip_whitespace=True, max_length=10)] | None = (
        None
    )
    owner_member_id: str | None = None
    color: PersonColor | None = None


class CaldavIn(BaseModel):
    server_url: Address = "https://caldav.icloud.com"
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    app_password: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
    ]
    label: Label | None = None
    allow_private: bool = False


class HelperIn(BaseModel):
    """Google's helper: the key file's text, uploaded once."""

    key_json: Annotated[str, StringConstraints(min_length=2, max_length=64 * 1024)]
    label: Label | None = None


class GoogleCalendarIn(BaseModel):
    calendar_id: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=3, max_length=300)
    ]


class GoogleStartIn(BaseModel):
    account_id: str | None = None  # signing an account in again


class AuthorizeOut(BaseModel):
    authorize_url: str


class ReconnectIn(BaseModel):
    """A new password (CalDAV) or address (a feed) for an account that needs reconnecting."""

    app_password: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None
    ) = None
    url: Address | None = None


class MappingIn(BaseModel):
    mapped: bool | None = None
    color: PersonColor | None = None
    owner_member_id: str | None = None
    clear_owner: bool = False  # Everyone
    visible_on_display: bool | None = None


class AccountPatch(BaseModel):
    label: Label | None = None
    interval_min: int | None = Field(default=None, ge=5, le=360)
    owner_member_id: str | None = None
    allow_private: bool | None = None
    paused: bool | None = None


class RunOut(BaseModel):
    started_at: datetime
    finished_at: datetime | None
    outcome: str
    fetched: int
    created: int
    updated: int
    deleted: int
    pushed: int
    error: str | None
    duration_ms: int | None


class Place(BaseModel):
    country: str
    subdivisions: list[str]


class FakeEvent(BaseModel):
    """Test server only: an event on a scripted calendar server."""

    calendar: str
    uid: str
    title: str
    start: datetime | None = None  # aware
    end: datetime | None = None
    start_date: str | None = None  # all-day, ISO, end exclusive
    end_date: str | None = None
    tzid: str = "America/New_York"
    rrule: str | None = None


class FakeScript(BaseModel):
    """Test server only: what a scripted server holds and does next."""

    calendars: list[tuple[str, str, bool]] = Field(
        default_factory=list[tuple[str, str, bool]]
    )  # id, name, read_only
    events: list[FakeEvent] = Field(default_factory=list[FakeEvent])
    removed: list[tuple[str, str]] = Field(
        default_factory=list[tuple[str, str]]
    )  # calendar, remote id
    fail_next: list[str] = Field(default_factory=list[str])  # ErrorKind values
