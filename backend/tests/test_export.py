"""Export everything (PLAN §10.4): parent-only, every listed table, never a secret."""

from __future__ import annotations

import json

import httpx

from sunroom.db.export import CORE_EXPORT_TABLES
from sunroom.plugins.chores.models import TABLES as CHORES_TABLES
from tests.support import CSRF, PASSWORD, add_member, set_pin


async def test_the_export_lists_every_exported_table(parent: httpx.AsyncClient) -> None:
    await add_member(parent, "Mia", "kid")
    await set_pin(parent)
    response = await parent.get("/api/export")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["format"] == "sunroom-export"
    # Core's tables, then each enabled plugin's (synced calendars' accounts minus their secrets,
    # lists, chores, meals, countdowns, photo sources; the weather's cache stays behind).
    assert list(body["data"]) == [
        *CORE_EXPORT_TABLES,
        "sync_accounts",
        "remote_calendars",
        "lists",
        "list_items",
        *CHORES_TABLES,
        "saved_meals",
        "meal_entries",
        "countdowns",
        "photo_sources",
    ]
    assert [m["name"] for m in body["data"]["members"]] == ["Mia"]
    household = body["data"]["household"][0]
    assert household["name"] == "Sample Family"
    assert "parent_pin_hash" not in household
    assert "pin_length" not in household
    text = response.text
    assert "pbkdf2_sha256" not in text and "scrypt$" not in text


async def test_the_export_is_for_parents(
    parent: httpx.AsyncClient, other: httpx.AsyncClient
) -> None:
    await set_pin(parent)
    await other.post(
        "/api/auth/kiosk/pair-with-password", json={"password": PASSWORD}, headers=CSRF
    )
    assert (await other.get("/api/export")).status_code == 403


async def test_a_plugins_secret_setting_never_leaves_in_the_export(
    parent: httpx.AsyncClient,
) -> None:
    """Google's client secret is a plugin setting, kept in plugin_state.settings_json."""
    saved = await parent.put(
        "/api/plugins/calendar_sync/settings",
        json={
            "values": {
                "google_client_id": "sample-client-id.apps.example.com",
                "google_client_secret": "sample-client-secret-0001",
            }
        },
        headers=CSRF,
    )
    assert saved.status_code == 200, saved.text
    response = await parent.get("/api/export")
    assert response.status_code == 200
    assert "sample-client-secret-0001" not in response.text
    rows = {row["plugin_id"]: row for row in response.json()["data"]["plugin_state"]}
    settings = json.loads(rows["calendar_sync"]["settings_json"])
    # The ID isn't a secret and stays; the secret says only that one is set.
    assert settings == {
        "google_client_id": "sample-client-id.apps.example.com",
        "google_client_secret": "***",
    }
    # Every other plugin's settings still leave as they are.
    assert json.loads(rows["lists"]["settings_json"]) == {"auto_clear_days": "never"}
