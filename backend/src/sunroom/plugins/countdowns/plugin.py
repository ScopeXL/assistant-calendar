"""The countdowns plugin object: its manifest, routes, overlay and jobs."""

from __future__ import annotations

from datetime import date
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter

from sunroom.plugins.base import (
    Contributions,
    DisplayPanel,
    DisplayRoom,
    PhoneTab,
    PluginBase,
    PluginManifest,
)
from sunroom.plugins.context import PluginContext
from sunroom.plugins.countdowns.models import EXPORT_TABLES, TABLES
from sunroom.plugins.spec import ParamField

HOUR_S = 3600

MANIFEST = PluginManifest(
    id="countdowns",
    version="1.0.0",
    name="Countdowns",
    description="Days until birthdays, trips and the last day of school.",
    settings_spec=(
        ParamField(
            "birthdays",
            "Count down to birthdays",
            "bool",
            help="Birthdays set in Family count down by themselves.",
            default=True,
        ),
    ),
    tables=TABLES,
    export_tables=EXPORT_TABLES,
    contributes=Contributions(
        display_panels=(DisplayPanel("coming_up", "Coming up"),),
        display_rooms=(DisplayRoom("countdowns", "Countdowns", "hourglass", order=50),),
        phone_tabs=(PhoneTab("countdowns", "Countdowns", "hourglass", "/countdowns", order=50),),
    ),
    default_enabled=True,
)


class Countdowns(PluginBase):
    def __init__(self) -> None:
        self.manifest = MANIFEST
        self.ctx: PluginContext | None = None

    def register_routes(self, router: APIRouter) -> None:
        from sunroom.plugins.countdowns.router import build

        build(router, self)

    async def on_enable(self, ctx: PluginContext) -> None:
        from sunroom.plugins.countdowns import service

        self.ctx = ctx

        async def overlay(start: date, end: date, zone: ZoneInfo) -> list[Any]:
            return await service.overlay(ctx, start, end, zone)

        async def tidy() -> None:
            await service.tidy(ctx)

        ctx.calendar.register_overlay(overlay)
        ctx.every("tidy", HOUR_S, tidy)

    # No on_disable: the context stays, so routes keep answering while a failed job has the
    # plugin errored (PLAN §11.4); switched off, the framework's gate answers for them, and the
    # overlay answers nothing.

    async def seed_sample(self, ctx: PluginContext, people: dict[str, str]) -> None:
        from sunroom.plugins.countdowns.sample import seed

        await seed(ctx, people)


PLUGIN = Countdowns()
