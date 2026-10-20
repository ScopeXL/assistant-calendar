"""The agent's version: the package's own, which equals Sunroom's VERSION."""

from __future__ import annotations

from importlib import metadata


def version() -> str:
    try:
        return metadata.version("sunroom-kiosk")
    except metadata.PackageNotFoundError:
        return "0.0.0"
