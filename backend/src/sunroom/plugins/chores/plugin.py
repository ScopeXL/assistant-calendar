"""The chores plugin object: its manifest, routes and jobs (ADR 0019, ADR 0025)."""

from __future__ import annotations

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
from sunroom.plugins.chores.models import EXPORT_TABLES, TABLES
from sunroom.plugins.context import PluginContext
from sunroom.plugins.spec import ParamField

HOUR_S = 3600

MANIFEST = PluginManifest(
    id="chores",
    version="1.0.0",
    name="Chores",
    description="Chores for each person or anyone, with stars, rewards and routines.",
    settings_spec=(
        ParamField(
            "stars",
            "Stars",
            "bool",
            help="Chores give stars, and children see their own.",
            default=True,
        ),
        ParamField(
            "rewards",
            "Rewards",
            "bool",
            help="Stars buy rewards a parent says yes to.",
            default=True,
        ),
        ParamField(
            "routines",
            "Routines",
            "bool",
            help="Morning and bedtime checklists children run on their own.",
            default=True,
        ),
        ParamField(
            "approval",
            "A parent checks finished chores",
            "bool",
            help="Stars arrive once a parent says a chore is done. Each chore can say otherwise.",
            default=False,
        ),
    ),
    tables=TABLES,
    export_tables=EXPORT_TABLES,
    contributes=Contributions(
        display_panels=(DisplayPanel("today", "Chores Today"),),
        display_rooms=(DisplayRoom("chores", "Chores", "check", order=30),),
        phone_tabs=(PhoneTab("chores", "Chores", "check", "/chores", order=30),),
        settings_sections=(SettingsSection("chores", "Chores"),),
    ),
    default_enabled=True,
)


class Chores(PluginBase):
    def __init__(self) -> None:
        self.manifest = MANIFEST
        self.ctx: PluginContext | None = None

    def register_routes(self, router: APIRouter) -> None:
        from sunroom.plugins.chores.router import build

        build(router, self)

    async def on_enable(self, ctx: PluginContext) -> None:
        from sunroom.plugins.chores import service

        self.ctx = ctx

        async def prune() -> None:
            await service.prune(ctx)

        ctx.every("prune", HOUR_S, prune)

    # No on_disable: the context stays, so routes keep answering while a failed job has the
    # plugin errored (PLAN §11.4); switched off, the framework's gate answers for them.

    async def seed_sample(self, ctx: PluginContext, people: dict[str, str]) -> None:
        from sunroom.plugins.chores.sample import seed

        await seed(ctx, people)


PLUGIN = Chores()
