"""The screensaver plugin object: its manifest, routes and jobs."""

from __future__ import annotations

from fastapi import APIRouter

from sunroom.plugins.base import (
    Contributions,
    DisplayRoom,
    PhoneTab,
    PluginBase,
    PluginManifest,
    SettingsSection,
)
from sunroom.plugins.context import PluginContext
from sunroom.plugins.screensaver.models import EXPORT_COLUMN_EXCLUDED, EXPORT_TABLES, TABLES
from sunroom.plugins.spec import ParamField

INBOX_SCAN_S = 5 * 60
THUMB_BACKLOG_S = 10 * 60

MANIFEST = PluginManifest(
    id="screensaver",
    version="1.0.0",
    name="Photos & Screensaver",
    description="The family's photos on paired screens while nobody's using them.",
    settings_spec=(
        ParamField(
            "start_after",
            "Start after",
            "choice",
            help="How long nobody touches the screen before the photos start.",
            # 10 minutes was a choice until 0.8.0: a stored "10" reads as this default.
            default="15",
            choices=("never", "5", "15", "30", "60"),
            choice_labels=("Never", "5 min", "15 min", "30 min", "1 hour"),
        ),
        ParamField(
            "every",
            "Change photo every",
            "choice",
            default="30",
            choices=("15", "30", "60", "120", "300"),
            choice_labels=("15 s", "30 s", "1 min", "2 min", "5 min"),
        ),
        ParamField(
            "show_clock",
            "Show the clock and what's next",
            "bool",
            default=True,
        ),
        ParamField(
            "shuffle",
            "Shuffle",
            "bool",
            default=True,
        ),
    ),
    tables=TABLES,
    export_tables=EXPORT_TABLES,
    export_column_excluded=EXPORT_COLUMN_EXCLUDED,
    contributes=Contributions(
        display_rooms=(DisplayRoom("photos", "Photos", "image", order=60),),
        phone_tabs=(PhoneTab("photos", "Photos", "image", "/photos", order=60),),
        settings_sections=(SettingsSection("screensaver", "Screensaver"),),
        display_overlay=True,
    ),
    default_enabled=True,
)


class Screensaver(PluginBase):
    def __init__(self) -> None:
        self.manifest = MANIFEST
        self.ctx: PluginContext | None = None

    def register_routes(self, router: APIRouter) -> None:
        from sunroom.plugins.screensaver.router import build

        build(router, self)

    async def on_enable(self, ctx: PluginContext) -> None:
        from sunroom.plugins.screensaver import service

        self.ctx = ctx
        await service.ensure_inbox(ctx)

        async def inbox_scan() -> None:
            await service.scan_inbox(ctx)

        async def thumb_backlog() -> None:
            await service.thumb_backlog(ctx)

        ctx.every("inbox-scan", INBOX_SCAN_S, inbox_scan)
        ctx.every("thumb-backlog", THUMB_BACKLOG_S, thumb_backlog)

    # No on_disable: the context stays, so routes keep answering while a failed job has the
    # plugin errored (PLAN §11.4); switched off, the framework's gate answers for them.

    async def seed_sample(self, ctx: PluginContext, people: dict[str, str]) -> None:
        from sunroom.plugins.screensaver.sample import seed

        await seed(ctx, people)


PLUGIN = Screensaver()
