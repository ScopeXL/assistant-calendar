"""Accounts through the API (PLAN §11.2): a calendar address added and on the board at once, a
private address refused until a parent allows it, holidays, mapping to people, disconnecting.
Feeds come from a scripted server behind the real guarded client; synthetic data only."""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from sunroom.app import create_app
from sunroom.core.clock import FakeClock
from sunroom.plugins.calendar_sync.plugin import CalendarSync
from tests.support import BASE_URL, CSRF, add_member, make_settings, run_setup

PUBLIC = "93.184.216.34"  # a public address, resolved for every test host
FEED = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sample//Test feed//EN
X-WR-CALNAME:School
BEGIN:VEVENT
UID:pajama-day@school.example.com
DTSTART;VALUE=DATE:20261009
SUMMARY:Pajama day
END:VEVENT
BEGIN:VEVENT
UID:field-trip@school.example.com
DTSTART;TZID=America/New_York:20261008T090000
DTEND;TZID=America/New_York:20261008T130000
SUMMARY:Field trip
LOCATION:Sample Farm
END:VEVENT
END:VCALENDAR
"""


class FeedServer:
    """The scripted feed server: answers by path, counts requests, honours If-None-Match."""

    def __init__(self) -> None:
        self.feeds: dict[str, str] = {"/school.ics": FEED}
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        body = self.feeds.get(request.url.path)
        if body is None:
            return httpx.Response(404)
        etag = f'"{hash(body) & 0xFFFF:x}"'
        if request.headers.get("if-none-match") == etag:
            return httpx.Response(304)
        return httpx.Response(
            200, text=body, headers={"content-type": "text/calendar", "etag": etag}
        )

    def transport(self) -> Callable[[], httpx.AsyncBaseTransport]:
        return lambda: httpx.MockTransport(self.handler)


async def resolve(host: str, port: int) -> list[str]:
    return [PUBLIC]


@pytest.fixture
def feeds() -> FeedServer:
    return FeedServer()


@pytest.fixture
async def sync_app(data_dir: Path, clock: FakeClock, feeds: FeedServer) -> AsyncIterator[FastAPI]:
    plugin = CalendarSync()
    application = create_app(
        make_settings(data_dir),
        clock=clock,
        plugins={"calendar_sync": plugin},
        resolver=resolve,
        http_transport=feeds.transport(),
    )
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def phone(sync_app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=sync_app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as http:
        response = await run_setup(http)
        assert response.status_code == 201, response.text
        yield http


async def week(phone: httpx.AsyncClient) -> list[dict[str, Any]]:
    response = await phone.get(
        "/api/calendar/occurrences", params={"from": "2026-10-04", "to": "2026-10-11"}
    )
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()["occurrences"]
    return found


async def test_a_calendar_address_is_on_the_board_at_once(
    phone: httpx.AsyncClient, feeds: FeedServer
) -> None:
    mia = await add_member(phone, "Mia", role="kid")
    added = await phone.post(
        "/api/calendar-sync/accounts/ics",
        json={"url": "webcal://school.example.com/school.ics", "owner_member_id": mia["id"]},
        headers=CSRF,
    )
    assert added.status_code == 201, added.text
    account = added.json()
    assert (account["label"], account["provider"], account["status"]) == (
        "School",
        "ics",
        "connected",
    )
    assert account["address"] == "school.example.com/school.ics"
    assert account["read_only"] is True
    assert [(c["name"], c["mapped"], c["owner_member_id"]) for c in account["calendars"]] == [
        ("School", True, mia["id"])
    ]
    found = await week(phone)
    assert [(o["title"], o["member_ids"], o["read_only"]) for o in found] == [
        ("Field trip", [mia["id"]], True),
        ("Pajama day", [mia["id"]], True),
    ]
    assert feeds.requests[0].url.scheme == "https"  # webcal:// became https://
    # It shows events only.
    trip = found[0]
    refused = await phone.patch(
        f"/api/calendar/events/{trip['event_id']}", json={"title": "Trip"}, headers=CSRF
    )
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "calendar_read_only"
    assert "a calendar address" in refused.json()["error"]["message"]


async def test_an_address_that_isnt_a_calendar_says_so(
    phone: httpx.AsyncClient, feeds: FeedServer
) -> None:
    feeds.feeds["/page.html"] = "<html>not a calendar</html>"
    for path, message in (
        ("/page.html", "That address didn't give us a calendar"),
        ("/missing.ics", "That calendar address doesn't work any more"),
    ):
        response = await phone.post(
            "/api/calendar-sync/accounts/ics",
            json={"url": f"https://school.example.com{path}"},
            headers=CSRF,
        )
        assert response.status_code == 422, response.text
        assert response.json()["error"]["message"].startswith(message)
    assert (await phone.get("/api/calendar-sync/accounts")).json() == []


async def test_a_private_address_waits_for_a_parent_to_allow_it(phone: httpx.AsyncClient) -> None:
    body = {"url": "http://192.168.1.20/school.ics"}
    refused = await phone.post("/api/calendar-sync/accounts/ics", json=body, headers=CSRF)
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "address_failed"
    assert "home network" in refused.json()["error"]["message"]
    # Ticking the box isn't enough on its own; the address must be on the allowlist too.
    ticked = await phone.post(
        "/api/calendar-sync/accounts/ics", json=body | {"allow_private": True}, headers=CSRF
    )
    assert ticked.status_code == 422
    allowed = await phone.post(
        "/api/network-allowlist",
        json={"target": "192.168.1.20", "label": "Sample NAS"},
        headers=CSRF,
    )
    assert allowed.status_code in {200, 201}, allowed.text
    added = await phone.post(
        "/api/calendar-sync/accounts/ics", json=body | {"allow_private": True}, headers=CSRF
    )
    assert added.status_code == 201, added.text


async def test_holidays_need_no_address(phone: httpx.AsyncClient) -> None:
    places = (await phone.get("/api/calendar-sync/holidays/places")).json()
    assert any(p["country"] == "US" and "CA" in p["subdivisions"] for p in places)
    added = await phone.post(
        "/api/calendar-sync/accounts/holidays",
        json={"country": "us", "subdivision": "ca"},
        headers=CSRF,
    )
    assert added.status_code == 201, added.text
    assert added.json()["label"] == "Holidays · US-CA"
    response = await phone.get(
        "/api/calendar/occurrences", params={"from": "2026-12-20", "to": "2026-12-31"}
    )
    assert "Christmas Day" in [o["title"] for o in response.json()["occurrences"]]
    unknown = await phone.post(
        "/api/calendar-sync/accounts/holidays", json={"country": "ZZ"}, headers=CSRF
    )
    assert unknown.status_code == 422


async def test_mapping_sets_the_person_and_color_and_disconnecting_clears_the_board(
    phone: httpx.AsyncClient,
) -> None:
    added = await phone.post(
        "/api/calendar-sync/accounts/ics",
        json={"url": "https://school.example.com/school.ics"},
        headers=CSRF,
    )
    account = added.json()
    row = account["calendars"][0]
    assert {o["color"] for o in await week(phone)} == {"sea"}  # Everyone's: the calendar's color
    sam = await add_member(phone, "Sam")
    mapped = await phone.put(
        f"/api/calendar-sync/accounts/{account['id']}/calendars/{row['id']}",
        json={"owner_member_id": sam["id"]},
        headers=CSRF,
    )
    assert mapped.status_code == 200, mapped.text
    found = await week(phone)
    assert {tuple(o["member_ids"]) for o in found} == {(sam["id"],)}
    assert {o["color"] for o in found} == {None}  # the person's color now, from their id
    gone = await phone.delete(f"/api/calendar-sync/accounts/{account['id']}", headers=CSRF)
    assert gone.status_code == 204
    assert await week(phone) == []
    assert (await phone.get("/api/calendar-sync/accounts")).json() == []


async def test_a_device_that_isnt_signed_in_cant_add_accounts(
    phone: httpx.AsyncClient, sync_app: FastAPI
) -> None:
    transport = httpx.ASGITransport(app=sync_app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as other:
        response = await other.post(
            "/api/calendar-sync/accounts/ics",
            json={"url": "https://school.example.com/school.ics"},
            headers=CSRF,
        )
        assert response.status_code in {401, 403}


async def test_a_shared_calendar_takes_a_color_nobody_has(phone: httpx.AsyncClient) -> None:
    ana = await phone.post(
        "/api/members", json={"name": "Ana", "role": "parent", "color": "sea"}, headers=CSRF
    )
    assert ana.status_code == 201, ana.text
    added = await phone.post(
        "/api/calendar-sync/accounts/ics",
        json={"url": "https://school.example.com/school.ics"},
        headers=CSRF,
    )
    color = added.json()["calendars"][0]["color"]
    assert color not in {"sea", "sky"}  # Ana's, and the Home calendar's
