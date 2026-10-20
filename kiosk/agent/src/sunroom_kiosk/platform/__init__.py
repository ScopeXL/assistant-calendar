"""The machine the agent runs on: ``detect()`` picks its adapter (platform/base.py)."""

from __future__ import annotations

from sunroom_kiosk.platform.base import Platform
from sunroom_kiosk.platform.fake import FakeKind, FakePlatform


def detect(fake: FakeKind | None = None) -> Platform:
    """The adapter for this machine, or the pretend one with ``--fake``."""
    if fake is not None:
        return FakePlatform(fake)
    return Platform()
