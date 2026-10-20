"""The wall's browser: find it, start it full screen on the right page, keep it running, and
look at what it shows (docs/M7.md T6; what ``kiosk/sunroom-kiosk`` did in bash until 0.13.0).

* **Which browser.** Chromium, then Google Chrome, then Microsoft Edge on Linux; Chrome,
  Chromium, then Edge on macOS; Edge, then Chrome, on Windows (batch 2).
* **Its profile.** ``~/.config/sunroom-kiosk/profile`` keeps the screen's pairing cookie, so
  never ``--incognito``; and never ``--disable-gpu``, which makes the board crawl. Before each
  start the last exit is marked clean, so a power cut never shows "Restore pages?".
* **Its flags.** The launcher's (PLAN §13.2), plus ``--remote-debugging-port=0``: the port it
  picks is written to ``DevToolsActivePort`` in the profile, and the watchdog asks through it
  whether the page is a Sunroom and whether it still answers.
* **Keeping it running.** Started again 3 s after any exit; restarted once a night at about
  04:00 (03:55 plus up to ten minutes), which gives back the memory Chromium gathers over days.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import random
import shutil
import sys
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, cast

import httpx

from sunroom_kiosk import logs
from sunroom_kiosk.policy import BrowserKind

log = logs.get("browser")

RESTART_AFTER_S = 3.0
STOP_WAIT_S = 10.0
NIGHTLY = (3, 55)
NIGHTLY_SPREAD_S = 600
DEVTOOLS_S = 5.0

# Whether a page is Sunroom's: its title, the nonce meta every page of it carries, and a root
# with something drawn in it. Read through the DevTools protocol; nothing is injected.
PAGE_CHECK = (
    "JSON.stringify({href: location.href, sunroom: document.title === 'Sunroom'"
    " && !!document.querySelector('meta[name=\"csp-nonce\"]')"
    " && !!(document.getElementById('root') || {}).firstElementChild})"
)


@dataclass(frozen=True)
class Browser:
    kind: BrowserKind
    path: str
    name: str  # "Chromium", "Google Chrome", "Microsoft Edge"


LINUX: tuple[tuple[BrowserKind, str, str], ...] = (
    ("chromium", "chromium", "Chromium"),
    ("chromium", "chromium-browser", "Chromium"),
    ("chrome", "google-chrome", "Google Chrome"),
    ("chrome", "google-chrome-stable", "Google Chrome"),
    ("edge", "microsoft-edge", "Microsoft Edge"),
    ("edge", "microsoft-edge-stable", "Microsoft Edge"),
)
MACOS: tuple[tuple[BrowserKind, str, str], ...] = (
    ("chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "Google Chrome"),
    ("chromium", "/Applications/Chromium.app/Contents/MacOS/Chromium", "Chromium"),
    ("edge", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "Microsoft Edge"),
)


def _windows_paths() -> tuple[tuple[BrowserKind, str, str], ...]:
    roots = [
        os.environ.get(name, "")
        for name in ("ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA")
        if os.environ.get(name)
    ]
    found: list[tuple[BrowserKind, str, str]] = []
    for root in roots:
        found.append(
            (
                "edge",
                str(Path(root, "Microsoft", "Edge", "Application", "msedge.exe")),
                "Microsoft Edge",
            )
        )
    for root in roots:
        found.append(
            (
                "chrome",
                str(Path(root, "Google", "Chrome", "Application", "chrome.exe")),
                "Google Chrome",
            )
        )
    return tuple(found)


def find_browser(
    system: str = sys.platform,
    *,
    which: Callable[[str], str | None] = shutil.which,
    exists: Callable[[str], bool] = os.path.exists,
) -> Browser | None:
    if system == "darwin":
        for kind, path, name in MACOS:
            if exists(path):
                return Browser(kind, path, name)
        return None
    if system == "win32":
        for kind, path, name in _windows_paths():
            if exists(path):
                return Browser(kind, path, name)
        return None
    for kind, command, name in LINUX:
        path = which(command)
        if path:
            return Browser(kind, path, name)
    return None


def insecure_origin(url: str) -> str | None:
    """The Sunroom's origin when it is plain http on another machine: Chromium is told to treat
    it as secure, so the service worker and Wake Lock work (PLAN §13.1). ``localhost`` already
    is one, and https needs nothing."""
    if not url.lower().startswith("http://"):
        return None
    hostport = url[len("http://") :].split("/", 1)[0]
    host = hostport.rsplit(":", 1)[0] if not hostport.startswith("[") else hostport
    if host in ("localhost", "127.0.0.1", "[::1]") or host.startswith("[::1]"):
        return None
    return f"http://{hostport}"


def flags(
    browser: Browser,
    *,
    profile: Path,
    session: str,
    sunroom_url: str | None,
    system: str = sys.platform,
) -> list[str]:
    """The browser's command line, before the page to open (PLAN §13.2)."""
    argv = [
        f"--user-data-dir={profile}",
        "--kiosk",
        "--start-maximized",
        "--no-first-run",
        "--noerrdialogs",
        "--disable-infobars",
        "--hide-crash-restore-bubble",
        "--touch-events=enabled",
        "--disable-pinch",
        "--overscroll-history-navigation=0",
        "--enable-features=OverlayScrollbar",
        "--disable-features=Translate,TranslateUI",
        "--disable-component-update",
        "--check-for-update-interval=31536000",
        "--autoplay-policy=no-user-gesture-required",
        "--remote-debugging-port=0",
    ]
    if system.startswith("linux"):
        argv.append("--password-store=basic")
        if session == "wayland":
            argv += [
                "--ozone-platform=wayland",
                "--enable-wayland-ime",
                "--wayland-text-input-version=3",
            ]
    if system == "win32" and browser.kind == "edge":
        argv.append("--edge-kiosk-type=fullscreen")
    origin = insecure_origin(sunroom_url) if sunroom_url else None
    if origin:
        argv.append(f"--unsafely-treat-insecure-origin-as-secure={origin}")
    return argv


