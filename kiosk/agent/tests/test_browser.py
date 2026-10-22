"""The wall's browser (browser.py): which one, its flags, the clean-exit mark, the nightly
restart's time, and the supervisor starting it again after it exits. The "browser" here is a
tiny script; nothing real is started. Synthetic data only."""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from sunroom_kiosk import browser as browser_module
from sunroom_kiosk.browser import (
    Browser,
    Supervisor,
    find_browser,
    flags,
    insecure_origin,
    mark_clean_exit,
    next_nightly,
)

CHROMIUM = Browser("chromium", "/usr/bin/chromium", "Chromium")


def test_linux_prefers_chromium_then_chrome_then_edge() -> None:
    installed = {
        "google-chrome": "/usr/bin/google-chrome",
        "microsoft-edge": "/usr/bin/microsoft-edge",
    }
    found = find_browser("linux", which=installed.get, snap=lambda path: False)
    assert found == Browser("chrome", "/usr/bin/google-chrome", "Google Chrome")
    installed["chromium-browser"] = "/usr/bin/chromium-browser"
    assert find_browser("linux", which=installed.get, snap=lambda path: False) == Browser(
        "chromium", "/usr/bin/chromium-browser", "Chromium"
    )
    assert find_browser("linux", which=lambda name: None) is None


def test_linux_passes_over_a_snaps_browser() -> None:
    installed = {
        "chromium": "/snap/bin/chromium",
        "chromium-browser": "/usr/bin/chromium-browser",  # Ubuntu's script that runs the snap
        "google-chrome": "/usr/bin/google-chrome",
    }
    snaps = {"/snap/bin/chromium", "/usr/bin/chromium-browser"}
    assert find_browser("linux", which=installed.get, snap=snaps.__contains__) == Browser(
        "chrome", "/usr/bin/google-chrome", "Google Chrome"
    )
    del installed["google-chrome"]
    assert find_browser("linux", which=installed.get, snap=snaps.__contains__) is None


def test_a_snap_is_known_by_its_path_or_by_the_script_that_runs_it(tmp_path: Path) -> None:
    wrapper = tmp_path / "chromium-browser"
    wrapper.write_text('#!/bin/sh\nexec /snap/bin/chromium "$@"\n')
    plain = tmp_path / "chromium"
    plain.write_text('#!/bin/sh\nexec /usr/lib/chromium/chromium "$@"\n')
    program = tmp_path / "chrome"
    program.write_bytes(b"\x7fELF\x02\x01\x01\x00/snap/")
    assert browser_module.is_snap("/snap/bin/chromium")
    assert browser_module.is_snap(str(wrapper))
    assert not browser_module.is_snap(str(plain))
    assert not browser_module.is_snap(str(program))
    assert not browser_module.is_snap(str(tmp_path / "missing"))


def test_macos_looks_in_applications() -> None:
    edge = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    assert find_browser("darwin", exists=lambda path: path == edge, home="/Users/ana") == Browser(
        "edge", edge, "Microsoft Edge"
    )


def test_macos_looks_in_the_accounts_own_applications_too() -> None:
    mine = "/Users/ana/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    shared = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    edge = "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    installed = {mine, edge}
    assert find_browser("darwin", exists=installed.__contains__, home="/Users/ana") == Browser(
        "chrome", mine, "Google Chrome"
    )
    installed.add(shared)
    assert find_browser("darwin", exists=installed.__contains__, home="/Users/ana") == Browser(
        "chrome", shared, "Google Chrome"
    )


@pytest.mark.parametrize(
    ("url", "origin"),
    [
        ("http://192.168.1.20:8080", "http://192.168.1.20:8080"),
        ("http://sunroom.local:8080", "http://sunroom.local:8080"),
        ("http://localhost:8080", None),
        ("http://127.0.0.1:8080", None),
        ("https://calendar.example.com", None),
    ],
)
def test_only_plain_http_elsewhere_is_marked_secure(url: str, origin: str | None) -> None:
    assert insecure_origin(url) == origin


def test_the_launchers_flags_on_wayland(tmp_path: Path) -> None:
    argv = flags(
        CHROMIUM,
        profile=tmp_path,
        session="wayland",
        sunroom_url="http://192.168.1.20:8080",
        system="linux",
    )
    assert argv[0] == f"--user-data-dir={tmp_path}"
    for flag in ("--kiosk", "--noerrdialogs", "--disable-pinch", "--remote-debugging-port=0"):
        assert flag in argv
    assert "--ozone-platform=wayland" in argv and "--password-store=basic" in argv
    assert "--unsafely-treat-insecure-origin-as-secure=http://192.168.1.20:8080" in argv
    assert not any(flag in argv for flag in ("--incognito", "--disable-gpu"))


def test_x11_and_https_need_neither_wayland_nor_the_secure_flag(tmp_path: Path) -> None:
    argv = flags(
        CHROMIUM,
        profile=tmp_path,
        session="x11",
        sunroom_url="https://calendar.example.com",
        system="linux",
    )
    assert "--ozone-platform=wayland" not in argv
    assert not any(flag.startswith("--unsafely-treat") for flag in argv)


def test_the_last_exit_is_marked_clean(tmp_path: Path) -> None:
    prefs = tmp_path / "Default" / "Preferences"
    prefs.parent.mkdir()
    prefs.write_text(
        json.dumps({"profile": {"exit_type": "Crashed", "exited_cleanly": False}, "x": 1})
    )
    mark_clean_exit(tmp_path)
    data = json.loads(prefs.read_text())
    assert data["profile"] == {"exit_type": "Normal", "exited_cleanly": True}
    assert data["x"] == 1
    mark_clean_exit(tmp_path / "missing")  # no profile yet: nothing to do


def test_the_nightly_restart_is_at_about_four() -> None:
    zone = ZoneInfo("America/New_York")
    evening = datetime(2026, 10, 20, 22, 0, tzinfo=zone)
    assert next_nightly(evening, 300) == datetime(2026, 10, 21, 4, 0, tzinfo=zone)
    early = datetime(2026, 10, 21, 1, 0, tzinfo=zone)
    assert next_nightly(early, 0) == datetime(2026, 10, 21, 3, 55, tzinfo=zone)


@pytest.mark.skipif(sys.platform == "win32", reason="the pretend browser is a shell script")
async def test_the_supervisor_starts_it_again_after_it_exits(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(browser_module, "RESTART_AFTER_S", 0.01)
    started = tmp_path / "started"
    script = tmp_path / "browser.sh"
    script.write_text(f'#!/bin/sh\necho "$@" >> "{started}"\nexit 1\n')
    script.chmod(0o755)
    pages = iter(["http://127.0.0.1:7800/", "http://192.168.1.20:8080/display", "x", "y", "z"])
    supervisor = Supervisor(
        Browser("chromium", str(script), "Pretend"),
        profile=tmp_path / "profile",
        argv=lambda: ["--kiosk"],
        page=lambda: next(pages),
    )
    running = asyncio.create_task(supervisor.run())
    for _ in range(200):
        await asyncio.sleep(0.01)
        if started.exists() and len(started.read_text().splitlines()) >= 2:
            break
    await supervisor.stop()
    running.cancel()
    lines = started.read_text().splitlines()
    assert lines[:2] == [
        "--kiosk http://127.0.0.1:7800/",
        "--kiosk http://192.168.1.20:8080/display",
    ]
    assert (tmp_path / "profile").is_dir()
