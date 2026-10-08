"""The wall screen's wake and the long polls waiting on it (household/screen.py), kept in memory
like the event hub: one process serves the API (CLAUDE.md rule 5)."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ScreenWatch:
    awake_until: datetime | None = None  # a tap at night keeps the screen on until then
    last_etag: str | None = None  # what the schedule tick saw last
    changed: asyncio.Event = field(default_factory=asyncio.Event)

    def notify(self) -> None:
        """Wake every long poll; later ones wait on a fresh event."""
        self.changed.set()
        self.changed = asyncio.Event()
