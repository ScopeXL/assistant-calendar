"""The explicit plugin registry (PLAN §6.1, ADR 0002): no importlib discovery, no runtime
loading. Adding a plugin is an import and one entry here, its models module in db/models.py,
and its folder in frontend/src/features/registry.ts. docs/PLUGINS.md (M5) walks through it.

Empty in M0: the calendar is core, and the first plugin (calendar_sync) arrives in M2.
"""

from __future__ import annotations

from sunroom.plugins.base import Plugin

REGISTRY: dict[str, Plugin] = {}
