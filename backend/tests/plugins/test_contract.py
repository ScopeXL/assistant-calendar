"""The plugin contract (PLAN §6.2), checked for every registered plugin and for core.

Empty-registry checks still run today: table ownership and secret columns cover core, and each
plugin added later is checked by the same tests without anyone remembering to.
"""

from __future__ import annotations

import ast
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute

import sunroom.plugins
from sunroom.app import create_app
from sunroom.db.export import (
    CORE_COLUMN_EXCLUDED,
    CORE_EXPORT_EXCLUDED,
    CORE_EXPORT_TABLES,
    SECRET_SUFFIXES,
)
from sunroom.db.models import Base
from sunroom.plugins.base import PLUGIN_ID, Plugin
from sunroom.plugins.registry import REGISTRY
from sunroom.plugins.spec import coerce_params, defaults
from tests.plugins.sample import SamplePlugin
from tests.support import BASE_URL, make_settings, run_setup

PLUGINS_DIR = Path(sunroom.plugins.__file__).parent
FRAMEWORK = {
    "__init__.py",
    "base.py",
    "context.py",
    "manager.py",
    "models.py",
    "registry.py",
    "router.py",
    "spec.py",
}
CORE_TABLES = set(CORE_EXPORT_TABLES) | set(CORE_EXPORT_EXCLUDED)
# What a plugin may never import (PLAN §6.2): the engine, app state, the app itself.
FORBIDDEN = ("sunroom.db.engine", "sunroom.state", "sunroom.app", "sunroom.boot")

registered = pytest.mark.parametrize(
    "plugin", list(REGISTRY.values()) or [pytest.param(None, marks=pytest.mark.skip("none yet"))]
)


def owners() -> dict[str, list[str]]:
    owned: dict[str, list[str]] = {table: ["core"] for table in CORE_TABLES}
    for plugin in REGISTRY.values():
        for table in plugin.manifest.tables:
            owned.setdefault(table, []).append(plugin.manifest.id)
    return owned


def test_every_table_is_owned_by_exactly_one_of_core_or_a_plugin() -> None:
    owned = owners()
    tables = set(Base.metadata.tables)
    assert sorted(tables - set(owned)) == [], "tables nobody owns: list them in db/export.py"
    assert sorted(set(owned) - tables) == [], "listed tables that don't exist"
    assert {table: who for table, who in owned.items() if len(who) > 1} == {}


def test_core_tables_are_listed_once_as_exported_or_excluded() -> None:
    assert not set(CORE_EXPORT_TABLES) & set(CORE_EXPORT_EXCLUDED)


def test_secret_columns_never_reach_the_export() -> None:
    """Every *_enc, *_hash and *_fp column is in an excluded table, or dropped (PLAN §10.4)."""
    exported = set(CORE_EXPORT_TABLES)
    for plugin in REGISTRY.values():
        exported |= set(plugin.manifest.export_tables)
    column_excluded = dict(CORE_COLUMN_EXCLUDED)
    for plugin in REGISTRY.values():
        column_excluded.update(plugin.manifest.export_column_excluded)
    leaks = [
        f"{table}.{column.name}"
        for table in exported
        for column in Base.metadata.tables[table].columns
        if column.name.endswith(SECRET_SUFFIXES)
        and column.name not in column_excluded.get(table, frozenset())
    ]
    assert leaks == [], "list these in export_column_excluded (export.py drops them anyway)"


@registered
def test_manifest_is_well_formed(plugin: Plugin) -> None:
    manifest = plugin.manifest
    assert PLUGIN_ID.match(manifest.id)
    assert REGISTRY[manifest.id] is plugin
    assert set(manifest.export_tables) <= set(manifest.tables)
    assert all(table not in CORE_TABLES for table in manifest.tables)


@registered
def test_spec_defaults_round_trip(plugin: Plugin) -> None:
    spec = plugin.manifest.settings_spec
    values, problems = coerce_params(spec, defaults(spec))
    assert problems == []
    assert coerce_params(spec, values, previous=values) == (values, [])


@registered
def test_plugin_models_reference_only_core_tables_or_their_own(plugin: Plugin) -> None:
    own = set(plugin.manifest.tables)
    for table_name in own:
        for key in Base.metadata.tables[table_name].foreign_keys:
            target = key.column.table.name
            assert target in own or target in CORE_TABLES, f"{table_name} → {target}"


def _plugin_packages() -> list[Path]:
    return sorted(
        path for path in PLUGINS_DIR.iterdir() if path.is_dir() and path.name != "__pycache__"
    )


def test_plugin_code_keeps_to_the_context() -> None:
    """No plugin imports the engine, app state, the app, or another plugin (PLAN §6.2)."""
    for package in _plugin_packages():
        for path in package.rglob("*.py"):
            for node in ast.walk(ast.parse(path.read_text())):
                names: list[str] = []
                if isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
                    names = [node.module]
                for name in names:
                    assert not name.startswith(FORBIDDEN), f"{path}: imports {name}"
                    if name.startswith("sunroom.plugins."):
                        part = name.split(".")[2]
                        assert part in {package.name, *(f[:-3] for f in FRAMEWORK)}, (
                            f"{path}: imports another plugin ({name})"
                        )


def test_the_framework_folder_holds_only_the_framework() -> None:
    files = {path.name for path in PLUGINS_DIR.glob("*.py")}
    assert files == FRAMEWORK


async def test_every_plugin_route_is_gated(data_dir: Path) -> None:
    """While off, every route a plugin registers answers 404 plugin_disabled."""
    plugins: dict[str, Plugin] = {**REGISTRY, "sample": SamplePlugin()}
    app: FastAPI = create_app(make_settings(data_dir), plugins=plugins)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as client:
            await run_setup(client)
            for route in app.routes:
                if not isinstance(route, APIRoute):
                    continue
                for plugin in plugins.values():
                    prefix = f"/api/{plugin.manifest.url_prefix}/"
                    if route.path.startswith(prefix) and "GET" in (route.methods or set()):
                        response = await client.get(route.path)
                        assert response.status_code == 404, route.path
                        assert response.json()["error"]["code"] == "plugin_disabled"
