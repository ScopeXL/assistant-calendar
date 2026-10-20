"""``--fake``: a pretend machine for the agent's tests, the e2e runs and ``just kiosk-dev``.

Three Wi-Fi networks, a power button that only records what it was asked, a screen that turns,
and no files outside the agent's own folder. ``kind`` is ``pi`` (Sunroom OS on a Raspberry Pi,
every capability) or ``desktop`` (a computer: Quit, and the system's own network settings).
Names are synthetic, like every fixture (CLAUDE.md, hard rule 1).
"""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path
from typing import Any, Literal

from sunroom_kiosk.platform.base import (
    NetworkStatus,
    Platform,
    PlatformError,
    Progress,
    WifiNetwork,
)
from sunroom_kiosk.schemas import ScreenCapability, ScreenPlatform, ScreenSession

type FakeKind = Literal["pi", "desktop"]

TURNED_DOWN = "wrong-password"  # the one Wi-Fi password the fake turns down


def _networks() -> list[WifiNetwork]:
    return [
        WifiNetwork("HomeNet", "HomeNet", 82, secured=True, connected=True, saved=True),
        WifiNetwork(None, "SampleStreet-5G", 54, secured=True, connected=False, saved=False),
        WifiNetwork(None, "Library Guest", 23, secured=False, connected=False, saved=False),
    ]


class FakePlatform(Platform):
    def __init__(self, kind: FakeKind = "pi") -> None:
        super().__init__()
        self.kind: FakeKind = kind
        self.calls: list[str] = []  # what it was asked to do, in order
        self.networks = _networks()
        self.wired = False
        self.rotation = 0
        self.policies: dict[str, dict[str, Any]] = {}

    def reset(self, kind: FakeKind = "pi") -> None:
        """As it started: the test server's reset calls this before each test."""
        self.kind = kind
        self.calls.clear()
        self.networks = _networks()
        self.wired = False
        self.rotation = 0
        self.policies.clear()

    @property
    def name(self) -> ScreenPlatform:
        return "pi" if self.kind == "pi" else "linux"

    @property
    def session(self) -> ScreenSession:
        return "wayland" if self.kind == "pi" else "desktop"

    @property
    def sunroom_os(self) -> bool:
        return self.kind == "pi"

    @property
    def model(self) -> str:
        return "Raspberry Pi 5 Model B" if self.kind == "pi" else "Computer"

    @property
    def system(self) -> str:
        return "Sunroom OS (pretend)" if self.kind == "pi" else "A pretend computer"

    def hostname(self) -> str:
        return "sunroom"

    def capabilities(self) -> list[ScreenCapability]:
        if self.kind == "pi":
            return [
                "restart",
                "shutdown",
                "update",
                "wifi",
                "rotate",
                "brightness",
                "run_sunroom",
                "update_sunroom",
            ]
        return ["restart", "shutdown", "update", "quit", "open_network_settings"]

    async def restart(self) -> None:
        self.calls.append("restart")

    async def shutdown(self) -> None:
        self.calls.append("shutdown")

    async def open_network_settings(self) -> None:
        self.calls.append("open_network_settings")

    async def network(self) -> NetworkStatus:
        if self.wired:
            return NetworkStatus(kind="wired", ip="192.168.1.30")
        joined = next((n for n in self.networks if n.connected), None)
        if joined is None:
            return NetworkStatus(kind="none")
        return NetworkStatus(
            kind="wifi", ssid=joined.ssid, ip="192.168.1.30", strength=joined.strength
        )

    async def wifi_networks(self) -> list[WifiNetwork]:
        return list(self.networks)

    async def wifi_join(self, ssid: str, password: str) -> None:
        self.calls.append(f"wifi_join {ssid}")
        target = next((n for n in self.networks if n.ssid == ssid), None)
        if target is None:
            raise PlatformError(f"{ssid} is out of range. Move closer, or try another network.")
        if target.secured and (len(password) < 8 or password == TURNED_DOWN):
            raise PlatformError(f"That password didn't work for {ssid}. Check it and try again.")
        self.networks = [
            replace(n, connected=n.ssid == ssid, saved=n.saved or n.ssid == ssid, id=n.id or ssid)
            if n.ssid == ssid
            else replace(n, connected=False)
            for n in self.networks
        ]

    async def wifi_forget(self, network_id: str) -> None:
        self.calls.append(f"wifi_forget {network_id}")
        self.networks = [
            replace(n, id=None, saved=False, connected=False) if n.id == network_id else n
            for n in self.networks
        ]

    async def rotate(self, rotation: int, output: str) -> None:
        self.calls.append(f"rotate {rotation}")
        self.rotation = rotation

    async def write_policy(self, path: Path, document: dict[str, Any]) -> bool:
        self.policies[str(path)] = document
        return True

    async def update_sunroom(self) -> bool:
        self.calls.append("update_sunroom")
        return True

    async def run_sunroom(self, progress: Progress) -> str:
        self.calls.append("run_sunroom")
        steps = (
            (10, "Downloading Sunroom…"),
            (60, "Downloading Sunroom…"),
            (90, "Starting Sunroom…"),
            (100, "Sunroom is running."),
        )
        for percent, step in steps:
            await progress(percent, step)
        return "http://localhost:8080"
