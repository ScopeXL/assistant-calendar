"""Updates of Sunroom Screen itself (docs/M7.md T9).

* **Check:** GitHub's list of the repository's tags (as Sunroom's own check, ADR 0032) gives the
  newest version; that version's Release gives ``SHA256SUMS``, which must list its wheel. An
  update is "available" only then. One request to api.github.com and one to github.com: they see
  this screen's public address (the setup page says so).
* **Install:** the wheel is downloaded, its sha256 checked against ``SHA256SUMS`` (a mismatch
  stops everything), and kept beside the one running, under ``~/.local/share/sunroom-kiosk/
  wheels``. Then a separate process (``sunroom-kiosk update --apply``, under ``systemd-run`` on
  Linux so it outlives the agent) installs it with ``uv tool install --reinstall``, restarts the
  agent's service, and waits 60 s for the new version to answer on 127.0.0.1; if it doesn't, it
  puts the previous wheel back, restarts again, and leaves a note the agent shows ("The update
  didn't start; the previous version is back.").
* **Nightly:** at the start of the household's sleep hours (from Sunroom's
  ``/api/display/state``; 03:30 without them) the check runs, and with Updates on Install
  overnight an update installs. On Sunroom OS the system's own security updates come from
  ``unattended-upgrades``, and when one needs a restart (``/run/reboot-required``) the screen
  restarts then, inside the sleep hours.

``NoUpdates`` (nothing to update from: a checkout) and ``FakeUpdater`` (``--fake``) stand in.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from collections.abc import Awaitable, Callable
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, Protocol, cast

import httpx

from sunroom_kiosk import logs
from sunroom_kiosk.version import version

if TYPE_CHECKING:
    from sunroom_kiosk.state import Agent

log = logs.get("updater")

REPO = "ScopeXL/assistant-calendar"
TAGS_URL = f"https://api.github.com/repos/{REPO}/tags?per_page=100"
DOWNLOAD = f"https://github.com/{REPO}/releases/download"
SERVICE = "sunroom-kiosk.service"
APPLY_UNIT = "sunroom-kiosk-update"
STARTS_WITHIN_S = 60.0
NIGHTLY_DEFAULT = (3, 30)
REBOOT_REQUIRED = Path("/run/reboot-required")
_VERSION = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)$")

type UpdateState = Literal["unknown", "up_to_date", "available", "installing", "failed"]

DIDNT_START = "The update didn't start; the previous version is back."


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


def parse(text: str) -> tuple[int, int, int] | None:
    found = _VERSION.match(text.strip())
    if found is None:
        return None
    major, minor, patch = (int(part) for part in found.groups())
    return major, minor, patch


def newest(tags: object) -> str | None:
    """The highest X.Y.Z among GitHub's tags (pre-releases and other names left out)."""
    if not isinstance(tags, list):
        return None
    found: list[tuple[tuple[int, int, int], str]] = []
    for tag in cast(list[Any], tags):
        name = cast(dict[str, Any], tag).get("name") if isinstance(tag, dict) else None
        parsed = parse(name) if isinstance(name, str) else None
        if parsed is not None:
            found.append((parsed, ".".join(map(str, parsed))))
    return max(found)[1] if found else None


def newer(candidate: str | None, current: str) -> bool:
    theirs, ours = parse(candidate or ""), parse(current)
    return theirs is not None and ours is not None and theirs > ours


def wheel_name(release: str) -> str:
    return f"sunroom_kiosk-{release}-py3-none-any.whl"


def sums_from(text: str) -> dict[str, str]:
    """``sha256sum``'s lines: hash, two spaces (or a space and a star), file name."""
    sums: dict[str, str] = {}
    for line in text.splitlines():
        found = re.match(r"^([0-9a-fA-F]{64})\s+\*?(\S+)$", line.strip())
        if found:
            sums[found.group(2)] = found.group(1).lower()
    return sums


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class Paths:
    wheels: Path  # the running wheel and the one before it
    state: Path  # what the last check said, and a failed update's note

    @classmethod
    def default(cls) -> Paths:
        if sys.platform == "win32":
            base = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "sunroom-kiosk"
            return cls(wheels=base / "wheels", state=base / "update.json")
        home = Path.home()
        return cls(
            wheels=home / ".local" / "share" / "sunroom-kiosk" / "wheels",
            state=home / ".local" / "state" / "sunroom-kiosk" / "update.json",
        )


