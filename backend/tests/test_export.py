"""Export everything (PLAN §10.4): parent-only, every listed table, never a secret."""

from __future__ import annotations

import httpx

from sunroom.db.export import CORE_EXPORT_TABLES
from tests.support import CSRF, PASSWORD, add_member, set_pin


async def test_the_export_lists_every_exported_table(parent: httpx.AsyncClient) -> None:
    await add_member(parent, "Mia", "kid")
    await set_pin(parent)
    response = await parent.get("/api/export")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["format"] == "sunroom-export"
    # Core's tables, then each enabled plugin's (synced calendars' accounts, minus their secrets).
    assert list(body["data"]) == [*CORE_EXPORT_TABLES, "sync_accounts", "remote_calendars"]
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
