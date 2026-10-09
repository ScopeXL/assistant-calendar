"""Birthdays on the calendar, the core's own overlay (PLAN §7.6, ADR 0028): an all-day chip in
the person's color on each year's day, never before the birthday itself, February 29 on the 28th
in other years, nothing for a removed person or one with no birthday. Every app here runs with no
plugins at all, so it works whichever plugins a family turns off. The fake clock reads Wednesday
2026-10-07. The Sample Family only."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from sunroom.app import create_app
from sunroom.core.clock import FakeClock
from sunroom.core.config import Settings
from tests.support import CSRF, add_member

Json = dict[str, Any]


@pytest.fixture
async def app(settings: Settings, clock: FakeClock) -> AsyncIterator[FastAPI]:
    """Sunroom with no plugins: birthdays are the core's, not a plugin's."""
    application = create_app(settings, clock=clock, plugins={}, ping_interval_s=0.05)
    async with application.router.lifespan_context(application):
        yield application


async def birthdays(client: httpx.AsyncClient, start: str, end: str) -> list[Json]:
    response = await client.get(
        "/api/calendar/occurrences", params={"from": start, "to": end, "overlays": "birthdays"}
    )
    assert response.status_code == 200, response.text
    found: list[Json] = response.json()["occurrences"]
    return found


def days(found: list[Json]) -> list[tuple[str, str]]:
    return [(item["title"], item["start_date"]) for item in found]


async def test_a_birthday_is_an_all_day_chip_in_the_persons_color(
    parent: httpx.AsyncClient,
) -> None:
    mia = await add_member(parent, "Mia", "kid", color="rose", birthday="2018-10-20")
    found = await birthdays(parent, "2026-10-18", "2026-10-25")
    assert found == [
        {
            "key": f"birthdays|{mia['id']}|2026-10-20",
            "event_id": None,
            "recurrence_id": None,
            "calendar_id": None,
            "title": "Mia's birthday",
            "location": "",
            "all_day": True,
            "start_utc": None,
            "end_utc": None,
            "start_local": None,
            "end_local": None,
            "start_date": "2026-10-20",
            "end_date": "2026-10-21",
            "member_ids": [mia["id"]],
            "color": "rose",
            "calendar_color": None,
            "is_recurring": False,
            "is_override": False,
            "read_only": True,
            "source": "birthdays",
            "pending": False,
            "status": "confirmed",
            "overlay": "birthdays",
            "reminders": [],
            "version": 0,
        }
    ]
    # The same day asked for in another range is the same chip.
    assert [item["key"] for item in await birthdays(parent, "2026-10-01", "2026-11-01")] == [
        found[0]["key"]
    ]
    # Unasked, the calendar is events only.
    plain = await parent.get(
        "/api/calendar/occurrences", params={"from": "2026-10-18", "to": "2026-10-25"}
    )
    assert plain.json()["occurrences"] == []


async def test_february_29_comes_round_on_the_28th_in_other_years(
    parent: httpx.AsyncClient,
) -> None:
    await add_member(parent, "Leo", "kid", birthday="2016-02-29")
    assert days(await birthdays(parent, "2027-02-01", "2027-03-01")) == [
        ("Leo's birthday", "2027-02-28")
    ]
    assert days(await birthdays(parent, "2028-02-01", "2028-03-01")) == [
        ("Leo's birthday", "2028-02-29")
    ]


async def test_only_people_here_with_a_birthday_and_never_before_it(
    parent: httpx.AsyncClient,
) -> None:
    await add_member(parent, "Ana", birthday="1988-10-12")
    await add_member(parent, "Sam")  # no birthday
    gone = await add_member(parent, "Pat", birthday="1990-10-13")
    archived = await parent.post(f"/api/members/{gone['id']}/archive", headers=CSRF)
    assert archived.status_code == 200, archived.text
    await add_member(parent, "Zoe", "kid", birthday="2027-10-14")  # on the way
    assert days(await birthdays(parent, "2026-10-04", "2026-10-18")) == [
        ("Ana's birthday", "2026-10-12")
    ]
    assert days(await birthdays(parent, "2027-10-04", "2027-10-18")) == [
        ("Ana's birthday", "2027-10-12"),
        ("Zoe's birthday", "2027-10-14"),
    ]


async def test_a_changed_birthday_shows_at_once(parent: httpx.AsyncClient) -> None:
    mia = await add_member(parent, "Mia", "kid", birthday="2017-10-19")
    assert days(await birthdays(parent, "2026-10-04", "2026-10-11")) == []
    moved = await parent.patch(
        f"/api/members/{mia['id']}", json={"birthday": "2017-10-08"}, headers=CSRF
    )
    assert moved.status_code == 200, moved.text
    assert days(await birthdays(parent, "2026-10-04", "2026-10-11")) == [
        ("Mia's birthday", "2026-10-08")
    ]
