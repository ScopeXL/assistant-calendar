"""The explicit plugin registry (PLAN §6.1, ADR 0002): no importlib discovery, no runtime
loading. Adding a plugin is an import and one entry here, its models module in db/models.py,
and its folder in frontend/src/features/registry.ts. docs/PLUGINS.md (M5) walks through it.

The calendar is core; calendar_sync (M2) is the first plugin.
"""

from __future__ import annotations

from sunroom.plugins.base import Plugin
from sunroom.plugins.calendar_sync.plugin import PLUGIN as CALENDAR_SYNC

REGISTRY: dict[str, Plugin] = {
    CALENDAR_SYNC.manifest.id: CALENDAR_SYNC,
}
