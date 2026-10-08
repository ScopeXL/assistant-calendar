"""The opt-in daily check for a newer Sunroom (PLAN §13.6).

Off unless a parent turns on Settings → About → "Check for new versions daily", and pinned off by
``SUNROOM_UPDATE_CHECK=0``: one request a day to GitHub's releases API tells GitHub the server's
address, so nothing goes out until someone asks for it. The answer lives in memory (one process
serves the API); after a restart the next hourly tick asks again. How to update is worded by
``SUNROOM_INSTALL_KIND``: the Pi's script, Compose, Portainer.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import cast

from sunroom.core.config import InstallKind
from sunroom.core.http import GuardedHttp, OutboundError

RELEASES_URL = "https://api.github.com/repos/ScopeXL/assistant-calendar/releases/latest"
CHECK_EVERY = timedelta(hours=24)
TICK_S = 3600
_VERSION = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)$")

HOW: dict[InstallKind, str] = {
    InstallKind.PI: "On the Pi, run sudo /opt/sunroom/update.sh",
    InstallKind.DOCKER: (
        "In Sunroom's folder on the server, run docker compose pull, then docker compose up -d"
    ),
    InstallKind.PORTAINER: "In Portainer, pull Sunroom's newest image and redeploy its stack",
    InstallKind.HA: "Update it in Home Assistant, under Settings, then Add-ons",
}


@dataclass
class UpdateCheck:
    latest: str | None = None  # "0.6.1", from the newest release
    checked_at: datetime | None = None
    problem: str | None = None  # plain English, when the last check didn't get an answer

    def due(self, now: datetime) -> bool:
        return self.checked_at is None or now - self.checked_at >= CHECK_EVERY


def parse(version: str) -> tuple[int, int, int] | None:
    found = _VERSION.match(version.strip())
    if found is None:
        return None
    major, minor, patch = (int(part) for part in found.groups())
    return major, minor, patch


def made_up(current: str) -> str | None:
    """The test server's answer instead of GitHub's: the next minor version, so Settings → About
    shows a new version without anything leaving the machine."""
    found = parse(current)
    if found is None:
        return None
    major, minor, _ = found
    return f"{major}.{minor + 1}.0"


def newer(candidate: str | None, current: str) -> bool:
    """Whether ``candidate`` is a later release than the running ``current``."""
    if candidate is None:
        return False
    theirs, ours = parse(candidate), parse(current)
    return theirs is not None and ours is not None and theirs > ours


async def check(http: GuardedHttp, current: str, now: datetime, into: UpdateCheck) -> None:
    """Ask GitHub for the newest release; never raises (a quiet line in About says why)."""
    into.checked_at = now
    try:
        answer = await http.get(
            RELEASES_URL,
            headers={
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": f"Sunroom/{current}",
            },
            max_bytes=256 * 1024,
        )
    except OutboundError:
        into.problem = "GitHub didn't answer. Sunroom will try again tomorrow."
        return
    tag = _tag_of(answer.content) if answer.ok else None
    if tag is None or parse(tag) is None:
        into.problem = "GitHub's answer wasn't one Sunroom could read. It will try again tomorrow."
        return
    into.latest = tag.lstrip("v")
    into.problem = None


def _tag_of(content: bytes) -> str | None:
    """The release's tag from GitHub's answer ({"tag_name": "v0.6.1", …}), if it has one."""
    try:
        body: object = json.loads(content)
    except ValueError:
        return None
    if not isinstance(body, dict):
        return None
    tag: object = cast("dict[str, object]", body).get("tag_name")
    return tag if isinstance(tag, str) else None
