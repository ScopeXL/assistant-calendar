"""Google accounts through the API (ADR 0004): the helper's key, a calendar added by its ID,
and Sign in with Google with its single-use state. Google is scripted (test_google.FakeGoogle)
behind the real guarded client; synthetic data only."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from fastapi import FastAPI

from sunroom.app import create_app
from sunroom.core.clock import FakeClock
from sunroom.plugins.calendar_sync.plugin import CalendarSync
from tests.support import BASE_URL, CSRF, make_settings, run_setup
from tests.sync.test_google import (
    CLIENT_ID,
    CLIENT_SECRET,
    HELPER,
    SCHOOL,
    FakeGoogle,
    key_file,
    resolve_public,
)


@pytest.fixture
def google(clock: FakeClock) -> FakeGoogle:
    return FakeGoogle(clock)


@pytest.fixture
async def sync_app(data_dir: Path, clock: FakeClock, google: FakeGoogle) -> AsyncIterator[FastAPI]:
    application = create_app(
        make_settings(data_dir),
        clock=clock,
        plugins={"calendar_sync": CalendarSync()},
        resolver=resolve_public,
        http_transport=lambda: httpx.MockTransport(google.handle),
    )
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def phone(sync_app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=sync_app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as http:
        assert (await run_setup(http)).status_code == 201
        yield http


async def test_the_helper_shows_its_address_and_adds_a_shared_calendar(
    phone: httpx.AsyncClient, google: FakeGoogle
) -> None:
    added = await phone.post(
        "/api/calendar-sync/accounts/google/service-account",
        json={"key_json": json.dumps(key_file())},
        headers=CSRF,
    )
    assert added.status_code == 201, added.text
    account = added.json()
    assert (account["provider"], account["helper_email"], account["calendars"]) == (
        "google",
        HELPER,
        [],
    )
    assert "private_key" not in added.text
    # Shared with the helper, but it sees it only once it's added by its ID.
    google.add_calendar(SCHOOL, "School", listed=False)
    found = await phone.post(
        f"/api/calendar-sync/accounts/{account['id']}/google/add-calendar",
        json={"calendar_id": SCHOOL},
        headers=CSRF,
    )
    assert found.status_code == 200, found.text
    assert [(c["name"], c["mapped"]) for c in found.json()["calendars"]] == [("School", False)]


async def test_a_file_that_isnt_a_key_says_so(phone: httpx.AsyncClient) -> None:
    response = await phone.post(
        "/api/calendar-sync/accounts/google/service-account",
        json={"key_json": '{"type": "authorized_user"}'},
        headers=CSRF,
    )
    assert response.status_code == 422
    assert response.json()["error"]["message"].startswith("That isn't a Google key file.")


async def start(phone: httpx.AsyncClient, **body: Any) -> httpx.Response:
    return await phone.post("/api/calendar-sync/accounts/google/start", json=body, headers=CSRF)


def query_of(begun: httpx.Response) -> dict[str, list[str]]:
    """The query of the Google page a sign-in sends the browser to."""
    url: str = begun.json()["authorize_url"]
    return parse_qs(urlsplit(url).query)


async def test_sign_in_needs_the_apps_keys_then_comes_back_connected(
    phone: httpx.AsyncClient, google: FakeGoogle
) -> None:
    refused = await start(phone)
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "needs_keys"
    saved = await phone.put(
        "/api/plugins/calendar_sync/settings",
        json={"values": {"google_client_id": CLIENT_ID, "google_client_secret": CLIENT_SECRET}},
        headers=CSRF,
    )
    assert saved.status_code == 200, saved.text
    begun = await start(phone)
    assert begun.status_code == 200, begun.text
    query = query_of(begun)
    assert query["redirect_uri"] == [f"{BASE_URL}/api/calendar-sync/google/callback"]
    assert query["code_challenge_method"] == ["S256"]
    state, challenge = query["state"][0], query["code_challenge"][0]
    # The person signs in at Google, which sends the browser back with a code.
    google.redirect = f"{BASE_URL}/api/calendar-sync/google/callback"
    google.codes["sample-code"] = challenge
    google.add_calendar(SCHOOL, "School")
    back = await phone.get(
        "/api/calendar-sync/google/callback",
        params={"code": "sample-code", "state": state},
    )
    assert back.status_code == 303
    assert back.headers["location"].startswith("/settings/calendars?google=connected&account=")
    accounts = (await phone.get("/api/calendar-sync/accounts")).json()
    assert [(a["provider"], [c["name"] for c in a["calendars"]]) for a in accounts] == [
        ("google", ["School"])
    ]
    # A state works once.
    again = await phone.get(
        "/api/calendar-sync/google/callback",
        params={"code": "sample-code", "state": state},
    )
    assert again.headers["location"] == "/settings/calendars?google=expired"


async def test_saying_no_at_google_comes_back_quietly(phone: httpx.AsyncClient) -> None:
    await phone.put(
        "/api/plugins/calendar_sync/settings",
        json={"values": {"google_client_id": CLIENT_ID, "google_client_secret": CLIENT_SECRET}},
        headers=CSRF,
    )
    state = query_of(await start(phone))["state"][0]
    back = await phone.get(
        "/api/calendar-sync/google/callback",
        params={"error": "access_denied", "state": state},
    )
    assert back.headers["location"] == "/settings/calendars?google=denied"
    assert (await phone.get("/api/calendar-sync/accounts")).json() == []
