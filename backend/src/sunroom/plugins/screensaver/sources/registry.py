"""The kinds of photo library Sunroom knows (ADR 0036), keyed by ``kind``. Immich is the first; a
new kind is a ``Library`` added here, and the screens offer it by itself (``GET library-kinds``).

On the test server, an Immich at ``http://immich.test`` is the pretend one (``fake.py``), so the
screens and the end-to-end tests walk the real path with nothing on the network.
"""

from __future__ import annotations

from urllib.parse import urlsplit

from sunroom.plugins.screensaver.sources.base import Library, LibraryKind
from sunroom.plugins.screensaver.sources.fake import FAKE_HOST, FakeLibrary
from sunroom.plugins.screensaver.sources.immich import ImmichLibrary

LIBRARIES: dict[str, Library] = {"immich": ImmichLibrary()}
_FAKE = FakeLibrary()


def kinds() -> list[LibraryKind]:
    return [library.kind for library in LIBRARIES.values()]


def library_for(kind: str, url: str, *, test_mode: bool) -> Library | None:
    """The library for a kind and an address; None for a kind Sunroom doesn't know."""
    if test_mode and kind == "immich" and (urlsplit(url).hostname or "") == FAKE_HOST:
        return _FAKE
    return LIBRARIES.get(kind)