def next_nightly(now: datetime, sleep_from: str | None) -> datetime:
    """The next start of the sleep hours (HH:MM), or 03:30, after ``now`` (local time)."""
    hour, minute = NIGHTLY_DEFAULT
    found = re.match(r"^(\d{1,2}):(\d{2})$", sleep_from or "")
    if found and int(found.group(1)) < 24 and int(found.group(2)) < 60:
        hour, minute = int(found.group(1)), int(found.group(2))
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return target


type Spawn = Callable[[list[str]], Awaitable[bool]]


async def spawn_apply(argv: list[str]) -> bool:
    """Start the apply step so it outlives this process: in its own systemd unit where there is
    one (the agent's own unit's restart would take a child down with it), else detached."""
    if sys.platform.startswith("linux") and shutil.which("systemd-run"):
        unit = [
            "systemd-run",
            "--user",
            "--collect",
            f"--unit={APPLY_UNIT}-{int(time.time())}",
            "--",
        ]
        process = await asyncio.create_subprocess_exec(
            *unit,
            *argv,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        return await process.wait() == 0
    flags = getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(
        subprocess, "CREATE_NEW_PROCESS_GROUP", 0
    )
    subprocess.Popen(  # noqa: S603, ASYNC220 - our own command, fire and forget
        argv,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=sys.platform != "win32",
        creationflags=flags,
    )
    return True


class Updater:
    def __init__(
        self,
        *,
        http: Callable[[], httpx.AsyncClient] | None = None,
        paths: Paths | None = None,
        current: str | None = None,
        spawn: Spawn = spawn_apply,
        port: int = 7800,
    ) -> None:
        self.http = http or (
            lambda: httpx.AsyncClient(
                timeout=httpx.Timeout(60.0, connect=10.0),
                headers={"User-Agent": f"sunroom-kiosk/{version()}"},
                follow_redirects=True,
            )
        )
        self.paths = paths or Paths.default()
        self.installed = current or version()
        self.spawn = spawn
        self.port = port
        self.current = self._remembered()
        self._busy = asyncio.Lock()

    # ------------------------------------------------------------------ what it knows

    def _remembered(self) -> UpdateStatus:
        """The last check's answer, and a failed update's note, from before a restart."""
        fresh = UpdateStatus(state="unknown", installed=self.installed)
        try:
            saved = json.loads(self.paths.state.read_text(encoding="utf-8"))
        except OSError, ValueError:
            return fresh
        if not isinstance(saved, dict):
            return fresh
        fields = cast(dict[str, Any], saved)
        latest = fields.get("latest") if isinstance(fields.get("latest"), str) else None
        failed = fields.get("failed")
        state: UpdateState = "available" if newer(latest, self.installed) else "up_to_date"
        if latest is None:
            state = "unknown"
        message = None
        if isinstance(failed, str) and failed == latest and newer(latest, self.installed):
            state, message = "failed", DIDNT_START
        checked = fields.get("checked_at")
        return replace(
            fresh,
            state=state,
            latest=latest,
            checked_at=checked if isinstance(checked, str) else None,
            message=message,
        )

    def _remember(self, **values: Any) -> None:
        try:
            saved = json.loads(self.paths.state.read_text(encoding="utf-8"))
            if not isinstance(saved, dict):
                saved = {}
        except OSError, ValueError:
            saved = {}
        merged = {**cast(dict[str, Any], saved), **values}
        self.paths.state.parent.mkdir(parents=True, exist_ok=True)
        self.paths.state.write_text(json.dumps(merged, sort_keys=True), encoding="utf-8")

    def status(self, check: str) -> dict[str, Any]:
        return self.current.out(check)

    # ------------------------------------------------------------------ check

    async def _latest(self, client: httpx.AsyncClient) -> str | None:
        response = await client.get(TAGS_URL, headers={"Accept": "application/vnd.github+json"})
        response.raise_for_status()
        return newest(response.json())

    async def _sums(self, client: httpx.AsyncClient, release: str) -> dict[str, str]:
        response = await client.get(f"{DOWNLOAD}/v{release}/SHA256SUMS")
        if response.status_code == 404:
            return {}
        response.raise_for_status()
        return sums_from(response.text)

    async def check_now(self) -> UpdateStatus:
        try:
            async with self.http() as client:
                latest = await self._latest(client)
                ready = latest is not None and newer(latest, self.installed)
                if ready and latest is not None:
                    # Released but its files not up yet: not an update until they are.
                    ready = wheel_name(latest) in await self._sums(client, latest)
        except (httpx.HTTPError, ValueError) as error:
            log.info("Couldn't ask GitHub for the newest version: %s.", type(error).__name__)
            self.current = replace(
                self.current,
                checked_at=now_iso(),
                message="GitHub didn't answer. This screen asks again tomorrow.",
            )
            return self.current
        state: UpdateState = "available" if ready else "up_to_date"
        if self.current.state == "failed" and self.current.latest == latest:
            state = "failed"
        self.current = UpdateStatus(
            state=state,
            installed=self.installed,
            latest=latest,
            checked_at=now_iso(),
            message=DIDNT_START if state == "failed" else None,
        )
        self._remember(latest=latest, checked_at=self.current.checked_at)
        return self.current

    # ------------------------------------------------------------------ install

    async def install(self, agent: Agent) -> None:
        if self._busy.locked():
            return
        async with self._busy:
            await self._install(agent)

    async def _install(self, agent: Agent) -> None:
        async def say(percent: int, step: str) -> None:
            agent.hub.publish("update.progress", {"percent": percent, "step": step})

        if self.current.state not in ("available", "failed") or self.current.latest is None:
            await self.check_now()
        release = self.current.latest
        if release is None or not newer(release, self.installed):
            agent.toast("This screen is up to date.")
            agent.publish_state()
            return
        self.current = replace(self.current, state="installing", message=None)
        agent.publish_state()
        await say(10, "Downloading…")
        try:
            wheel = await self.download(release)
        except UpdateError as error:
            log.info("The update to %s stopped: %s", release, error)
            self.current = replace(self.current, state="available", message=str(error))
            agent.publish_state()
            await say(100, "Stopped")
            return
        await say(60, "Installing…")
        previous = self.paths.wheels / wheel_name(self.installed)
        argv = [
            sys.executable,
            "-m",
            "sunroom_kiosk",
            "update",
            "--apply",
            str(wheel),
            "--port",
            str(self.port),
        ]
        if await asyncio.to_thread(previous.exists):
            argv += ["--previous", str(previous)]
        log.info("Installing Sunroom Screen %s; it starts again in a moment.", release)
        if not await self.spawn(argv):
            self.current = replace(
                self.current, state="available", message="The update couldn't start. Try again."
            )
            agent.publish_state()
            await say(100, "Stopped")

    async def download(self, release: str) -> Path:
        """The release's wheel, checked against its SHA256SUMS; kept beside the running one."""
        name = wheel_name(release)
        try:
            async with self.http() as client:
                expected = (await self._sums(client, release)).get(name)
                if expected is None:
                    raise UpdateError("This version's files aren't published yet. Try again later.")
                response = await client.get(f"{DOWNLOAD}/v{release}/{name}")
                response.raise_for_status()
                data = response.content
        except httpx.HTTPError as error:
            raise UpdateError("The download didn't finish. Try again in a while.") from error
        if hashlib.sha256(data).hexdigest() != expected:
            raise UpdateError("The download didn't match its checksum, so it wasn't installed.")
        return await asyncio.to_thread(self._keep, name, data)

    def _keep(self, name: str, data: bytes) -> Path:
        self.paths.wheels.mkdir(parents=True, exist_ok=True)
        path = self.paths.wheels / name
        partial = path.with_suffix(".partial")
        partial.write_bytes(data)
        os.replace(partial, path)
        return path

    # ------------------------------------------------------------------ nightly

    async def run(self, agent: Agent) -> None:
        while True:
            now = datetime.now().astimezone()
            when = next_nightly(now, await self._sleep_from(agent))
            await asyncio.sleep(max(60.0, (when - now).total_seconds()))
            await self.nightly(agent)

    async def _sleep_from(self, agent: Agent) -> str | None:
        """When the household's sleep hours start, from Sunroom (None: no schedule known)."""
        url = agent.config.url
        if not url:
            return None
        try:
            async with agent.http() as client:
                answer = (await client.get(f"{url}/api/display/state")).json()
        except httpx.HTTPError, ValueError:
            return None
        if not isinstance(answer, dict):
            return None
        schedule = cast(dict[str, Any], answer).get("schedule")
        if not isinstance(schedule, dict):
            return None
        sleep_from = cast(dict[str, Any], schedule).get("sleep_from")
        return sleep_from if isinstance(sleep_from, str) else None

    async def nightly(self, agent: Agent) -> None:
        await self.check_now()
        agent.publish_state()
        if agent.update_check() == "nightly" and self.current.state == "available":
            await self.install(agent)
            return
        # Sunroom OS's own security updates, from unattended-upgrades: restart if one asks to.
        if agent.platform.sunroom_os and await asyncio.to_thread(REBOOT_REQUIRED.exists):
            log.info("A system update asks for a restart; restarting in the sleep hours.")
            await agent.platform.restart()


class UpdateError(Exception):
    """Why an update stopped, in plain words."""


# ---------------------------------------------------------------------- the apply step


def _uv() -> str:
    found = shutil.which("uv")
    if found:
        return found
    local = Path.home() / ".local" / "bin" / ("uv.exe" if sys.platform == "win32" else "uv")
    return str(local)


def _run(argv: list[str]) -> bool:
    done = subprocess.run(argv, capture_output=True, text=True, check=False)  # noqa: S603
    if done.returncode != 0:
        print(f"{' '.join(argv[:3])} didn't work: {(done.stderr or done.stdout).strip()[:300]}")
    return done.returncode == 0


def _restart_service() -> bool:
    if sys.platform.startswith("linux"):
        return _run(["systemctl", "--user", "restart", SERVICE])
    if sys.platform == "darwin":
        return _run(["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/app.sunroom.kiosk"])
    return False  # Windows: batch 2 (T14) starts it again itself


def _answers_as(port: int, release: str, within_s: float) -> bool:
    """Whether the agent on ``port`` answers within ``within_s`` seconds, as ``release``."""
    deadline = time.monotonic() + within_s
    url = f"http://127.0.0.1:{port}/api/screen"
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if json.loads(response.read()).get("version") == release:
                    return True
        except OSError, ValueError:
            pass
        time.sleep(2)
    return False


def apply(
    wheel: Path,
    previous: Path | None,
    port: int,
    *,
    install: Callable[[Path], bool] | None = None,
    restart: Callable[[], bool] = _restart_service,
    answers: Callable[[int, str, float], bool] = _answers_as,
    paths: Paths | None = None,
) -> int:
    """Install ``wheel``, restart, and keep it only if it answers; else put ``previous`` back.
    Standard library only from here on: the package's files are being replaced under it."""
    the_paths = paths or Paths.default()
    release = wheel.name.split("-")[1]

    def uv_install(path: Path) -> bool:
        return _run([_uv(), "tool", "install", "--reinstall", "--python", "3.14", str(path)])

    put = install or uv_install
    if not put(wheel) or not restart() or not answers(port, release, STARTS_WITHIN_S):
        print(f"Sunroom Screen {release} didn't start; putting the previous version back.")
        if previous is not None and previous.exists():
            put(previous)
            restart()
        _note_failure(the_paths, release)
        return 1
    for old in the_paths.wheels.glob("sunroom_kiosk-*.whl"):
        if old not in (wheel, previous):
            old.unlink(missing_ok=True)
    print(f"Sunroom Screen {release} is running.")
    return 0


def _note_failure(paths: Paths, release: str) -> None:
    saved: dict[str, Any] = {}
    try:
        read = json.loads(paths.state.read_text(encoding="utf-8"))
        if isinstance(read, dict):
            saved = cast(dict[str, Any], read)
    except OSError, ValueError:
        pass
    saved = {**saved, "failed": release, "latest": release}
    paths.state.parent.mkdir(parents=True, exist_ok=True)
    paths.state.write_text(json.dumps(saved, sort_keys=True), encoding="utf-8")


# ---------------------------------------------------------------------- stand-ins


class NoUpdates:
    """A screen with nothing to update from (run from a checkout): its version, and that's all."""

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
