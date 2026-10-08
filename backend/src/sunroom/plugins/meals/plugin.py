"""The meals plugin object: its manifest, routes, overlay and jobs."""

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
    SettingsSection,
)
from sunroom.plugins.context import PluginContext
from sunroom.plugins.meals.models import EXPORT_TABLES, TABLES
from sunroom.plugins.spec import ParamField

HOUR_S = 3600

MANIFEST = PluginManifest(
    id="meals",
    version="1.0.0",
    name="Meals",
    description="The week's dinners, saved meals to add in one tap, and Tonight on the wall.",
    settings_spec=(
        ParamField(
            "slots",
            "Which meals",
            "multichoice",
            help="The meals the family plans. Each is a column in Meals.",
            default=["dinner"],
            choices=("breakfast", "lunch", "dinner", "snack"),
            choice_labels=("Breakfast", "Lunch", "Dinner", "Snack"),
        ),
        ParamField(
            "show_on_calendar",
            "Show dinner on the calendar",
            "bool",
            help="Each day's dinner at the top of its day on the board.",
            default=False,
        ),
    ),
    tables=TABLES,
    export_tables=EXPORT_TABLES,
    contributes=Contributions(
        display_panels=(DisplayPanel("tonight", "Tonight"),),
        display_rooms=(DisplayRoom("meals", "Meals", "utensils", order=40),),
        phone_tabs=(PhoneTab("meals", "Meals", "utensils", "/meals", order=40),),
        settings_sections=(SettingsSection("meals", "Meals"),),
    ),
    default_enabled=True,
)


class Meals(PluginBase):
    def __init__(self) -> None:
        self.manifest = MANIFEST
        self.ctx: PluginContext | None = None

    def register_routes(self, router: APIRouter) -> None:
        from sunroom.plugins.meals.router import build

        build(router, self)

    async def on_enable(self, ctx: PluginContext) -> None:
        from sunroom.plugins.meals import service

        self.ctx = ctx

        async def overlay(start: date, end: date, zone: ZoneInfo) -> list[Any]:
            return await service.overlay(ctx, start, end, zone)

        async def prune() -> None:
            await service.prune(ctx)

        ctx.calendar.register_overlay(overlay)
        ctx.every("prune", HOUR_S, prune)

    # No on_disable: the context stays, so routes keep answering while a failed job has the
    # plugin errored (PLAN §11.4); switched off, the framework's gate answers for them, and the
    # overlay answers nothing.

    async def validate_settings(self, ctx: PluginContext, values: dict[str, Any]) -> list[str]:
        if not values.get("slots"):
            return ["Pick at least one meal."]
        return []

    async def seed_sample(self, ctx: PluginContext, people: dict[str, str]) -> None:
        from sunroom.plugins.meals.sample import seed

        await seed(ctx, people)


PLUGIN = Meals()
