"""The screensaver API's shapes (PLAN §11.3, UX §4 "Photos room", "Screensaver", "Photo
Libraries"). A library's shapes are all named ``Library…``: OpenAPI keeps one namespace."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Label = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
Address = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
ApiKey = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
RemoteId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9-]{1,100}$")]
Limit = Literal[100, 250, 500, 1000, 2000]
LibraryStatusName = Literal["connected", "needs_reconnect", "error"]


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


# ---- photo libraries (ADR 0036) -------------------------------------------------------------


class LibraryKindOut(BaseModel):
    """A kind of library the screens offer, with what its fields say."""

    kind: str  # "immich"
    name: str  # "Immich"
    placeholder: str  # an address like the family's own
    address_hint: str
    key_help: str


class LibraryIn(BaseModel):
    kind: str
    url: Address  # "http://192.168.1.30:2283"; a trailing / or /api is dropped
    api_key: ApiKey
    allow_private: bool = False  # "This server is on your home network"
    label: Label | None = None  # what the family calls it; the kind's name by default


class LibraryPicks(BaseModel):
    """What to show, by the library's ids: any pick matches, none means every photo."""

    people: list[RemoteId] = Field(default_factory=list[str], max_length=200)
    albums: list[RemoteId] = Field(default_factory=list[str], max_length=200)
    tags: list[RemoteId] = Field(default_factory=list[str], max_length=200)


class LibraryPatch(BaseModel):
    """Only what's sent changes; a change of picks, limit or switch starts a pass."""

    picks: LibraryPicks | None = None
    limit: Limit | None = None  # Keep up to
    enabled: bool | None = None  # Show on the screensaver
    label: Label | None = None


class LibraryReconnectIn(BaseModel):
    api_key: ApiKey
    url: Address | None = None  # Change Address


class LibraryChoiceOut(BaseModel):
    id: str
    name: str
    count: int | None  # photos in it, when the library says
    has_thumb: bool  # GET …/thumb has a face (or a cover) for it


class LibraryChoicesOut(BaseModel):
    people: list[LibraryChoiceOut]
    albums: list[LibraryChoiceOut]
    tags: list[LibraryChoiceOut]
    unnamed_people: int  # faces nobody named in the library: not offered
    fetched_at: datetime | None  # "Choices from 9:10 AM"


class LibraryOut(BaseModel):
    id: str
    kind: str
    name: str  # what the family calls it ("Immich")
    url: str
    status: LibraryStatusName
    enabled: bool  # Show on the screensaver
    allow_private: bool
    picks: LibraryPicks
    limit: int  # Keep up to
    photo_count: int  # its photos the screensaver may show now
    pending: int  # picked photos not brought in yet
    checking: bool  # a pass is running
    last_scan_at: datetime | None  # the last pass that listed its photos
    last_error: str | None  # plain English
    options_at: datetime | None  # when its people, albums and tags were fetched
    version: str | None  # the server's version at the last check ("2.7.5")
    library_photos: int | None  # how many photos the server holds, when it says
