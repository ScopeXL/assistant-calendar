"""Who a synced event is for (ADR 0034): the people its title names, on top of its calendar's
person; a Who set by hand that the server never undoes; a server-made exception that keeps the
series' people and reminders (R5); a new calendar person who moves with the events. The clock
reads Wednesday 2026-10-07, 10:00 in New York. Synthetic data only."""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from sunroom.app import create_app
from sunroom.calendar.synced import SyncedEvent, SyncedOverride, SyncedSeries
from sunroom.core.clock import FakeClock
from sunroom.domain.recurrence import Timing
from sunroom.plugins.calendar_sync.plugin import CalendarSync
from sunroom.plugins.context import PluginContext
from tests.support import BASE_URL, CSRF, add_member, make_settings, run_setup

NY = "America/New_York"
WEEK = {"from": "2026-10-04", "to": "2026-10-11"}


@pytest.fixture
async def plugin() -> CalendarSync:
    return CalendarSync()


@pytest.fixture
async def sync_app(
    data_dir: Path, clock: FakeClock, plugin: CalendarSync
) -> AsyncIterator[FastAPI]:
    application = create_app(
        make_settings(data_dir), clock=clock, plugins={"calendar_sync": plugin}
    )
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def phone(sync_app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=sync_app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as http:
        assert (await run_setup(http)).status_code == 201
        yield http


@pytest.fixture
async def family(phone: httpx.AsyncClient) -> dict[str, str]:
    return {name: (await add_member(phone, name))["id"] for name in ("Ana", "Sam", "Mia", "Leo")}


def ctx_of(plugin: CalendarSync) -> PluginContext:
    assert plugin.ctx is not None
    return plugin.ctx


def at(hour: int, day: int = 8, minutes: int = 60) -> Timing:
    start = datetime(2026, 10, day, hour, tzinfo=UTC)
    return Timing(all_day=False, start_utc=start, end_utc=start + timedelta(minutes=minutes))


def one_off(uid: str, title: str, etag: str = '"1"', **extra: Any) -> SyncedSeries:
    """Thursday at 4 PM in New York."""
    values: dict[str, Any] = {
        "uid": uid,
        "master": SyncedEvent(title=title, timing=at(20), tzid=NY),
        "remote_id": uid,
        "etag": etag,
        "updated_at": datetime(2026, 10, 1, tzinfo=UTC),
    }
    values.update(extra)
    return SyncedSeries(**values)


async def calendar_of(plugin: CalendarSync, owner: str | None) -> str:
    calendar = await ctx_of(plugin).calendar.create_synced_calendar(
        name="School",
        color="sea",
        owner_member_id=owner,
        read_only=False,
        visible_on_display=True,
        source_label="Google",
    )
    return calendar.id


async def occurrences(phone: httpx.AsyncClient) -> dict[str, dict[str, Any]]:
    """This week's occurrences by title."""
    found = (await phone.get("/api/calendar/occurrences", params=WEEK)).json()["occurrences"]
    return {o["title"]: o for o in found}


async def event(phone: httpx.AsyncClient, event_id: str) -> dict[str, Any]:
    response = await phone.get(f"/api/calendar/events/{event_id}")
    assert response.status_code == 200, response.text
    found: dict[str, Any] = response.json()
    return found


async def test_a_title_names_people_on_top_of_the_calendars_person(
    phone: httpx.AsyncClient, plugin: CalendarSync, family: dict[str, str]
) -> None:
    ana, mia, leo = family["Ana"], family["Mia"], family["Leo"]
    calendar_id = await calendar_of(plugin, ana)
    sync = ctx_of(plugin).calendar
    await sync.upsert_synced(
        calendar_id, [one_off("swim@test", "Mia & Leo's swim"), one_off("dentist@test", "Dentist")]
    )
    shown = await occurrences(phone)
    swim, dentist = shown["Mia & Leo's swim"], shown["Dentist"]
    assert set(swim["member_ids"]) == {ana, mia, leo}
    assert (await event(phone, swim["event_id"]))["people_from_title"] is True
    # Nobody named: no rows, and the calendar's person shows by the fallback.
    assert dentist["member_ids"] == [ana]
    stored = await event(phone, dentist["event_id"])
    assert (stored["member_ids"], stored["people_from_title"]) == ([], True)
    # The server renames it: the title decides again.
    await sync.upsert_synced(calendar_id, [one_off("dentist@test", "Dentist Mia", etag='"2"')])
    assert set((await occurrences(phone))["Dentist Mia"]["member_ids"]) == {ana, mia}


async def test_a_who_set_by_hand_outlasts_the_server(
    phone: httpx.AsyncClient, plugin: CalendarSync, family: dict[str, str], clock: FakeClock
) -> None:
    ana, sam, mia, leo = family["Ana"], family["Sam"], family["Mia"], family["Leo"]
    calendar_id = await calendar_of(plugin, ana)
    sync = ctx_of(plugin).calendar
    await sync.upsert_synced(calendar_id, [one_off("swim@test", "Mia & Leo's swim")])
    event_id = (await occurrences(phone))["Mia & Leo's swim"]["event_id"]
    # The same people sent again (an editor that always sends them) change nothing.
    same = await phone.patch(
        f"/api/calendar/events/{event_id}", json={"member_ids": [ana, mia, leo]}, headers=CSRF
    )
    assert same.status_code == 200, same.text
    assert same.json()["event"]["people_from_title"] is True
    clock.advance(minutes=1)
    picked = await phone.patch(
        f"/api/calendar/events/{event_id}", json={"member_ids": [sam]}, headers=CSRF
    )
    assert picked.json()["event"]["people_from_title"] is False
    # Later, the server renames it: the hand choice stands.
    await sync.upsert_synced(
        calendar_id,
        [
            one_off(
                "swim@test", "Leo's swim", etag='"2"', updated_at=datetime(2026, 10, 9, tzinfo=UTC)
            )
        ],
    )
    swim = (await occurrences(phone))["Leo's swim"]
    assert swim["member_ids"] == [sam]
    assert (await event(phone, event_id))["people_from_title"] is False


async def test_a_server_made_exception_keeps_the_series_people_and_reminders(
    phone: httpx.AsyncClient, plugin: CalendarSync, family: dict[str, str], clock: FakeClock
) -> None:
    """R5: a moved occurrence the server sends on its own was created with nobody on it."""
    mia = family["Mia"]
    calendar_id = await calendar_of(plugin, None)
    sync = ctx_of(plugin).calendar
    # Tuesdays and Thursdays at 4 PM, from this Thursday.
    series = one_off("soccer@test", "Soccer practice", rrule="FREQ=WEEKLY;BYDAY=TU,TH")
    await sync.upsert_synced(calendar_id, [series])
    event_id = next(iter((await occurrences(phone)).values()))["event_id"]
    clock.advance(minutes=1)
    set_up = await phone.patch(
        f"/api/calendar/events/{event_id}",
        json={"member_ids": [mia], "reminders": [30]},
        headers=CSRF,
    )
    assert set_up.status_code == 200, set_up.text
    moved = SyncedSeries(
        uid="soccer@test",
        master=None,
        overrides=(
            SyncedOverride(
                recurrence_id="2026-10-08T16:00:00",
                event=SyncedEvent(title="Soccer practice", timing=at(21), tzid=NY),
                remote_id="soccer_20261008T200000Z",
                etag='"o1"',
            ),
        ),
        updated_at=datetime(2026, 10, 9, tzinfo=UTC),
    )
    await sync.upsert_synced(calendar_id, [moved])
    found = (await phone.get("/api/calendar/occurrences", params=WEEK)).json()["occurrences"]
    thursday = next(o for o in found if o["is_override"])
    assert thursday["start_local"].startswith("2026-10-08T17:00")
    assert (thursday["member_ids"], thursday["reminders"]) == ([mia], [30])


async def test_a_new_calendar_person_moves_with_the_events_the_title_decides(
    phone: httpx.AsyncClient, plugin: CalendarSync, family: dict[str, str]
) -> None:
    ana, sam, mia, leo = family["Ana"], family["Sam"], family["Mia"], family["Leo"]
    calendar_id = await calendar_of(plugin, ana)
    sync = ctx_of(plugin).calendar
    await sync.upsert_synced(
        calendar_id, [one_off("swim@test", "Mia & Leo's swim"), one_off("dentist@test", "Dentist")]
    )
    await sync.update_synced_calendar(calendar_id, owner_member_id=sam)
    shown = await occurrences(phone)
    assert set(shown["Mia & Leo's swim"]["member_ids"]) == {sam, mia, leo}
    assert shown["Dentist"]["member_ids"] == [sam]
    assert ana not in shown["Mia & Leo's swim"]["member_ids"]


async def test_a_person_added_or_renamed_is_found_in_titles(
    phone: httpx.AsyncClient, plugin: CalendarSync, family: dict[str, str]
) -> None:
    ana = family["Ana"]
    calendar_id = await calendar_of(plugin, ana)
    await ctx_of(plugin).calendar.upsert_synced(calendar_id, [one_off("piano@test", "Zoe's piano")])
    assert (await occurrences(phone))["Zoe's piano"]["member_ids"] == [ana]
    zoe = (await add_member(phone, "Zoë", "kid"))["id"]
    assert set((await occurrences(phone))["Zoe's piano"]["member_ids"]) == {ana, zoe}
    renamed = await phone.patch(f"/api/members/{zoe}", json={"name": "Zara"}, headers=CSRF)
    assert renamed.status_code == 200, renamed.text
    assert (await occurrences(phone))["Zoe's piano"]["member_ids"] == [ana]
