# ADR 0002: Plugins are in-repo modules with runtime switches and explicit registries

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

The calendar is built in. Everything else (synced calendars, lists, chores, meals, countdowns, photos, weather) is a feature a household turns on or off (PLAN §1).

An earlier project's strategy registry already proved a shape for this: an explicit registry dict, a `Protocol` plus a context object, settings forms generated from a spec, and one task per plugin, so a failure is isolated with the status `errored`.

Loading plugins dynamically (importlib discovery, third-party packages) would need a frontend module loader, a security story and a versioned API before anyone needs them.

## Decision

- **Shape.** A plugin is one backend package, `plugins/<id>/`, and one frontend folder, `features/<id>/`. Both are registered by hand: `plugins/registry.py` is a dict, `features/registry.ts` a map of lazy imports. There is no importlib discovery and no runtime-loaded third-party code in v1. People see plugins as **Features** in Settings.
- **Contract** (PLAN §6.2). Each plugin has a `PluginManifest`: id, version, settings spec, the tables it owns, export lists, and what it contributes to the display, the phone and Settings. It implements the `Plugin` protocol. `PluginContext` is the whole world a plugin sees: the clock and zone, its settings, read and write sessions, core facades for members, calendar and photos, the SSRF-guarded HTTP client, encryption and jobs. Plugins never see the engine.
- **Runtime switches.** `plugin_state` keeps each plugin's enabled flag, settings and versions. Enabling and disabling are parent actions. Disabling stops the plugin's runner within 10 s and keeps all its data; its routes answer 404 `plugin_disabled`, and the shell hides its rooms, tabs and panels. All seven v1 plugins default on, and the setup wizard asks which ones the family wants.
- **Isolation.** One asyncio task and queue per enabled plugin. An exception marks only that plugin `errored`; its routes keep working, and a parent sees a quiet "Retry".
- **Settings** are spec-typed JSON in `settings_json`, checked by `coerce_params` on every read and write and shown by one generic form. This is the one place Sunroom allows a key-value blob, so that a plugin setting never needs a core migration.
- **Migrations.** One Alembic history for core and plugins. Plugin tables exist whether or not the plugin is on, and revision slugs start with the plugin id.
- **Two hard rules** go in CLAUDE.md: every plugin works with every other plugin disabled, and plugins never read another plugin's tables. Cross-plugin needs go through core facades and calendar overlays (PLAN §7.6).

## Consequences

- `GET /api/plugins` drives the rail, the tab bar, the Today panel and Settings. The frontend registry only maps ids to code.
- A contract test (`tests/plugins/test_contract.py`) enforces the rules: no engine or cross-plugin imports, every table owned exactly once, every `*_enc`, `*_hash` and `*_fp` column excluded from export, every plugin route 404 when disabled.
- Adding a plugin means a change to this repo. `docs/PLUGINS.md` (M5) gives the steps.
- Third-party plugins would later need entry points, per-plugin migration branches, a version handshake for frontend chunks and an API stability policy (PLAN §6.4). The contract already declares tables and hides the engine, so that step stays incremental.
- M0 ships the framework with an empty registry. Each plugin arrives with its milestone.
