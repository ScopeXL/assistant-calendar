"""The machine the agent runs on: ``detect()`` picks its adapter (platform/base.py)."""

from __future__ import annotations

import sys
from pathlib import Path

from sunroom_kiosk.platform.base import Platform
from sunroom_kiosk.platform.fake import FakeKind, FakePlatform
from sunroom_kiosk.version import version


def detect(fake: FakeKind | None = None, root: Path = Path("/")) -> Platform:
    """The adapter for this machine, or the pretend one with ``--fake``."""
    if fake is not None:
        return FakePlatform(fake)
    if sys.platform.startswith("linux"):
        from sunroom_kiosk.platform.linux import LinuxPlatform
        from sunroom_kiosk.platform.pi import PiPlatform, is_pi

        return PiPlatform(root=root, version=version()) if is_pi(root) else LinuxPlatform(root=root)
    # macOS and Windows get their own adapters in batch 2 (docs/M7.md T14, T15).
    return Platform(root=root)
