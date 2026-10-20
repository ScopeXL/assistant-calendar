"""Linux: any desktop, and the base of the Raspberry Pi's adapter (docs/M7.md T7).

* **Power** through logind: ``systemctl reboot`` and ``poweroff``, which the active local
  session may do without a password.
* **Wi-Fi** through NetworkManager's ``nmcli``, when it's there and running. A password never
  goes on a command line (any user can read those): the connection is made without it, then
  brought up with ``passwd-file /dev/stdin``, the password on stdin.
* **Before the browser starts** (what ``kiosk/sunroom-kiosk`` did in bash): wait for the desktop
  (a Wayland socket or an X display), and up to a minute for the clock; on X11, switch off the
  screensaver and blanking (``xset s off``, ``xset dpms 0 0 0``, never ``xset -dpms``) and hide
  the pointer with ``unclutter``.

A desktop that isn't a Pi can Quit (Sunroom Screen stops until the next sign-in); it doesn't turn
its picture (its own display settings do) and has no root helper (its system updates aren't ours).
"""

from __future__ import annotations

import asyncio
import os
import shutil
from collections.abc import Callable, Mapping
from pathlib import Path

from sunroom_kiosk import logs
from sunroom_kiosk.platform.base import (
    CommandResult,
    NetworkStatus,
    Platform,
    PlatformError,
    Runner,
    WifiNetwork,
    local_ip,
    run_command,
    user_id,
)
from sunroom_kiosk.schemas import ScreenCapability, ScreenSession

log = logs.get("platform")

DESKTOP_WAIT_S = 2.0
CLOCK_TRIES = 30  # 2 s apart: a minute


def split_terse(line: str) -> list[str]:
    """One line of ``nmcli -t`` output: fields split on ``:``, with ``\\:`` and ``\\\\`` undone."""
    fields: list[str] = []
    current: list[str] = []
    escaped = False
    for char in line:
        if escaped:
            current.append(char)
            escaped = False
        elif char == "\\":
            escaped = True
        elif char == ":":
            fields.append("".join(current))
            current = []
        else:
            current.append(char)
    fields.append("".join(current))
    return fields


def wifi_from(listing: str, saved_names: set[str]) -> list[WifiNetwork]:
    """``nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY device wifi list``: one row per network (the
    strongest of its access points), hidden networks left out."""
    best: dict[str, WifiNetwork] = {}
    for line in listing.splitlines():
        fields = split_terse(line)
        if len(fields) < 4 or not fields[1]:
            continue
        in_use, ssid, signal, security = fields[0], fields[1], fields[2], fields[3]
        try:
            strength = max(0, min(100, int(signal)))
        except ValueError:
            strength = 0
        saved = ssid in saved_names
        network = WifiNetwork(
            id=ssid if saved else None,
            ssid=ssid,
            strength=strength,
            secured=bool(security.strip()) and security.strip() != "--",
            connected=in_use.strip() == "*",
            saved=saved,
        )
        known = best.get(ssid)
        if (
            known is None
            or network.connected
            or (not known.connected and strength > known.strength)
        ):
            best[ssid] = network
    return list(best.values())


def join_problem(ssid: str, result: CommandResult) -> str:
    """What nmcli's refusal means, in the family's words."""
    text = result.output.lower()
    if "secrets were required" in text or "psk" in text or "password" in text:
        return f"That password didn't work for {ssid}. Check it and try again."
    if "no network with ssid" in text or "not found" in text:
        return f"{ssid} is out of range. Move closer, or try another network."
    return f"Couldn't join {ssid}. Try again in a moment."