def mark_clean_exit(profile: Path) -> None:
    """Chromium shows "Restore pages?" when its last exit wasn't clean, which is every power cut
    and every restart. Rewriting the two flags before a start prevents it."""
    prefs = profile / "Default" / "Preferences"
    try:
        data = json.loads(prefs.read_text(encoding="utf-8"))
    except OSError, ValueError:
        return
    if not isinstance(data, dict):
        return
    fields = cast(dict[str, Any], data)
    section = fields.setdefault("profile", {})
    if not isinstance(section, dict):
        return
    profile_fields = cast(dict[str, Any], section)
    profile_fields["exited_cleanly"] = True
    profile_fields["exit_type"] = "Normal"
    tmp = prefs.with_name("Preferences.sunroom-tmp")
    try:
        tmp.write_text(json.dumps(fields, separators=(",", ":")), encoding="utf-8")
        os.replace(tmp, prefs)
    except OSError as error:
        log.info("Couldn't mark the last browser exit as clean (%s); carrying on.", error)


def next_nightly(now: datetime, spread_s: float) -> datetime:
    """The next 03:55 local time after ``now``, plus ``spread_s`` seconds."""
    target = now.replace(hour=NIGHTLY[0], minute=NIGHTLY[1], second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return target + timedelta(seconds=spread_s)


@dataclass(frozen=True)
class PageLook:
    """What the watchdog saw: whether the browser answered, and whether its page is Sunroom."""

    answered: bool
    href: str | None = None
    sunroom: bool = False


def devtools_port(profile: Path) -> int | None:
    try:
        first = (profile / "DevToolsActivePort").read_text(encoding="ascii").splitlines()[0]
        return int(first)
    except OSError, ValueError, IndexError:
        return None


class DevTools:
    """A few calls of the Chrome DevTools protocol, on the port the browser picked."""

    def __init__(self, profile: Path) -> None:
        self.profile = profile

    async def _page_socket(self) -> str | None:
        port = devtools_port(self.profile)
        if port is None:
            return None
        async with httpx.AsyncClient(timeout=DEVTOOLS_S) as client:
            response = await client.get(f"http://127.0.0.1:{port}/json/list")
        targets = response.json()
        if not isinstance(targets, list):
            return None
        for target in cast(list[Any], targets):
            if isinstance(target, dict):
                fields = cast(dict[str, Any], target)
                url = fields.get("webSocketDebuggerUrl")
                if fields.get("type") == "page" and isinstance(url, str):
                    return url
        return None

    async def _call(self, method: str, params: dict[str, Any]) -> dict[str, Any] | None:
        from websockets.asyncio.client import connect  # here: only on a real screen

        url = await self._page_socket()
        if url is None:
            return None
        async with asyncio.timeout(DEVTOOLS_S), connect(url, max_size=2**20) as socket:
            await socket.send(json.dumps({"id": 1, "method": method, "params": params}))
            while True:
                message = json.loads(await socket.recv())
                if isinstance(message, dict) and cast(dict[str, Any], message).get("id") == 1:
                    return cast(dict[str, Any], message)

    async def look(self) -> PageLook:
        try:
            answer = await self._call(
                "Runtime.evaluate", {"expression": PAGE_CHECK, "returnByValue": True}
            )
        except (OSError, TimeoutError, httpx.HTTPError, ValueError) as error:
            log.debug("The browser didn't answer the watchdog: %r", error)
            return PageLook(answered=False)
        except Exception as error:  # websockets' own errors: the page didn't answer
            log.debug("The browser didn't answer the watchdog: %r", error)
            return PageLook(answered=False)
        if answer is None:
            return PageLook(answered=False)
        try:
            value = cast(dict[str, Any], answer["result"]["result"])["value"]
            seen = json.loads(value)
        except KeyError, TypeError, ValueError:
            return PageLook(answered=False)
        return PageLook(answered=True, href=seen.get("href"), sunroom=bool(seen.get("sunroom")))

    async def navigate(self, url: str) -> bool:
        try:
            return await self._call("Page.navigate", {"url": url}) is not None
        except Exception as error:  # any failure: the caller restarts the browser instead
            log.debug("Couldn't navigate through DevTools: %r", error)
            return False


class Supervisor:
    """Keeps the browser running. ``page`` is asked for the address to open at each start."""

    def __init__(
        self,
        browser: Browser,
        *,
        profile: Path,
        argv: Callable[[], list[str]],
        page: Callable[[], str],
        environment: Callable[[], dict[str, str]] = lambda: dict(os.environ),
    ) -> None:
        self.browser = browser
        self.profile = profile
        self.argv = argv
        self.page = page
        self.environment = environment
        self.devtools = DevTools(profile)
        self.process: asyncio.subprocess.Process | None = None
        self.next_page: str | None = None
        self._restart = asyncio.Event()
        self._stopping = False

    async def run(self) -> None:
        self.profile.mkdir(parents=True, exist_ok=True)
        with contextlib.suppress(OSError):
            self.profile.chmod(0o700)
        nightly = asyncio.create_task(self._nightly())
        try:
            while not self._stopping:
                await self._once()
        finally:
            nightly.cancel()

    async def _once(self) -> None:
        mark_clean_exit(self.profile)
        page = self.next_page or self.page()
        self.next_page = None
        log.info("Opening %s with %s.", page, self.browser.name)
        try:
            self.process = await asyncio.create_subprocess_exec(
                self.browser.path,
                *self.argv(),
                page,
                env=self.environment(),
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
        except OSError as error:
            log.info("%s didn't start (%s); trying again in a minute.", self.browser.name, error)
            await self._wait_or_restart(60)
            return
        self._restart.clear()
        exited = asyncio.ensure_future(self.process.wait())
        asked = asyncio.ensure_future(self._restart.wait())
        await asyncio.wait({exited, asked}, return_when=asyncio.FIRST_COMPLETED)
        asked.cancel()
        if not exited.done():
            await self._stop_process()
            exited.cancel()
            return
        if not self._stopping:
            log.info(
                "%s closed (exit %s); starting it again in 3 seconds.",
                self.browser.name,
                self.process.returncode,
            )
            await self._wait_or_restart(RESTART_AFTER_S)

    async def _wait_or_restart(self, seconds: float) -> None:
        with contextlib.suppress(TimeoutError):
            await asyncio.wait_for(self._restart.wait(), seconds)
        self._restart.clear()

    async def _stop_process(self) -> None:
        process = self.process
        if process is None or process.returncode is not None:
            return
        process.terminate()
        try:
            await asyncio.wait_for(process.wait(), STOP_WAIT_S)
        except TimeoutError:
            process.kill()
            await process.wait()

    def restart(self, page: str | None = None) -> None:
        """Close the browser and start it again, on ``page`` if given."""
        self.next_page = page
        self._restart.set()

    async def navigate(self, url: str) -> None:
        """Go to ``url`` in the open page; restart the browser on it when that doesn't work."""
        if not await self.devtools.navigate(url):
            self.restart(url)

    async def look(self) -> PageLook:
        return await self.devtools.look()

    async def stop(self) -> None:
        self._stopping = True
        self._restart.set()
        await self._stop_process()

    async def _nightly(self) -> None:
        while True:
            now = datetime.now().astimezone()
            when = next_nightly(now, random.uniform(0, NIGHTLY_SPREAD_S))  # noqa: S311 - not secret
            await asyncio.sleep((when - now).total_seconds())
            log.info("Restarting %s for the night, to give back its memory.", self.browser.name)
            self.restart()


class NoBrowser:
    """``--fake`` (and a screen with no browser found): records what it was asked, starts
    nothing. The e2e runs bring their own browser."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    async def run(self) -> None:
        await asyncio.Event().wait()

    def restart(self, page: str | None = None) -> None:
        self.calls.append(f"restart {page or ''}".strip())

    async def navigate(self, url: str) -> None:
        self.calls.append(f"navigate {url}")

    async def look(self) -> PageLook:
        return PageLook(answered=True, sunroom=True)

    async def stop(self) -> None:
        self.calls.append("stop")
