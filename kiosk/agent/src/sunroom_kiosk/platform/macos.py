"""macOS (docs/M7.md T15): a Mac someone signs in to, where Sunroom Screen runs for that person
from a LaunchAgent (``~/Library/LaunchAgents/app.sunroom.kiosk.plist``, which kiosk/install.sh
writes), started again if it fails and not after Quit.

* **Power:** System Events' ``restart`` and ``shut down`` through ``osascript`` (macOS asks once
  whether Sunroom Screen may control System Events).
* **Sleep:** the screen helper keeps the display awake with ``caffeinate`` while the household's
  times say on, and puts it to sleep with ``pmset displaysleepnow`` (screen.py). No brightness:
  the page dims itself (``?dimmer=page``).
* **The network:** macOS joins Wi-Fi itself; ``open_network_settings`` opens its Wi-Fi page.
* **The browser's policy** with ``defaults write`` in the browser's own preferences (policy.py's
  ``mac_commands``), as this user. Chrome reads those as recommended policies; a Mac managed by
  a profile may override them, and then the browser asks once, on the screen.
"""

from __future__ import annotations

import platform as python_platform
import subprocess
from collections.abc import Callable
from pathlib import Path
from typing import Any

from sunroom_kiosk import logs, policy
from sunroom_kiosk.platform.base import (
    CommandResult,
    Platform,
    PlatformError,
    Runner,
    run_command,
)
from sunroom_kiosk.schemas import ScreenCapability, ScreenPlatform

log = logs.get("platform")

WIFI_SETTINGS = "x-apple.systempreferences:com.apple.wifi-settings-extension"


def hardware_model() -> str:
    """The Mac's model identifier (``Mac14,2``), from sysctl; empty when it doesn't say."""
    try:
        done = subprocess.run(
            ["/usr/sbin/sysctl", "-n", "hw.model"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except OSError, subprocess.TimeoutExpired:
        return ""
    return done.stdout.strip() if done.returncode == 0 else ""


def macos_version() -> str:
    return python_platform.mac_ver()[0]


class MacPlatform(Platform):
    def __init__(
        self,
        runner: Runner = run_command,
        root: Path = Path("/"),
        *,
        identifier: Callable[[], str] = hardware_model,
        release: Callable[[], str] = macos_version,
    ) -> None:
        super().__init__(runner, root)
        self.identifier = identifier
        self.release = release

    # ------------------------------------------------------------------ what it is

    @property
    def name(self) -> ScreenPlatform:
        return "macos"

    @property
    def model(self) -> str:
        found = self.identifier()
        return f"Mac ({found})" if found else "Mac"

    @property
    def system(self) -> str:
        found = self.release()
        return f"macOS {found}" if found else "macOS"

    def capabilities(self) -> list[ScreenCapability]:
        return ["restart", "shutdown", "update", "open_network_settings", "quit"]

    # ------------------------------------------------------------------ the machine

    async def _must(self, argv: list[str], what: str) -> CommandResult:
        result = await self.run(argv)
        if not result.ok:
            log.info("%s didn't work: %s", " ".join(argv[:2]), result.first_line())
            raise PlatformError(f"{what} didn't work. Try again in a moment.")
        return result

    async def restart(self) -> None:
        await self._must(
            ["osascript", "-e", 'tell application "System Events" to restart'], "Restarting"
        )

    async def shutdown(self) -> None:
        await self._must(
            ["osascript", "-e", 'tell application "System Events" to shut down'], "Shutting down"
        )

    async def open_network_settings(self) -> None:
        await self._must(["open", WIFI_SETTINGS], "Opening the network settings")

    # ------------------------------------------------------------------ the browser's policy

    async def write_policy(self, kind: policy.BrowserKind, document: dict[str, Any]) -> bool:
        """This user's preferences for that browser: Sunroom Screen's keys that aren't in
        ``document`` taken out (an address that went leaves nothing), then each one written."""
        domain = policy.MAC_DOMAINS[kind]
        for key in sorted(policy.ALLOWED_KEYS - document.keys()):
            await self.run(["defaults", "delete", domain, key])  # not there: nothing to do
        for argv in policy.mac_commands(kind, document):
            await self._must(argv, "Saving the browser's settings")
        return True

    async def remove_policy(self, kind: policy.BrowserKind) -> bool:
        domain = policy.MAC_DOMAINS[kind]
        for key in sorted(policy.ALLOWED_KEYS):
            await self.run(["defaults", "delete", domain, key])
        return True