class LinuxPlatform(Platform):
    def __init__(
        self,
        runner: Runner = run_command,
        root: Path = Path("/"),
        *,
        environ: Mapping[str, str] | None = None,
        which: Callable[[str], str | None] = shutil.which,
    ) -> None:
        super().__init__(runner, root)
        self.environ: Mapping[str, str] = os.environ if environ is None else environ
        self.which = which

    # ------------------------------------------------------------------ what it is

    @property
    def session(self) -> ScreenSession:
        kind = self.environ.get("XDG_SESSION_TYPE", "")
        if kind == "x11":
            return "x11"
        if kind == "wayland" or self.environ.get("WAYLAND_DISPLAY"):
            return "wayland"
        return "x11" if self.environ.get("DISPLAY") else "desktop"

    @property
    def model(self) -> str:
        name = self._read("sys/devices/virtual/dmi/id/product_name")
        return name or "Computer"

    @property
    def system(self) -> str:
        for line in self._read("etc/os-release").splitlines():
            key, _, value = line.partition("=")
            if key == "PRETTY_NAME":
                return value.strip().strip('"') or "Linux"
        return "Linux"

    def _read(self, relative: str) -> str:
        try:
            return (
                (self.root / relative)
                .read_text(encoding="utf-8", errors="replace")
                .strip("\x00\n ")
            )
        except OSError:
            return ""

    def has_wifi(self) -> bool:
        return self.which("nmcli") is not None

    def capabilities(self) -> list[ScreenCapability]:
        have: list[ScreenCapability] = ["restart", "shutdown", "update"]
        if self.has_wifi():
            have.append("wifi")
        have.append("quit")
        return have

    # ------------------------------------------------------------------ the machine

    async def _must(self, argv: list[str], what: str, stdin: str | None = None) -> CommandResult:
        result = await self.run(argv, stdin=stdin)
        if not result.ok:
            log.info("%s didn't work: %s", " ".join(argv[:3]), result.first_line())
            raise PlatformError(f"{what} didn't work. Try again in a moment.")
        return result

    async def restart(self) -> None:
        await self._must(["systemctl", "reboot"], "Restarting")

    async def shutdown(self) -> None:
        await self._must(["systemctl", "poweroff"], "Shutting down")

    # ------------------------------------------------------------------ the network

    async def network(self) -> NetworkStatus:
        if not self.has_wifi():
            return await super().network()
        devices = await self.run(["nmcli", "-t", "-f", "TYPE,STATE", "device"])
        wired = wifi = False
        for line in devices.output.splitlines():
            fields = split_terse(line)
            if len(fields) >= 2 and fields[1] == "connected":
                wired = wired or fields[0] == "ethernet"
                wifi = wifi or fields[0] == "wifi"
        ip = local_ip()
        if wired:
            return NetworkStatus(kind="wired", ip=ip)
        if wifi:
            joined = next((n for n in await self._scan(rescan=False) if n.connected), None)
            return NetworkStatus(
                kind="wifi",
                ssid=joined.ssid if joined else None,
                ip=ip,
                strength=joined.strength if joined else None,
            )
        return NetworkStatus(kind="none", ip=ip)

    async def _saved(self) -> set[str]:
        result = await self.run(["nmcli", "-t", "-f", "NAME,TYPE", "connection", "show"])
        names: set[str] = set()
        for line in result.output.splitlines():
            fields = split_terse(line)
            if len(fields) >= 2 and fields[1] in ("802-11-wireless", "wifi"):
                names.add(fields[0])
        return names

    async def _scan(self, *, rescan: bool) -> list[WifiNetwork]:
        result = await self.run(
            [
                "nmcli",
                "-t",
                "-f",
                "IN-USE,SSID,SIGNAL,SECURITY",
                "device",
                "wifi",
                "list",
                "--rescan",
                "auto" if rescan else "no",
            ],
            limit=30.0,
        )
        if not result.ok:
            raise PlatformError("This screen's Wi-Fi didn't answer. Try again in a moment.")
        return wifi_from(result.output, await self._saved())

    async def wifi_networks(self) -> list[WifiNetwork]:
        return await self._scan(rescan=True)

    async def wifi_join(self, ssid: str, password: str) -> None:
        networks = {n.ssid: n for n in await self._scan(rescan=False)}
        network = networks.get(ssid)
        if network is not None and network.saved and not password:
            result = await self.run(["nmcli", "connection", "up", "id", ssid], limit=60.0)
        elif not password:
            result = await self.run(["nmcli", "device", "wifi", "connect", ssid], limit=60.0)
        else:
            # Made without the password, then brought up with it on stdin (never in argv).
            await self.run(["nmcli", "connection", "delete", "id", ssid])
            added = await self.run(
                [
                    "nmcli",
                    "connection",
                    "add",
                    "type",
                    "wifi",
                    "con-name",
                    ssid,
                    "ssid",
                    ssid,
                    "wifi-sec.key-mgmt",
                    "wpa-psk",
                ]
            )
            if not added.ok:
                raise PlatformError(join_problem(ssid, added))
            result = await self.run(
                ["nmcli", "connection", "up", "id", ssid, "passwd-file", "/dev/stdin"],
                stdin=f"802-11-wireless-security.psk:{password}\n",
                limit=60.0,
            )
            if not result.ok:
                await self.run(["nmcli", "connection", "delete", "id", ssid])
        if not result.ok:
            raise PlatformError(join_problem(ssid, result))

    async def wifi_forget(self, network_id: str) -> None:
        await self._must(["nmcli", "connection", "delete", "id", network_id], "Forgetting it")

    # ------------------------------------------------------------------ before the browser

    async def wait_for_desktop(self) -> None:
        """A compositor to draw on: started too early, the browser only crashes and restarts."""
        waited = 0.0
        while not self._desktop_up():
            if waited % 60 == 0:
                log.info("Waiting for the desktop to start (no display yet).")
            await asyncio.sleep(DESKTOP_WAIT_S)
            waited += DESKTOP_WAIT_S

    def _desktop_up(self) -> bool:
        socket = self.environ.get("WAYLAND_DISPLAY", "")
        if socket:
            if not socket.startswith("/"):
                runtime = self.environ.get("XDG_RUNTIME_DIR", f"/run/user/{user_id()}")
                socket = os.path.join(runtime, socket)
            return Path(socket).exists()
        return bool(self.environ.get("DISPLAY"))

    async def wait_for_clock(self) -> None:
        """A Pi has no clock of its own: up to a minute for it to be set from the internet."""
        if self.which("timedatectl") is None:
            return
        for _ in range(CLOCK_TRIES):
            result = await self.run(["timedatectl", "show", "-p", "NTPSynchronized", "--value"])
            if result.output.strip() == "yes":
                return
            await asyncio.sleep(2)
        log.info("The clock hasn't been set after a minute; starting anyway.")

    async def prepare_session(self, rotation: int, output: str) -> None:
        if self.session != "x11":
            return
        for argv in (
            ["xset", "s", "off"],
            ["xset", "dpms", "0", "0", "0"],
            ["xset", "s", "noblank"],
        ):
            await self.run(argv)
        if self.which("unclutter") is not None:
            running = await self.run(["pgrep", "-u", user_id(), "-x", "unclutter"])
            if not running.ok:
                await asyncio.create_subprocess_exec(
                    "unclutter",
                    "-idle",
                    "1",
                    "-root",
                    stdin=asyncio.subprocess.DEVNULL,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
