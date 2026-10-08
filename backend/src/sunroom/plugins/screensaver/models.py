"""The screensaver plugin's table (PLAN §10.3). The photos themselves are core's (``photos``,
ADR 0009): phones upload into it, and each source here imports into it with its own
``source_key`` (``inbox``, ``source:<id>``).

The inbox source is the folder on the volume (``$DATA_DIR/photos/inbox``): files dropped there
are imported every 5 minutes and the originals moved to ``inbox/imported/``. Immich and Nextcloud
albums are kinds for later; their credentials would be Fernet-encrypted in ``credentials_enc``,
which never leaves in an export.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import UTCDateTime, new_id, utcnow


class SourceKind(StrEnum):
    INBOX = "inbox"
    IMMICH = "immich"
    NEXTCLOUD = "nextcloud"


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


TABLES = ("photo_sources",)
EXPORT_TABLES = TABLES
EXPORT_COLUMN_EXCLUDED = {"photo_sources": frozenset({"credentials_enc"})}
