"""The core photo store's index (PLAN §10.1, ADR 0009): the pictures themselves are WebP files
under $DATA_DIR/photos; this table says what they are."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import UTCDateTime, new_id, utcnow


class PhotoKind(StrEnum):
    LIBRARY = "library"  # the household's pictures (the screensaver)
    AVATAR = "avatar"  # a person's picture


class Photo(Base):
    __tablename__ = "photos"
    __table_args__ = (UniqueConstraint("kind", "sha256", name="uq_photos_kind_sha256"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    kind: Mapped[str] = mapped_column(String(8))
    source_key: Mapped[str] = mapped_column(
        String(64), default="upload"
    )  # upload, inbox, source:<id>
    original_name: Mapped[str | None] = mapped_column(String(255), default=None)
    taken_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(
        String(64)
    )  # of the original upload: duplicates are one photo
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
