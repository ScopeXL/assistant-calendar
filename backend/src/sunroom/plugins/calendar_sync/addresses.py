"""Calendar addresses as people paste them, and as Sunroom shows them (UX §2).

A feed's address is a secret (Google's "secret address" is the password to that calendar), so
it's stored encrypted and only ever shown with its secret part hidden:
"calendar.google.com/…/private-3f9a…/basic.ics".
"""

from __future__ import annotations

import hashlib
import re
from urllib.parse import urlsplit, urlunsplit

_PRIVATE = re.compile(r"^(private-)?([0-9a-zA-Z]{4})[0-9a-zA-Z]{4,}$")


def normalize(url: str) -> str:
    """``webcal://`` and ``webcals://`` become ``https://``; a bare host gets ``https://``.
    Whitespace around a pasted address goes; nothing else changes (the guard checks it)."""
    text = url.strip()
    lowered = text.lower()
    if lowered.startswith(("webcal://", "webcals://")):
        text = "https://" + text.split("://", 1)[1]
    elif "://" not in text:
        text = "https://" + text
    return text


def feed_id(url: str) -> str:
    """A stable id for a feed that says nothing about its address."""
    return "feed-" + hashlib.sha256(url.encode()).hexdigest()[:24]


def shown(url: str) -> str:
    """The address with anything secret-looking hidden, for Settings."""
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    segments = [segment for segment in parts.path.split("/") if segment]
    if not segments:
        return host
    last = segments[-1]
    hidden = [_hide(segment) for segment in segments[:-1]]
    secretish = [segment for segment in hidden if segment.endswith("…")]
    middle = "/".join(secretish[-1:]) if secretish else ""
    tail = f"{middle}/{last}" if middle else last
    return f"{host}/…/{tail}" if len(segments) > 1 else f"{host}/{last}"


def _hide(segment: str) -> str:
    found = _PRIVATE.match(segment)
    if found and len(segment) >= 12:
        return f"{found.group(1) or ''}{found.group(2)}…"
    return segment


def host_of(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def without_query(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
