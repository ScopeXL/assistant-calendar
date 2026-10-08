"""The meals plugin's rules (a stub until it lands)."""

from __future__ import annotations

from datetime import date
from typing import Any
from zoneinfo import ZoneInfo

from sunroom.plugins.context import PluginContext


async def overlay(ctx: PluginContext, start: date, end: date, zone: ZoneInfo) -> list[Any]:
    return []


async def prune(ctx: PluginContext) -> None:
    return None
