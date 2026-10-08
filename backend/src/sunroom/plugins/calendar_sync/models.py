"""The calendar_sync plugin's tables (PLAN §10.2).

An account is one connection: a calendar address, an iCloud or other CalDAV login, a Google
helper or sign-in, or the offline holidays. Its calendars are listed in ``remote_calendars``;
mapping one makes a synced ``calendars`` row (through the core facade) that the account fills.
Secrets (passwords, keys, tokens, and a feed's address, which is a secret too) live only in
``credentials_enc``, Fernet-encrypted under the plugin key, and never leave in an export.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import UTCDateTime, new_id, utcnow


class Provider(StrEnum):
    ICS = "ics"
    CALDAV = "caldav"
    GOOGLE = "google"
    HOLIDAYS = "holidays"
    FAKE = "fake"  # test mode only


class AuthMode(StrEnum):
    NONE = "none"
    APP_PASSWORD = "app_password"  # noqa: S105 (a kind of login, not a password)
    SERVICE_ACCOUNT = "service_account"
    OAUTH = "oauth"


class AccountStatus(StrEnum):
    CONNECTED = "connected"
    NEEDS_RECONNECT = "needs_reconnect"
    ERROR = "error"
    PAUSED = "paused"


class SyncAccount(Base):
    __tablename__ = "sync_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider: Mapped[str] = mapped_column(String(16))
    auth_mode: Mapped[str] = mapped_column(String(16), default=AuthMode.NONE)
    label: Mapped[str] = mapped_column(String(120))  # "iCloud · ana@…", "Holidays · US"
    status: Mapped[str] = mapped_column(String(16), default=AccountStatus.CONNECTED)
    # What it's safe to show: the server's host, a feed's address with its secret part hidden.
    server_url: Mapped[str | None] = mapped_column(String(500), default=None)
    username: Mapped[str | None] = mapped_column(String(200), default=None)
    credentials_enc: Mapped[str | None] = mapped_column(Text, default=None)
    # Non-secret provider settings: the holidays' country, the Google helper's address, …
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    allow_private: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    interval_s: Mapped[int] = mapped_column(Integer, default=300)
    last_sync_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    last_success_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    next_sync_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    last_error: Mapped[str | None] = mapped_column(String(300), default=None)  # plain English
    last_error_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by_member_id: Mapped[str | None] = mapped_column(ForeignKey("members.id"), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class RemoteCalendarRow(Base):
    __tablename__ = "remote_calendars"
    __table_args__ = (UniqueConstraint("account_id", "remote_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    account_id: Mapped[str] = mapped_column(ForeignKey("sync_accounts.id"), index=True)
    remote_id: Mapped[str] = mapped_column(String(500))
    name: Mapped[str] = mapped_column(String(200))
    color_hint: Mapped[str | None] = mapped_column(String(9), default=None)
    read_only: Mapped[bool] = mapped_column(Boolean, default=False)
    mapped: Mapped[bool] = mapped_column(Boolean, default=False)
    calendar_id: Mapped[str | None] = mapped_column(ForeignKey("calendars.id"), default=None)
    sync_token: Mapped[str | None] = mapped_column(Text, default=None)  # the provider's cursor
    ctag: Mapped[str | None] = mapped_column(String(200), default=None)
    last_synced_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    last_error: Mapped[str | None] = mapped_column(String(300), default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class SyncRun(Base):
    """The last runs of each account (50 at most, 7 days), for Settings and diagnostics."""

    __tablename__ = "sync_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    account_id: Mapped[str] = mapped_column(ForeignKey("sync_accounts.id"), index=True)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime())
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    outcome: Mapped[str] = mapped_column(String(16), default="running")  # ok/error/auth/partial
    fetched: Mapped[int] = mapped_column(Integer, default=0)
    created: Mapped[int] = mapped_column(Integer, default=0)
    updated: Mapped[int] = mapped_column(Integer, default=0)
    deleted: Mapped[int] = mapped_column(Integer, default=0)
    pushed: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(String(300), default=None)
    duration_ms: Mapped[int | None] = mapped_column(Integer, default=None)


class OAuthState(Base):
    """A Google sign-in in flight: single use, 10 minutes."""

    __tablename__ = "oauth_states"

    state_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider: Mapped[str] = mapped_column(String(16))
    code_verifier: Mapped[str] = mapped_column(String(128))
    device_id: Mapped[str | None] = mapped_column(String(36), default=None)
    account_id: Mapped[str | None] = mapped_column(String(36), default=None)  # a reconnect
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


TABLES = ("sync_accounts", "remote_calendars", "sync_runs", "oauth_states")
EXPORT_TABLES = ("sync_accounts", "remote_calendars")
