"""The running version (Dinner Bell's ADR 0019, kept by Sunroom).

In the image, /app/build-info.json is written at build time. Run as a program (ADR 0038), the
version is the installed package's own, which the release stamps into the wheel (the repo's
pyproject stays 0.0.0). In development, the version is read from the repo's VERSION file and the
revision is "dev".
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import cache
from importlib import metadata
from pathlib import Path

BUILD_INFO_PATH = Path(os.environ.get("SUNROOM_BUILD_INFO", "/app/build-info.json"))


@dataclass(frozen=True, slots=True)
class BuildInfo:
    version: str
    revision: str
    created: str | None


@cache
def build_info() -> BuildInfo:
    if BUILD_INFO_PATH.is_file():
        data = json.loads(BUILD_INFO_PATH.read_text(encoding="utf-8"))
        return BuildInfo(
            version=str(data["version"]),
            revision=str(data.get("revision", "unknown")),
            created=data.get("created"),
        )
    packaged = _package_version()
    if packaged is not None:
        return BuildInfo(version=packaged, revision="release", created=None)
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "VERSION"
        if candidate.is_file():
            return BuildInfo(
                version=candidate.read_text(encoding="utf-8").strip(), revision="dev", created=None
            )
    return BuildInfo(version="0.0.0", revision="dev", created=None)


def _package_version() -> str | None:
    """The installed package's version when a release stamped one; None in a checkout (0.0.0)."""
    try:
        found = metadata.version("sunroom")
    except metadata.PackageNotFoundError:
        return None
    return None if found == "0.0.0" else found
