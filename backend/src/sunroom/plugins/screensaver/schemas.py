"""The screensaver API's shapes (PLAN §11.3, UX §4 "Photos room", "Screensaver")."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints

Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class SaverSettings(BaseModel):
    """The plugin's settings as the wall uses them."""

    start_after_minutes: int | None  # None: never by itself (Start screensaver still works)
    every_seconds: int  # a new photo every…
    show_clock: bool  # the clock band and Up next
    shuffle: bool  # False: newest first


class ManifestPhoto(BaseModel):
    id: str
    url: str  # /photos/library/<id>.webp, up to 2560 px
    thumb_url: str
    width: int
    height: int
    taken_at: datetime | None


class ManifestOut(BaseModel):
    """What the screensaver shows: every library photo not hidden or removed, newest first."""

    photos: list[ManifestPhoto]
    settings: SaverSettings


class SourceOut(BaseModel):
    id: str
    kind: Literal["inbox", "immich", "nextcloud"]
    label: str
    enabled: bool
    last_scan_at: datetime | None
    last_error: str | None  # plain English
    items_seen: int  # files or items it has brought in, ever
    photo_count: int  # its photos the screensaver shows now


class SourcePatch(BaseModel):
    label: Label | None = None
    enabled: bool | None = None


class ScanOut(BaseModel):
    source: SourceOut
    imported: int  # new photos
    unreadable: int  # files that weren't photos it could read (moved aside)
