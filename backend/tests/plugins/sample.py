"""Plugins that exist only in tests, to exercise the framework apart from the real ones."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter

from sunroom.plugins.base import (
    Contributions,
    DisplayPanel,
    DisplayRoom,
    HubEvent,
    PhoneTab,
    PluginBase,
    PluginManifest,
    SettingsSection,
)
from sunroom.plugins.context import PluginContext
from sunroom.plugins.spec import ParamField


class SamplePlugin(PluginBase):
    """Counts ticks, records events, serves one route, and fails when told to."""

    def __init__(self, plugin_id: str = "sample", *, name: str = "Sample") -> None:
        self.manifest = PluginManifest(
            id=plugin_id,
            version="1.0.0",
            name=name,
            description="A plugin for tests.",
            settings_spec=(
                ParamField("interval", "How often", "int", default=60, min=1, max=3600),
                ParamField("api_key", "Key", "secret"),
                ParamField(
                    "mode",
                    "Mode",
                    "choice",
                    default="calm",
                    choices=("calm", "busy"),
                    choice_labels=("Calm", "Busy"),
                ),
                ParamField("wake", "Wake at", "time", default="07:00"),
            ),
            contributes=Contributions(
                display_panels=(DisplayPanel("today", "Sample today"),),
                display_rooms=(DisplayRoom("room", "Sample", "sparkles"),),
                phone_tabs=(PhoneTab("tab", "Sample", "sparkles", "/sample"),),
                settings_sections=(SettingsSection("main", "Sample"),),
            ),
            subscribes=("members.",),
        )
        self.ticks = 0
        self.events: list[HubEvent] = []
        self.fail_in: str | None = None  # "enable", "job", "event", "spawn"
        self.disabled = 0
        self.ctx: PluginContext | None = None

    def register_routes(self, router: APIRouter) -> None:
        @router.get("/ping")
        async def ping() -> dict[str, Any]:  # pyright: ignore[reportUnusedFunction]
            return {"pong": True, "ticks": self.ticks}

    async def on_enable(self, ctx: PluginContext) -> None:
        self.ctx = ctx
        if self.fail_in == "enable":
            raise RuntimeError("could not start")
        ctx.every("tick", 0.01, self._tick)
        if self.fail_in == "spawn":
            ctx.spawn("worker", self._broken_worker())

    async def _tick(self) -> None:
        self.ticks += 1
        if self.fail_in == "job":
            raise RuntimeError("the job broke")

    async def _broken_worker(self) -> None:
        await asyncio.sleep(0)
        raise RuntimeError("the worker broke")

    async def on_event(self, ctx: PluginContext, event: HubEvent) -> None:
        self.events.append(event)
        if self.fail_in == "event":
            raise RuntimeError("the event broke")

    async def on_disable(self, ctx: PluginContext) -> None:
        self.disabled += 1

    async def validate_settings(self, ctx: PluginContext, values: dict[str, Any]) -> list[str]:
        if values.get("mode") == "busy" and (values.get("interval") or 0) < 10:
            return ["Busy mode needs an interval of at least 10."]
        return []
