"""The test server (SUNROOM_TEST_MODE: ``just seed``, screenshots, end-to-end runs) never touches
the network: the Sample Family's forecast for Sample Town and the town search are made up. The
fake clock reads Wednesday 2026-10-07, 10:00 in New York. Synthetic data only."""

from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI

from sunroom.core.clock import FakeClock
from tests.support import CSRF
from tests.weather.helpers import OpenMeteo, TrackedWeather, running, settled, weather

SEED_PASSWORD = "sample-family-passphrase"


@pytest.fixture
def test_mode() -> bool:
    return True


@pytest.fixture
async def seeded(
    app: FastAPI, client: httpx.AsyncClient, plugin: TrackedWeather
) -> httpx.AsyncClient:
    """The Sample Family seeded (Sample Town is its place), signed in on a parent's phone."""
    response = await client.post("/api/_test/seed", json={"password": SEED_PASSWORD}, headers=CSRF)
    assert response.status_code == 204, response.text
    signed = await client.post("/api/auth/login", json={"password": SEED_PASSWORD}, headers=CSRF)
    assert signed.status_code == 200, signed.text
    await running(plugin)
    await settled(app, plugin)
    return client


async def test_the_sample_family_has_a_made_up_forecast_and_nothing_is_asked(
    seeded: httpx.AsyncClient, open_meteo: OpenMeteo
) -> None:
    shown = await weather(seeded)
    assert {key: shown[key] for key in ("status", "location_label", "units", "stale")} == {
        "status": "ok",
        "location_label": "Sample Town",
        "units": "fahrenheit",
        "stale": False,
    }
    assert shown["current"] == {
        "time": "2026-10-07T10:00:00",
        "temperature": shown["hourly"][0]["temperature"],
        "code": 2,
        "is_day": True,
    }
    assert [hour["time"] for hour in shown["hourly"][:2]] == [
        "2026-10-07T10:00:00",
        "2026-10-07T11:00:00",
    ]
    assert len(shown["hourly"]) == 24
    days = shown["daily"]
    assert [day["date"] for day in days] == [f"2026-10-{day:02d}" for day in range(7, 14)]
    assert [day["high"] for day in days] == [65, 67, 61, 59, 63, 66, 64]
    assert [(day["sunrise"], day["sunset"]) for day in days[:2]] == [
        ("2026-10-07T07:05:00", "2026-10-07T18:30:00"),
        ("2026-10-08T07:06:00", "2026-10-08T18:29:00"),
    ]
    assert open_meteo.requests == []
    # Seeding again asks nothing either.
    again = await seeded.post("/api/_test/seed", json={"password": SEED_PASSWORD}, headers=CSRF)
    assert again.status_code == 204, again.text
    assert open_meteo.requests == []


async def test_check_now_on_the_test_server_makes_it_up_again(
    seeded: httpx.AsyncClient, open_meteo: OpenMeteo, clock: FakeClock
) -> None:
    clock.advance(minutes=20)
    checked = await seeded.post("/api/weather/refresh", headers=CSRF)
    assert checked.status_code == 200, checked.text
    assert checked.json()["fetched_at"] == "2026-10-07T14:20:00Z"
    assert checked.json()["current"]["time"] == "2026-10-07T10:15:00"
    assert open_meteo.requests == []


async def test_the_test_servers_town_search_is_made_up(
    seeded: httpx.AsyncClient, open_meteo: OpenMeteo
) -> None:
    async def labels(q: str) -> list[str]:
        response = await seeded.get("/api/weather/geocode", params={"q": q})
        assert response.status_code == 200, response.text
        return [place["label"] for place in response.json()]

    assert await labels("sample") == [
        "Sample Town, Sample State, United States",
        "Sample Harbour, Sample County, United Kingdom",
    ]
    assert await labels("Town") == ["Sample Town, Sample State, United States"]
    assert await labels("Nowhere") == []
    town = (await seeded.get("/api/weather/geocode", params={"q": "Sample Town"})).json()
    assert town == [
        {
            "label": "Sample Town, Sample State, United States",
            "latitude": 40.71,
            "longitude": -74.01,
            "timezone": "America/New_York",
        }
    ]
    assert open_meteo.requests == []
