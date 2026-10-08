"""Helpers for the weather tests: Open-Meteo's two hosts, scripted behind the real guarded client;
the weather plugin noting the hub events it has handled; and small readers. Wednesday 2026-10-07
is today (14:00 UTC, 10:00 in New York). Synthetic data only."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import FastAPI

from sunroom.plugins.base import HubEvent
from sunroom.plugins.context import PluginContext
from sunroom.plugins.weather.plugin import Weather
from tests.support import CSRF, state_of

Json = dict[str, Any]
FIXTURES = Path(__file__).resolve().parent / "fixtures"
FORECAST_HOST = "api.open-meteo.com"
SEARCH_HOST = "geocoding-api.open-meteo.com"
PUBLIC = "93.184.216.34"  # a public address, resolved for every host
SAMPLE_TOWN: Json = {"latitude": 40.71, "longitude": -74.01, "location_label": "Sample Town"}
NO_ANSWER = "Open-Meteo didn't answer."
UNREADABLE = "Open-Meteo sent something Sunroom couldn't read."


def fixture(name: str) -> Json:
    loaded: Json = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return loaded


async def resolve(host: str, port: int) -> list[str]:
    return [PUBLIC]


def celsius(fahrenheit: float) -> float:
    return round((fahrenheit - 32) * 5 / 9, 1)


class OpenMeteo:
    """Open-Meteo's forecast and search hosts, scripted. They answer with the recorded-style
    fixtures (the forecast in the zone asked for, and in °C when asked), note every request, and
    fail when told to: "down" (no connection), "refused" (Open-Meteo's own 400 answer), "html"
    (a page, not JSON) or "garbage" (JSON without the arrays)."""

    def __init__(self) -> None:
        self.requests: list[httpx.Request] = []
        self.failing: Literal["down", "refused", "html", "garbage"] | None = None
        self.places: Json = fixture("places.json")

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.failing == "down":
            raise httpx.ConnectError("refused", request=request)
        if self.failing == "refused":
            reason = "Parameter 'latitude' and 'longitude' must have the same number of elements"
            return httpx.Response(400, json={"error": True, "reason": reason})
        if self.failing == "html":
            return httpx.Response(200, html="<html><body>Back soon</body></html>")
        if self.failing == "garbage":
            return httpx.Response(200, json={"hourly": {"time": []}})
        host = request.headers["host"]
        if host == FORECAST_HOST and request.url.path == "/v1/forecast":
            return httpx.Response(200, json=self.forecast(request.url.params))
        if host == SEARCH_HOST and request.url.path == "/v1/search":
            return httpx.Response(200, json=self.places)
        return httpx.Response(404)

    def forecast(self, params: httpx.QueryParams) -> Json:
        answer = fixture("forecast.json")
        answer["timezone"] = params.get("timezone", "GMT")
        if params.get("temperature_unit") == "celsius":
            for block in ("current_units", "hourly_units", "daily_units"):
                for key, unit in answer[block].items():
                    if unit == "°F":
                        answer[block][key] = "°C"
            answer["current"]["temperature_2m"] = celsius(answer["current"]["temperature_2m"])
            for block, key in (
                ("hourly", "temperature_2m"),
                ("daily", "temperature_2m_max"),
                ("daily", "temperature_2m_min"),
            ):
                answer[block][key] = [celsius(value) for value in answer[block][key]]
        return answer

    def transport(self) -> Callable[[], httpx.AsyncBaseTransport]:
        return lambda: httpx.MockTransport(self.handler)

    def asked(self, host: str = FORECAST_HOST) -> list[httpx.QueryParams]:
        """The query of every request to ``host``, oldest first."""
        return [r.url.params for r in self.requests if r.headers["host"] == host]


class TrackedWeather(Weather):
    """The weather plugin, noting each hub event once it has handled it, so a test can wait for
    the subscription's work instead of sleeping."""

    def __init__(self) -> None:
        super().__init__()
        self.handled: list[HubEvent] = []

    async def on_event(self, ctx: PluginContext, event: HubEvent) -> None:
        await super().on_event(ctx, event)
        self.handled.append(event)


@dataclass(frozen=True, slots=True)
class Family:
    ana: str
    sam: str
    mia: str
    leo: str


def tapped(member_id: str) -> dict[str, str]:
    """A wall-screen request saying who tapped."""
    return CSRF | {"X-Sunroom-Member": member_id}


async def eventually(condition: Callable[[], bool], within_s: float = 2.0) -> None:
    deadline = asyncio.get_running_loop().time() + within_s
    while not condition():
        if asyncio.get_running_loop().time() > deadline:
            raise AssertionError("condition never became true")
        await asyncio.sleep(0.01)


async def running(plugin: TrackedWeather) -> PluginContext:
    """Turning the plugin on returns before its own task has started it."""
    await eventually(lambda: plugin.ctx is not None)
    assert plugin.ctx is not None
    return plugin.ctx


async def settled(app: FastAPI, plugin: TrackedWeather) -> None:
    """Wait until the plugin has handled everything queued for it so far: a probe it ignores (a
    switch on another plugin) is handled in turn after them."""
    probe = f"probe-{len(plugin.handled)}-{asyncio.get_running_loop().time()}"
    state_of(app).hub.publish("plugins.changed", {"id": probe, "status": "running"})
    await eventually(lambda: any(e.payload.get("id") == probe for e in plugin.handled))


async def set_place(client: httpx.AsyncClient, **place: Any) -> None:
    """Settings → Household → Location, as a parent (Sample Town unless told otherwise)."""
    response = await client.patch("/api/settings", json=SAMPLE_TOWN | place, headers=CSRF)
    assert response.status_code == 200, response.text


async def set_units(client: httpx.AsyncClient, units: str) -> None:
    response = await client.put(
        "/api/plugins/weather/settings", json={"values": {"units": units}}, headers=CSRF
    )
    assert response.status_code == 200, response.text


async def weather(client: httpx.AsyncClient, headers: dict[str, str] | None = None) -> Json:
    response = await client.get("/api/weather", headers=headers)
    assert response.status_code == 200, response.text
    found: Json = response.json()
    return found


def error(response: httpx.Response) -> tuple[int, str, str]:
    body = response.json()["error"]
    return response.status_code, body["code"], body["message"]
