"""Export all household data as JSON (PLAN §10.4, §14.4).

Every table must be listed exactly once: here for core, or in a plugin's manifest (its
``export_tables``; the rest of its ``tables`` are excluded). A test fails otherwise, which forces
a decision whenever a table is added. Columns that hold secrets (``*_enc``, ``*_hash``, ``*_fp``)
never leave, whichever table they're in.
"""

from __future__ import annotations

import base64
from collections.abc import Mapping
from datetime import date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sunroom.db.models import Base
from sunroom.plugins.base import Plugin

CORE_EXPORT_TABLES: tuple[str, ...] = (
    "household",
    "members",
    "kiosk_panels",
    "network_allowlist",
    "photos",
    "plugin_state",
)
# Not household data: secrets, sessions and the app's own bookkeeping.
CORE_EXPORT_EXCLUDED: tuple[str, ...] = (
    "app_meta",
    "devices",
    "join_codes",
)
# Exported tables' columns that never leave (PLAN §10.4).
CORE_COLUMN_EXCLUDED: dict[str, frozenset[str]] = {
    "household": frozenset({"parent_pin_hash"}),
}
SECRET_SUFFIXES = ("_enc", "_hash", "_fp")
FORMAT = "sunroom-export"
FORMAT_VERSION = 1


def _plain(value: Any) -> Any:
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, bytes):
        return base64.b64encode(value).decode()
    return value


def export_plan(plugins: Mapping[str, Plugin]) -> tuple[list[str], dict[str, frozenset[str]]]:
    """The tables to export, in order, and the columns each one leaves out."""
    tables = list(CORE_EXPORT_TABLES)
    excluded = dict(CORE_COLUMN_EXCLUDED)
    for plugin in plugins.values():
        tables.extend(plugin.manifest.export_tables)
        excluded.update(plugin.manifest.export_column_excluded)
    return tables, excluded


async def export_data(
    session: AsyncSession,
    *,
    plugins: Mapping[str, Plugin],
    app_version: str,
    schema_revision: str | None,
    exported_at: datetime,
) -> dict[str, Any]:
    tables, excluded = export_plan(plugins)
    data: dict[str, list[dict[str, Any]]] = {}
    for name in tables:
        table = Base.metadata.tables[name]
        drop = excluded.get(name, frozenset())
        rows = await session.execute(select(table))
        data[name] = [
            {
                key: _plain(value)
                for key, value in row.items()
                if key not in drop and not key.endswith(SECRET_SUFFIXES)
            }
            for row in rows.mappings()
        ]
    return {
        "format": FORMAT,
        "format_version": FORMAT_VERSION,
        "app_version": app_version,
        "schema_revision": schema_revision,
        "exported_at": exported_at.isoformat(),
        "data": data,
    }
