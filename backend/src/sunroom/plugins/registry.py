"""The explicit plugin registry (PLAN §6.1, ADR 0002): no importlib discovery, no runtime
loading. Adding a plugin is an import and one entry here, its models module in db/models.py,
and its folder in frontend/src/features/registry.ts. docs/PLUGINS.md (M5) walks through it.

The calendar is core; calendar_sync arrived in M2, lists and chores in M3, meals, countdowns,
screensaver and weather in M4.
"""

from __future__ import annotations

from sunroom.plugins.base import Plugin
from sunroom.plugins.calendar_sync.plugin import PLUGIN as CALENDAR_SYNC
from sunroom.plugins.chores.plugin import PLUGIN as CHORES
from sunroom.plugins.countdowns.plugin import PLUGIN as COUNTDOWNS
from sunroom.plugins.lists.plugin import PLUGIN as LISTS
from sunroom.plugins.meals.plugin import PLUGIN as MEALS
from sunroom.plugins.screensaver.plugin import PLUGIN as SCREENSAVER
from sunroom.plugins.weather.plugin import PLUGIN as WEATHER

REGISTRY: dict[str, Plugin] = {
    CALENDAR_SYNC.manifest.id: CALENDAR_SYNC,
    LISTS.manifest.id: LISTS,
    CHORES.manifest.id: CHORES,
    MEALS.manifest.id: MEALS,
    COUNTDOWNS.manifest.id: COUNTDOWNS,
    SCREENSAVER.manifest.id: SCREENSAVER,
    WEATHER.manifest.id: WEATHER,
}
