"""The agent itself: one object that holds the screen's settings and everything that acts on
them, which the API (app.py) reads and calls (docs/M7.md, "The agent's API" and "Flows").

What runs while it's up, each as an asyncio task: the browser (browser.Supervisor), a health
check of the Sunroom every 10 s (and the re-find of a found Sunroom that moved), the watchdog
that brings up the "Can't reach" page when the browser has shown no Sunroom for two minutes,
and the screen's sleep and brightness on a thread of its own (screen.ScreenThread).
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import platform as host
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any, Protocol

import httpx

from sunroom_kiosk import config as settings_file
from sunroom_kiosk import logs, policy, screen
from sunroom_kiosk.browser import Browser, PageLook
from sunroom_kiosk.config import Config
from sunroom_kiosk.discovery import Discovery, Found, found_out, origin_of
from sunroom_kiosk.events import EventHub
from sunroom_kiosk.platform.base import Platform, PlatformError
from sunroom_kiosk.schemas import (
    ScreenAboutOut,
    ScreenBrightness,
    ScreenCapability,
    ScreenDisplayOut,
    ScreenFoundHow,
    ScreenNetworkOut,
    ScreenRotation,
    ScreenStateOut,
    ScreenSunroomOut,
    ScreenUpdateOut,
)
from sunroom_kiosk.updater import UpdaterLike
from sunroom_kiosk.version import version

log = logs.get("agent")

HEALTH_EVERY_S = 10.0
HEALTH_TIMEOUT_S = 5.0
DOWN_BEFORE_REFIND_S = 120.0
WATCH_EVERY_S = 30.0
NO_SUNROOM_FOR_S = 120.0
ABOUT_EVERY_S = 600.0
ACTION_DELAY_S = 1.5  # a restart waits this long, so its toast shows first


def _rotation(degrees: int) -> ScreenRotation:
    match degrees:
        case 90 | 180 | 270:
            return degrees
        case _:
            return 0


class BrowserLike(Protocol):
    async def run(self) -> None: ...
    def restart(self, page: str | None = None) -> None: ...
    async def navigate(self, url: str) -> None: ...
    async def look(self) -> PageLook: ...
    async def stop(self) -> None: ...


@dataclass
class Known:
    """What the Sunroom said about itself the last time it was asked."""

    name: str | None = None
    version: str | None = None
    asked_at: float = 0.0


class Agent:
    def __init__(
        self,
        *,
        port: int,
        config_path: Path,
        platform: Platform,
        browser: BrowserLike,
        updater: UpdaterLike,
        hub: EventHub | None = None,
        discovery: Discovery | None = None,
        http: Callable[[], httpx.AsyncClient] | None = None,
        browser_info: Browser | None = None,
        screen_root: Path = Path("/"),
        fake: bool = False,
        dev_origins: tuple[str, ...] = (),
    ) -> None:
        self.port = port
        self.config_path = config_path
        self.config = settings_file.load(config_path)
        self.platform = platform
        self.browser = browser
        self.browser_info = browser_info
        self.updater = updater
        self.hub = hub or EventHub()
        self.discovery = discovery or Discovery(self.hub.publish)
        self.http = http or (lambda: httpx.AsyncClient(timeout=HEALTH_TIMEOUT_S))
        self.fake = fake
        self.dev_origins = dev_origins  # just kiosk-dev: Vite's page, in front of the agent
        self.reachable = False
        self.known = Known()
        self.started = time.monotonic()
        self.screen_root = screen_root
        self.screen: screen.ScreenThread | None = None
        self._tasks: list[asyncio.Task[None]] = []
        self._down_since: float | None = None
        self._no_sunroom_since: float | None = None
        self.network = ScreenNetworkOut(kind="none", ssid=None, ip=None, strength=None)

    # ------------------------------------------------------------------ addresses

    @property
    def own_origin(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def origins(self) -> set[str]:
        """Who may call the agent from a page: the Sunroom it shows, and its own pages."""
        allowed = {self.own_origin, f"http://localhost:{self.port}", *self.dev_origins}
        if self.config.url:
            allowed.add(origin_of(self.config.url))
        return allowed

    def agent_url(self, path: str = "/") -> str:
        return f"{self.own_origin}{path}"

    def dimmer(self) -> str:
        if self.screen is not None:
            return "screen" if self.screen.method in ("ddc", "sysfs") else "page"
        return screen.dimmer_for(self._screen_settings(), self.screen_root)

    def open_url(self) -> str | None:
        """The wall's address for this screen: Sunroom's /display, saying who dims and where
        this agent listens (T3: the server widens that page's connect-src for it)."""
        if not self.config.url:
            return None
        return f"{self.config.url}/display?dimmer={self.dimmer()}&screen={self.port}"

    def start_page(self) -> str:
        """What the browser opens: Sunroom when it answers, else the screen's own pages."""
        opened = self.open_url()
        if opened is None:
            return self.agent_url("/")
        return opened if self.reachable else self.agent_url("/opening")

    # ------------------------------------------------------------------ state

    def snapshot(self) -> ScreenStateOut:
        sunroom = None
        if self.config.url:
            sunroom = ScreenSunroomOut(
                url=self.config.url,
                id=self.config.sunroom_id,
                name=self.known.name,
                found=self.config.found or "typed",
                reachable=self.reachable,
            )
        status = self.updater.status(self.update_check())
        return ScreenStateOut(
            version=version(),
            platform=self.platform.name,
            model=self.platform.model,
            session=self.platform.session,
            sunroom_os=self.platform.sunroom_os,
            capabilities=self.capabilities(),
            sunroom=sunroom,
            network=self.network,
            update=ScreenUpdateOut.model_validate(status),
            display=ScreenDisplayOut(
                rotation=_rotation(self.config.rotate),
                brightness_method=self._method(),
            ),
            open_url=self.open_url(),
        )

    def _method(self) -> ScreenBrightness:
        method = self.screen.method if self.screen is not None else "none"
        match method:
            case "ddc" | "sysfs":
                return method
            case _:
                return "none"

    def capabilities(self) -> list[ScreenCapability]:
        have = list(self.platform.capabilities())
        if "brightness" in have and self._method() == "none" and not self.fake:
            have.remove("brightness")
        if "run_sunroom" in have and self.config.url is not None:
            have.remove("run_sunroom")
        return have

    def update_check(self) -> str:
        """Nightly by default on Sunroom OS (an appliance stays patched), off elsewhere."""
        if self.config.update_check is not None:
            return self.config.update_check
        return "nightly" if self.platform.sunroom_os else "off"

    def publish_state(self) -> None:
        self.hub.publish("state", self.snapshot())

    def toast(self, message: str) -> None:
        self.hub.publish("toast", {"message": message})

    def save(self, config: Config) -> None:
        self.config = config
        settings_file.save(self.config_path, config)

    # ------------------------------------------------------------------ running

    async def start(self) -> None:
        await self.refresh_network()
        if self.config.url:
            self.reachable = await self.healthy(self.config.url)
            await self.ask_sunroom()
        self.screen = screen.ScreenThread(self._screen_settings(), root=self.screen_root)
        if self.config.url and not self.fake:
            self.screen.start()
        await self.apply_policy()
        self.spawn(self.browser.run())
        self.spawn(self._health_loop())
        self.spawn(self._watch_loop())
        self.spawn(self._network_loop())
        self.spawn(self.updater.run(self))
        log.info(
            "Sunroom Screen %s is running on %s; it shows %s.",
            version(),
            self.own_origin,
            self.config.url or "its own setup pages",
        )

    def spawn(self, work: Awaitable[Any]) -> None:
        async def guarded() -> None:
            try:
                await work
            except asyncio.CancelledError:
                raise
            except Exception as error:  # one part failing never takes the screen down
                log.exception("Something stopped unexpectedly: %r", error)

        self._tasks.append(asyncio.create_task(guarded()))

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
        if self.screen is not None:
            await asyncio.to_thread(self.screen.stop)
        await self.browser.stop()
        self.hub.close()

    def _screen_settings(self) -> screen.Settings:
        return screen.Settings(
            url=self.config.url or screen.DEFAULT_URL,
            session="x11" if self.config.session == "x11" else "wayland",
            output=self.config.output,
            helper=self.config.screen_helper and self.platform.name in ("pi", "linux"),
            brightness=self.config.brightness,
            ddc_bus=self.config.ddc_bus,
            backlight=self.config.backlight,
        )

    async def healthy(self, url: str) -> bool:
        try:
            async with self.http() as client:
                response = await client.get(f"{url}/api/health")
        except httpx.HTTPError:
            return False
        return response.status_code == 200

    async def ask_sunroom(self) -> None:
        """The Sunroom's name and version, for the screen's words (never logged)."""
        url = self.config.url
        if not url:
            return
        try:
            found = await self.discovery.check(url)
        except Exception:
            return
        self.known = Known(name=found.name, version=found.version, asked_at=time.monotonic())
        if found.id and self.config.sunroom_id is None:
            self.save(replace(self.config, sunroom_id=found.id))

    async def _health_loop(self) -> None:
        while True:
            await asyncio.sleep(HEALTH_EVERY_S)
            await self.health_tick()

    async def health_tick(self) -> None:
        url = self.config.url
        if url is None:
            if self.reachable:
                self.reachable = False
                self.publish_state()
            return
        ok = await self.healthy(url)
        if ok != self.reachable:
            self.reachable = ok
            log.info("Sunroom at %s %s.", url, "answers" if ok else "doesn't answer")
            self.publish_state()
        now = time.monotonic()
        if ok:
            self._down_since = None
            if now - self.known.asked_at > ABOUT_EVERY_S:
                await self.ask_sunroom()
            return
        self._down_since = self._down_since or now
        if (
            now - self._down_since >= DOWN_BEFORE_REFIND_S
            and self.config.found == "discovered"
            and self.config.sunroom_id
        ):
            self._down_since = now  # the next look in two minutes, not every 10 s
            await self.refind(self.config.sunroom_id)

    async def refind(self, sunroom_id: str) -> None:
        """A found Sunroom that stopped answering may have a new address (DHCP): look for the
        same id, and move to it. A typed address is never changed by itself."""
        log.info("Looking for this screen's Sunroom at a new address.")
        found = await self.discovery.refind(sunroom_id)
        if found is None or found.url == self.config.url:
            return
        log.info("Found this screen's Sunroom at %s.", found.url)
        await self.use(found, "discovered", moved=True)

    async def _watch_loop(self) -> None:
        while True:
            await asyncio.sleep(WATCH_EVERY_S)
            await self.watch_tick()

    async def watch_tick(self) -> None:
        """The app is in charge while it shows anything (its offline pill, its reload). The
        agent steps in only when the browser has shown no Sunroom at all for two minutes."""
        if not self.config.url:
            self._no_sunroom_since = None
            return
        look = await self.browser.look()
        on_own_pages = bool(look.href and look.href.startswith(self.own_origin))
        if look.answered and (look.sunroom or on_own_pages):
            self._no_sunroom_since = None
            return
        now = time.monotonic()
        self._no_sunroom_since = self._no_sunroom_since or now
        if now - self._no_sunroom_since < NO_SUNROOM_FOR_S:
            return
        self._no_sunroom_since = None
        page = self.agent_url("/cant-reach")
        if look.answered:
            log.info("The browser has shown no Sunroom for two minutes; showing Can't reach.")
            await self.browser.navigate(page)
        else:
            log.info("The browser stopped answering; starting it again.")
            self.browser.restart(page)

    async def _network_loop(self) -> None:
        while True:
            await asyncio.sleep(30)
            await self.refresh_network()

    async def refresh_network(self) -> None:
        try:
            status = await self.platform.network()
        except PlatformError:
            return
        network = ScreenNetworkOut(
            kind=status.kind, ssid=status.ssid, ip=status.ip, strength=status.strength
        )
        if network != self.network:
            self.network = network
            self.publish_state()

    # ------------------------------------------------------------------ the Sunroom

    async def check(self, typed: str) -> Found:
        return await self.discovery.check(typed)

    async def scan(self) -> None:
        found = await self.discovery.scan()
        log.info("Found %d Sunroom%s.", len(found), "" if len(found) == 1 else "s")

    async def run_sunroom(self) -> None:
        """Sunroom OS: start Sunroom on this screen (batch 2, T16), then show it."""

        async def progress(percent: int, step: str) -> None:
            self.hub.publish("run.progress", {"percent": percent, "step": step})

        try:
            url = await self.platform.run_sunroom(progress)
        except PlatformError as error:
            self.toast(str(error))
            return
        found = Found(url=url, id=None, name=None, version=None, setup_complete=False)
        try:
            found = await self.discovery.check(url)
        except Exception as error:  # it answered once; the screen still uses it
            log.info("The new Sunroom didn't answer its first check: %r", error)
        await self.use(found, "local")

    async def use(self, found: Found, how: str, *, moved: bool = False) -> None:
        """Show ``found`` on this screen from now on: save it, rewrite the browser's policy,
        follow it with the screen's sleep, and open it (restarting the browser, which reads a
        new address's flags only when it starts)."""
        how_found: ScreenFoundHow = (
            "discovered" if how == "discovered" else "local" if how == "local" else "typed"
        )
        self.save(self.config.with_sunroom(found.url, found.id, how_found))
        self.known = Known(name=found.name, version=found.version, asked_at=time.monotonic())
        self.reachable = await self.healthy(found.url)
        await self.apply_policy()
        if self.screen is not None:
            self.screen.retarget(found.url)
            if not self.fake:
                self.screen.start()
        self.publish_state()
        if moved:
            self.toast("Found Sunroom at its new address.")
        log.info("This screen shows the Sunroom at %s now.", found.url)
        await asyncio.sleep(ACTION_DELAY_S if not self.fake else 0)
        self.browser.restart(self.start_page())

    async def forget(self) -> None:
        """Forget the address (never the browser's profile, which keeps the pairing)."""
        self.save(self.config.with_sunroom(None, None, None))
        self.known = Known()
        self.reachable = False
        await self.apply_policy()
        self.publish_state()
        log.info("This screen forgot its Sunroom's address.")
        self.browser.restart(self.agent_url("/find"))

    async def apply_policy(self) -> None:
        if self.browser_info is None and not self.fake:
            return
        kind = self.browser_info.kind if self.browser_info is not None else "chromium"
        document = policy.document(origin_of(self.config.url) if self.config.url else None)
        try:
            written = await self.platform.write_policy(policy.linux_path(kind), document)
        except PlatformError as error:
            log.info("Couldn't write the browser's policy: %s", error)
            return
        if not written:
            log.debug("The browser's policy is the installer's to write here.")

    # ------------------------------------------------------------------ the machine

    async def later(self, action: Callable[[], Awaitable[None]]) -> None:
        """Run ``action`` a moment from now, after the answer (and its toast) went out."""

        async def go() -> None:
            await asyncio.sleep(ACTION_DELAY_S)
            try:
                await action()
            except PlatformError as error:
                log.info("%s", error)
                self.toast(str(error))

        self.spawn(go())

    async def rotate(self, rotation: int) -> None:
        await self.platform.rotate(rotation)
        self.save(replace(self.config, rotate=rotation))
        self.publish_state()

    def set_update_check(self, check_policy: str) -> None:
        self.save(
            replace(self.config, update_check="nightly" if check_policy == "nightly" else "off")
        )
        self.publish_state()

    def about(self) -> ScreenAboutOut:
        return ScreenAboutOut(
            version=version(),
            platform=self.platform.name,
            model=self.platform.model,
            system=self.platform.system or f"{host.system()} {host.release()}",
            browser=self.browser_info.name if self.browser_info else None,
            hostname=self.platform.hostname(),
            ip=self.network.ip,
            uptime_s=int(time.monotonic() - self.started),
            sunroom_url=self.config.url,
            log=logs.recent(),
        )

    def scan_results(self) -> list[dict[str, Any]]:
        return [found_out(found) for found in self.discovery.found]

    async def reset_fake(self) -> None:
        """``--fake`` only: the pretend screen as it started, with no Sunroom chosen."""
        from sunroom_kiosk.platform.fake import FakePlatform
        from sunroom_kiosk.updater import FakeUpdater

        if not isinstance(self.platform, FakePlatform):
            return
        self.platform.reset()
        if isinstance(self.updater, FakeUpdater):
            self.updater.reset()
        self.save(Config())
        self.known = Known()
        self.reachable = False
        self.discovery.found = []
        await self.refresh_network()
        self.publish_state()

    async def change_fake(
        self,
        *,
        kind: str | None = None,
        wired: bool | None = None,
        offline: bool | None = None,
        sunroom: str | None = None,
    ) -> None:
        from sunroom_kiosk.platform.fake import FakePlatform

        if not isinstance(self.platform, FakePlatform):
            return
        if kind == "pi" or kind == "desktop":
            self.platform.kind = kind
        if wired is not None:
            self.platform.wired = wired
        if offline:
            self.platform.networks = [replace(n, connected=False) for n in self.platform.networks]
        if sunroom is not None:
            self.save(self.config.with_sunroom(sunroom.rstrip("/"), None, "typed"))
            self.known = Known()
            await self.health_tick()
        await self.refresh_network()
        self.publish_state()

    async def quit(self) -> None:
        log.info("Sunroom Screen is quitting until the next sign-in.")
        await self.stop()
        os._exit(0)
