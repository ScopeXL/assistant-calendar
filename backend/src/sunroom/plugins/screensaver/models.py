"""The screensaver plugin's tables (PLAN §10.3). The photos themselves are core's (``photos``,
ADR 0009): phones upload into it, and each source here imports into it with its own
``source_key`` (``inbox``, ``source:<id>``).

The inbox source is the folder on the volume (``$DATA_DIR/photos/inbox``): files dropped there
are imported every 5 minutes and the originals moved to ``inbox/imported/``. A **photo library**
(ADR 0036; Immich first) is a server the family connects with an address and a key: its key is
Fernet-encrypted in ``credentials_enc``, which never leaves in an export; its address, picks and
limit are in ``config_json``; the people, albums and tags it offers are cached in
``options_json``. ``photo_source_items`` maps the library's photos to core's copies of them: a
cache the next pass rebuilds, so it isn't exported.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import UTCDateTime, new_id, utcnow


class SourceKind(StrEnum):
    INBOX = "inbox"
    IMMICH = "immich"
    NEXTCLOUD = "nextcloud"


class SourceStatus(StrEnum):
    """A library's state (the inbox is always connected)."""

    CONNECTED = "connected"
    NEEDS_RECONNECT = "needs_reconnect"  # its key was refused, or a new secret key wiped it
    ERROR = "error"  # it stopped answering: its photos stay


class PhotoSource(Base):
    __tablename__ = "photo_sources"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    kind: Mapped[str] = mapped_column(String(12))
    label: Mapped[str] = mapped_column(String(80))
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    credentials_enc: Mapped[str | None] = mapped_column(Text, default=None)
    allow_private: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_scan_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    last_error: Mapped[str | None] = mapped_column(String(300), default=None)  # plain English
    items_seen: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    status: Mapped[str] = mapped_column(
        String(20), default=SourceStatus.CONNECTED.value, server_default="connected"
    )
    # A library's people, albums and tags to pick from, and when they were fetched.
    options_json: Mapped[str] = mapped_column(Text, default="{}", server_default="{}")
    options_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class PhotoSourceItem(Base):
    """One of a library's photos the picks want, and core's copy of it (``photo_id``, no foreign
    key: core removes photos for good after 7 days, and the next pass fetches it again)."""

    __tablename__ = "photo_source_items"
    __table_args__ = (UniqueConstraint("source_id", "remote_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    source_id: Mapped[str] = mapped_column(ForeignKey("photo_sources.id"), index=True)
    remote_id: Mapped[str] = mapped_column(String(100))  # the library's own id for it
    photo_id: Mapped[str | None] = mapped_column(String(36), default=None)
    taken_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    seen_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)  # last listed
    fetched_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    # No longer picked (its photo removed), or given up on after FETCH_TRIES failed fetches.
    dropped_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    fetch_failures: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


TABLES = ("photo_sources", "photo_source_items")
# The mapping is a cache the next pass rebuilds: only the sources are exported.
EXPORT_TABLES = ("photo_sources",)
EXPORT_COLUMN_EXCLUDED = {"photo_sources": frozenset({"credentials_enc"})}
