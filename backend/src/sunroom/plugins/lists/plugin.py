"""The lists plugin object: its manifest, routes and jobs."""

from __future__ import annotations

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
from sunroom.plugins.lists.models import EXPORT_TABLES, TABLES
from sunroom.plugins.spec import ParamField

HOUR_S = 3600

MANIFEST = PluginManifest(
    id="lists",
    version="1.0.0",
    name="Lists",
    description="Groceries, to-dos and packing lists that everyone adds to and checks off.",
    settings_spec=(
        ParamField(
            "auto_clear_days",
            "Clear done items by themselves",
            "choice",
            help="Checked items leave Done on their own after this long.",
            default="never",
            choices=("never", "1", "3", "7"),
            choice_labels=("Never", "After a day", "After 3 days", "After a week"),
        ),
    ),
    tables=TABLES,
    export_tables=EXPORT_TABLES,
    contributes=Contributions(
        display_panels=(DisplayPanel("todo", "To Do"),),
        display_rooms=(DisplayRoom("lists", "Lists", "list", order=20),),
        phone_tabs=(PhoneTab("lists", "Lists", "list", "/lists", order=20),),
    ),
    default_enabled=True,
)


class Lists(PluginBase):
    def __init__(self) -> None:
        self.manifest = MANIFEST
        self.ctx: PluginContext | None = None

    def register_routes(self, router: APIRouter) -> None:
        from sunroom.plugins.lists.router import build

        build(router, self)

    async def on_enable(self, ctx: PluginContext) -> None:
        from sunroom.plugins.lists import service

        self.ctx = ctx

        async def tidy() -> None:
            await service.auto_clear(ctx)
            await service.prune(ctx)

        ctx.every("tidy", HOUR_S, tidy)

    # No on_disable: the context stays, so routes keep answering while a failed job has the
    # plugin errored (PLAN §11.4); switched off, the framework's gate answers for them.

    async def seed_sample(self, ctx: PluginContext, people: dict[str, str]) -> None:
        from sunroom.plugins.lists.sample import seed

        await seed(ctx, people)


PLUGIN = Lists()
