"""Merging what a server sends (PLAN §7.5) through the plugin's calendar facade: occurrences
changed on their own, and occurrence etags. The clock reads Wednesday 2026-10-07, 10:00 in New
York. Synthetic data only."""

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
from tests.support import BASE_URL, CSRF, make_settings, run_setup

NY = "America/New_York"


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


def ctx_of(plugin: CalendarSync) -> PluginContext:
    assert plugin.ctx is not None
    return plugin.ctx


def at(hour: int, day: int = 8, minutes: int = 60) -> Timing:
    start = datetime(2026, 10, day, hour, tzinfo=UTC)
    return Timing(all_day=False, start_utc=start, end_utc=start + timedelta(minutes=minutes))


def soccer(**extra: Any) -> SyncedSeries:
    """Tuesdays and Thursdays at 4 PM in New York, from Tuesday Oct 6."""
    values: dict[str, Any] = {
        "uid": "soccer@test",
        "master": SyncedEvent(title="Soccer practice", timing=at(20, day=6), tzid=NY),
        "rrule": "FREQ=WEEKLY;BYDAY=TU,TH",
        "remote_id": "soccer",
        "etag": '"m1"',
        "updated_at": datetime(2026, 10, 1, tzinfo=UTC),
    }
    values.update(extra)
    return SyncedSeries(**values)


async def synced_calendar(plugin: CalendarSync) -> str:
    calendar = await ctx_of(plugin).calendar.create_synced_calendar(
        name="Family",
        color="sea",
        owner_member_id=None,
        read_only=False,
        visible_on_display=True,
        source_label="Google",
    )
    return calendar.id


async def titles(phone: httpx.AsyncClient) -> list[tuple[str, str]]:
    response = await phone.get(
        "/api/calendar/occurrences", params={"from": "2026-10-04", "to": "2026-10-11"}
    )
    return [(o["title"], o["start_local"]) for o in response.json()["occurrences"]]


async def test_an_occurrence_changed_alone_keeps_the_series_waiting_change(
    phone: httpx.AsyncClient, plugin: CalendarSync, clock: FakeClock
) -> None:
    calendar_id = await synced_calendar(plugin)
    await ctx_of(plugin).calendar.upsert_synced(calendar_id, [soccer()])
    event_id = (
        await phone.get(
            "/api/calendar/occurrences", params={"from": "2026-10-04", "to": "2026-10-11"}
        )
    ).json()["occurrences"][0]["event_id"]
    clock.advance(minutes=1)
    changed = await phone.patch(
        f"/api/calendar/events/{event_id}", json={"title": "Soccer"}, headers=CSRF
    )
    assert changed.status_code == 200
    # Thursday's practice moves on the server, later than the local change.
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
        remote_id="soccer",
        etag='"m1"',
        updated_at=clock.now() + timedelta(minutes=5),
    )
    await ctx_of(plugin).calendar.upsert_synced(calendar_id, [moved])
    assert await titles(phone) == [
        ("Soccer", "2026-10-06T16:00:00"),
        ("Soccer practice", "2026-10-08T17:00:00"),
    ]
    pending = await ctx_of(plugin).calendar.pending([calendar_id])
    assert [p.series.master.title for p in pending if p.series.master] == ["Soccer"]


async def test_a_changed_occurrence_is_noticed_when_the_series_etag_is_the_same(
    phone: httpx.AsyncClient, plugin: CalendarSync
) -> None:
    calendar_id = await synced_calendar(plugin)

    def with_thursday(title: str, etag: str) -> SyncedSeries:
        return soccer(
            overrides=(
                SyncedOverride(
                    recurrence_id="2026-10-08T16:00:00",
                    event=SyncedEvent(title=title, timing=at(20), tzid=NY),
                    remote_id="soccer_20261008T200000Z",
                    etag=etag,
                ),
            )
        )

    first = await ctx_of(plugin).calendar.upsert_synced(
        calendar_id, [with_thursday("Soccer (away)", '"o1"')]
    )
    assert first.created == 1
    again = await ctx_of(plugin).calendar.upsert_synced(
        calendar_id, [with_thursday("Soccer (away)", '"o1"')]
    )
    assert (again.unchanged, again.updated) == (1, 0)
    changed = await ctx_of(plugin).calendar.upsert_synced(
        calendar_id, [with_thursday("Soccer (home)", '"o2"')]
    )
    assert changed.updated == 1
    assert ("Soccer (home)", "2026-10-08T16:00:00") in await titles(phone)
