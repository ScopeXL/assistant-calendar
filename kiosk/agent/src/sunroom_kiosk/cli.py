"""``sunroom-kiosk``: Sunroom Screen's one command (docs/KIOSK.md).

    sunroom-kiosk run [--port 7800] [--fake pi|desktop] [--fake-sunroom URL] [--dev]
                                  the agent: the API on 127.0.0.1, the browser, the screen's sleep
    sunroom-kiosk openapi [--out FILE]
                                  the API's schema (``just api-types`` makes screen-schema.d.ts)
    sunroom-kiosk screen --method | --ddc-bus NAME
                                  how brightness is set here (sysfs, ddc or none), or the I2C bus
                                  of the screen on connector NAME from ``ddcutil detect --brief``
                                  on stdin (the installer's two questions, as sunroom-screen's)
    sunroom-kiosk status          what the running agent says about this screen
    sunroom-kiosk --version

The service runs ``sunroom-kiosk run``; on a Pi that's the user unit sunroom-kiosk.service.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import cast

import httpx

from sunroom_kiosk import config as settings_file
from sunroom_kiosk import logs, screen
from sunroom_kiosk.version import version

DEFAULT_PORT = 7800
# just kiosk-dev: Vite serves the pages on 5174 and passes /api/screen through to the agent.
DEV_ORIGINS = ("http://127.0.0.1:5174", "http://localhost:5174")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sunroom-kiosk", description="Sunroom Screen: runs a Sunroom wall screen."
    )
    parser.add_argument("--version", action="version", version=f"sunroom-kiosk {version()}")
    commands = parser.add_subparsers(dest="command", required=True)

    run = commands.add_parser("run", help="run the agent (the service does this)")
    run.add_argument("--port", type=int, default=DEFAULT_PORT)
    run.add_argument("--config", type=Path, default=None, help="the settings file")
    run.add_argument(
        "--fake",
        choices=["pi", "desktop"],
        default=None,
        help="a pretend machine: no browser, no commands, nothing changed outside its folder",
    )
    run.add_argument(
        "--fake-sunroom",
        action="append",
        default=[],
        metavar="URL",
        help="with --fake: a Sunroom it finds on the network (asked for real)",
    )
    run.add_argument(
        "--log-level",
        choices=["debug", "info", "warning"],
        default="info",
        help="how much the agent says (the e2e runs keep it to warnings)",
    )
    run.add_argument(
        "--dev",
        action="store_true",
        help="leave the pages to Vite's dev server (just kiosk-dev)",
    )

    schema = commands.add_parser("openapi", help="write the API's OpenAPI schema")
    schema.add_argument("--out", type=Path, default=None)

    helper = commands.add_parser("screen", help="the screen helper's questions, for the installer")
    helper.add_argument("--config", type=Path, default=None)
    what = helper.add_mutually_exclusive_group(required=True)
    what.add_argument("--method", action="store_true")
    what.add_argument("--ddc-bus", metavar="NAME")

    status = commands.add_parser("status", help="what the running agent says about this screen")
    status.add_argument("--port", type=int, default=DEFAULT_PORT)
    return parser


def cmd_run(args: argparse.Namespace) -> int:
    import uvicorn

    from sunroom_kiosk.app import STATIC, create_app
    from sunroom_kiosk.browser import NoBrowser, Supervisor, find_browser, flags
    from sunroom_kiosk.discovery import Discovery, FakeDiscovery
    from sunroom_kiosk.events import EventHub
    from sunroom_kiosk.platform import detect
    from sunroom_kiosk.state import Agent, BrowserLike
    from sunroom_kiosk.updater import FakeUpdater, NoUpdates, UpdaterLike

    logs.setup(getattr(logging, cast(str, args.log_level).upper()))
    log = logs.get("cli")
    port = cast(int, args.port)
    path = cast(Path | None, args.config) or settings_file.config_file()
    fake = cast(str | None, args.fake)
    platform = detect("pi" if fake == "pi" else "desktop" if fake == "desktop" else None)
    hub = EventHub()
    discovery = (
        FakeDiscovery(hub.publish, cast(list[str], args.fake_sunroom))
        if fake
        else Discovery(hub.publish)
    )
    updater: UpdaterLike = FakeUpdater() if fake else NoUpdates()
    found = None if fake else find_browser()
    holder: dict[str, Agent] = {}
    browser: BrowserLike
    if found is None:
        if not fake:
            log.info("No Chromium, Chrome or Edge is installed here; the screen can't open.")
        browser = NoBrowser()
    else:
        profile = settings_file.config_dir() / "profile"
        browser = Supervisor(
            found,
            profile=profile,
            argv=lambda: flags(
                found,
                profile=profile,
                session=holder["agent"].platform.session,
                sunroom_url=holder["agent"].config.url,
            ),
            page=lambda: holder["agent"].start_page(),
            environment=platform.environment,
        )
    agent = Agent(
        port=port,
        config_path=path,
        platform=platform,
        browser=browser,
        updater=updater,
        hub=hub,
        discovery=discovery,
        browser_info=found,
        fake=fake is not None,
        dev_origins=DEV_ORIGINS if args.dev else (),
        # The pretend screen's Sunrooms are on this machine: an address that doesn't answer
        # says so at once, rather than after the real five seconds.
        http=_quick_client if fake else None,
    )
    holder["agent"] = agent
    app = create_app(agent, static=None if args.dev else STATIC, test_routes=bool(fake))
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)
    )
    try:
        asyncio.run(server.serve())
    except OSError as error:
        log.info("Sunroom Screen couldn't start on port %d: %s", port, error)
        return 1
    return 0 if server.started else 1


def _quick_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=0.5))


def cmd_openapi(args: argparse.Namespace) -> int:
    from fastapi.openapi.utils import get_openapi

    from sunroom_kiosk.app import router

    schema = get_openapi(title="Sunroom Screen", version="0", routes=router.routes)
    text = json.dumps(schema, indent=2, sort_keys=True) + "\n"
    out = cast(Path | None, args.out)
    if out is None:
        sys.stdout.write(text)
    else:
        out.write_text(text, encoding="utf-8")
    return 0


def cmd_screen(args: argparse.Namespace) -> int:
    if args.ddc_bus is not None:
        bus = screen.ddc_bus_from_detect(sys.stdin.read(), cast(str, args.ddc_bus))
        if bus is None:
            return 1
        print(bus)
        return 0
    path = cast(Path | None, args.config) or settings_file.config_file()
    try:
        values = settings_file.parse_values(path.read_text(encoding="utf-8"))
    except OSError:
        print("none")
        return 0
    print(screen.brightness_method(screen.settings_from(values), Path("/"))[0])
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    url = f"http://127.0.0.1:{cast(int, args.port)}/api/screen"
    request = urllib.request.Request(url, headers={"Host": f"127.0.0.1:{args.port}"})
    try:
        with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310 - loopback only
            print(json.dumps(json.loads(response.read()), indent=2))
    except (OSError, urllib.error.URLError) as error:
        print(f"Sunroom Screen isn't running here ({error}).", file=sys.stderr)
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    handlers = {
        "run": cmd_run,
        "openapi": cmd_openapi,
        "screen": cmd_screen,
        "status": cmd_status,
    }
    return handlers[cast(str, args.command)](args)
