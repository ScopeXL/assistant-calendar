"""The wall screen's sleep and brightness for the Pi's helper (PLAN §13.5, household/screen.py):
the state, its long poll, a tap's wake, the schedule tick and a changed setting. The household
lives in New York; the fake clock starts Wednesday 2026-10-07, 10:00 there. Synthetic data only.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import FastAPI

from sunroom.core.clock import FakeClock
from sunroom.household import screen
from tests.support import CSRF, PASSWORD, state_of

NIGHTS = {"sleep_from": "22:00", "sleep_to": "06:30", "sleep_mode": "screen_off"}


def at_new_york(hour: int, minute: int = 0, day: int = 7) -> datetime:
    """A time in New York (UTC-4 in October) as UTC."""
    utc_hour = hour + 4
    return datetime(2026, 10, day + utc_hour // 24, utc_hour % 24, minute, tzinfo=UTC)


async def state_now(client: httpx.AsyncClient, **params: Any) -> dict[str, Any]:
    response = await client.get("/api/display/state", params=params)
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


async def a_screen(other: httpx.AsyncClient) -> httpx.AsyncClient:
    paired = await other.post(
        "/api/auth/kiosk/pair-with-password", json={"password": PASSWORD}, headers=CSRF
    )
    assert paired.status_code == 200, paired.text
    return other


async def test_anyone_can_read_it_and_the_day_is_bright(
    parent: httpx.AsyncClient, other: httpx.AsyncClient
) -> None:
    response = await other.get("/api/display/state")
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert (body["screen"], body["brightness"], body["reason"]) == ("on", 100, "day")
    assert body["awake_until"] is None
    assert body["schedule"] == {
        "sleep_from": None,
        "sleep_to": None,
        "sleep_mode": "dim_clock",
        "dim_from": None,
        "dim_level": 40,
    }


async def test_the_evening_dims_the_night_sleeps_and_a_tap_wakes_it(
    parent: httpx.AsyncClient, other: httpx.AsyncClient, clock: FakeClock
) -> None:
    changed = await parent.patch(
        "/api/settings", json=NIGHTS | {"dim_from": "20:00", "dim_level": 60}, headers=CSRF
    )
    assert changed.status_code == 200, changed.text
    wall = await a_screen(other)
    clock.set(at_new_york(21))
    evening = await state_now(wall)
    assert (evening["screen"], evening["brightness"], evening["reason"]) == ("on", 60, "dim")

    clock.set(at_new_york(23))
    night = await state_now(wall)
    assert (night["screen"], night["brightness"], night["reason"]) == ("off", 0, "sleep")

    woken = await wall.post("/api/display/wake", headers=CSRF)
    assert woken.status_code == 204
    awake = await state_now(wall)
    assert (awake["screen"], awake["reason"]) == ("on", "awake")
    assert awake["awake_until"] == "2026-10-08T03:02:00Z"

    clock.advance(minutes=2)
    assert (await state_now(wall))["reason"] == "sleep"


async def test_only_the_wall_screen_wakes_itself(parent: httpx.AsyncClient) -> None:
    refused = await parent.post("/api/display/wake", headers=CSRF)
    assert refused.status_code == 403
    assert refused.json()["error"]["code"] == "not_a_screen"


async def test_the_long_poll_answers_when_the_screen_is_woken(
    app: FastAPI, parent: httpx.AsyncClient, other: httpx.AsyncClient, clock: FakeClock
) -> None:
    await parent.patch("/api/settings", json=NIGHTS, headers=CSRF)
    wall = await a_screen(other)
    clock.set(at_new_york(23))
    asleep = await state_now(wall)
    waiting = asyncio.create_task(state_now(wall, wait=30, etag=asleep["etag"]))
    await asyncio.sleep(0.05)
    assert not waiting.done()
    await wall.post("/api/display/wake", headers=CSRF)
    woken = await asyncio.wait_for(waiting, timeout=5)
    assert woken["etag"] != asleep["etag"]
    assert woken["screen"] == "on"


async def test_the_long_poll_waits_out_its_time_when_nothing_changes(
    parent: httpx.AsyncClient, other: httpx.AsyncClient
) -> None:
    first = await state_now(other)
    started = asyncio.get_running_loop().time()
    again = await state_now(other, wait=1, etag=first["etag"])
    assert asyncio.get_running_loop().time() - started >= 0.9
    assert again["etag"] == first["etag"]
    # A different etag answers at once.
    assert (await state_now(other, wait=30, etag="something-else"))["etag"] == first["etag"]


async def test_bedtime_arrives_by_the_schedule_tick(
    app: FastAPI, parent: httpx.AsyncClient, other: httpx.AsyncClient, clock: FakeClock
) -> None:
    await parent.patch("/api/settings", json=NIGHTS, headers=CSRF)
    clock.set(at_new_york(21, 59))
    evening = await state_now(other)
    waiting = asyncio.create_task(state_now(other, wait=30, etag=evening["etag"]))
    await asyncio.sleep(0.05)
    clock.set(at_new_york(22))
    await screen.tick(state_of(app))
    asleep = await asyncio.wait_for(waiting, timeout=5)
    assert (asleep["screen"], asleep["reason"]) == ("off", "sleep")


async def test_a_changed_setting_answers_the_long_poll(
    parent: httpx.AsyncClient, other: httpx.AsyncClient, clock: FakeClock
) -> None:
    clock.set(at_new_york(23))
    day = await state_now(other)
    waiting = asyncio.create_task(state_now(other, wait=30, etag=day["etag"]))
    await asyncio.sleep(0.05)
    await parent.patch("/api/settings", json=NIGHTS, headers=CSRF)
    asleep = await asyncio.wait_for(waiting, timeout=5)
    assert asleep["reason"] == "sleep"


async def test_dimming_needs_a_sleep_schedule_and_can_stop(
    parent: httpx.AsyncClient, clock: FakeClock
) -> None:
    clock.set(at_new_york(21))
    await parent.patch("/api/settings", json={"dim_from": "20:00"}, headers=CSRF)
    assert (await state_now(parent))["reason"] == "day"
    await parent.patch("/api/settings", json=NIGHTS, headers=CSRF)
    assert (await state_now(parent))["reason"] == "dim"
    stopped = await parent.patch("/api/settings", json={"dim_from": None}, headers=CSRF)
    assert stopped.json()["dim_from"] is None
    assert (await state_now(parent))["reason"] == "day"
