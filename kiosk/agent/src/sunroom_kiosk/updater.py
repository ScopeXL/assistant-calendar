"""Updates of Sunroom Screen itself (docs/M7.md T9).

This file holds what the API needs from an updater (``UpdaterLike``) and the two simple ones:
``FakeUpdater`` for ``--fake`` (a newer version is always one tap away), and ``NoUpdates``
(nothing to update from, for a screen run straight from a checkout). T9 adds the real one.
"""

from __future__ import annotations

import asyncio
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Literal, Protocol

from sunroom_kiosk.version import version

if TYPE_CHECKING:
    from sunroom_kiosk.state import Agent

type UpdateState = Literal["unknown", "up_to_date", "available", "installing", "failed"]


@dataclass(frozen=True)
class UpdateStatus:
    state: UpdateState
    installed: str
    latest: str | None = None
    checked_at: str | None = None
    message: str | None = None

    def out(self, check: str) -> dict[str, Any]:
        """As the API's ScreenUpdateOut."""
        return {"check": check, **asdict(self)}


class UpdaterLike(Protocol):
    def status(self, check: str) -> dict[str, Any]: ...
    async def check_now(self) -> UpdateStatus: ...
    async def install(self, agent: Agent) -> None: ...
    async def run(self, agent: Agent) -> None: ...


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class NoUpdates:
    """A screen with nothing to update from: it says which version it runs, and that's all."""

    def __init__(self) -> None:
        self.current = UpdateStatus(state="unknown", installed=version())

    def status(self, check: str) -> dict[str, Any]:
        return self.current.out(check)

    async def check_now(self) -> UpdateStatus:
        return self.current

    async def install(self, agent: Agent) -> None:
        agent.toast("There's nothing to update from here.")

    async def run(self, agent: Agent) -> None:
        await asyncio.Event().wait()


class FakeUpdater:
    """``--fake``: a newer version is out; installing it takes a few seconds of progress and
    then this screen says it runs it."""

    def __init__(self, latest: str = "9.9.9", step_s: float = 0.4) -> None:
        self.latest = latest
        self.step_s = step_s
        self.current = UpdateStatus(state="unknown", installed=version())

    def reset(self) -> None:
        self.current = UpdateStatus(state="unknown", installed=version())

    def status(self, check: str) -> dict[str, Any]:
        return self.current.out(check)

    async def check_now(self) -> UpdateStatus:
        state: UpdateState = "available" if self.current.installed != self.latest else "up_to_date"
        self.current = replace(self.current, state=state, latest=self.latest, checked_at=now_iso())
        return self.current

    async def install(self, agent: Agent) -> None:
        self.current = replace(self.current, state="installing")
        agent.publish_state()
        steps = ((10, "Downloading…"), (45, "Checking it…"), (80, "Installing…"), (100, "Done"))
        for percent, step in steps:
            await asyncio.sleep(self.step_s)
            agent.hub.publish("update.progress", {"percent": percent, "step": step})
        self.current = UpdateStatus(
            state="up_to_date", installed=self.latest, latest=self.latest, checked_at=now_iso()
        )
        agent.publish_state()

    async def run(self, agent: Agent) -> None:
        await asyncio.Event().wait()
