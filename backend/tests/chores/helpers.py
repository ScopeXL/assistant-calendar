"""Helpers for the chores tests. Wednesday 2026-10-07 is today (14:00 UTC, 10:00 in New York);
the household's week starts on Sunday."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

import httpx

from tests.support import CSRF

SUN, MON, TUE, WED, THU, FRI, SAT = (date(2026, 10, day) for day in range(4, 11))
TODAY = WED


@dataclass(frozen=True, slots=True)
class Family:
    ana: str
    sam: str
    mia: str
    leo: str


def tapped(member_id: str) -> dict[str, str]:
    """A wall-screen request saying who tapped."""
    return CSRF | {"X-Sunroom-Member": member_id}


async def add_chore(client: httpx.AsyncClient, title: str, **body: Any) -> dict[str, Any]:
    response = await client.post("/api/chores", json={"title": title} | body, headers=CSRF)
    assert response.status_code == 201, response.text
    chore: dict[str, Any] = response.json()
    return chore


async def complete(
    client: httpx.AsyncClient,
    chore_id: str,
    due: date = TODAY,
    *,
    member_id: str | None = None,
    headers: dict[str, str] = CSRF,
) -> httpx.Response:
    body = {"due_date": due.isoformat(), "member_id": member_id}
    return await client.post(f"/api/chores/{chore_id}/complete", json=body, headers=headers)


async def undo(
    client: httpx.AsyncClient,
    chore_id: str,
    due: date = TODAY,
    *,
    member_id: str | None = None,
    headers: dict[str, str] = CSRF,
) -> httpx.Response:
    body = {"due_date": due.isoformat(), "member_id": member_id}
    return await client.post(f"/api/chores/{chore_id}/undo", json=body, headers=headers)


async def day(client: httpx.AsyncClient, when: date | None = None) -> dict[str, Any]:
    params = {"date": when.isoformat()} if when else None
    response = await client.get("/api/chores/today", params=params)
    assert response.status_code == 200, response.text
    found: dict[str, Any] = response.json()
    return found


def column(day_out: dict[str, Any], member_id: str | None) -> dict[str, Any]:
    found: dict[str, Any] = next(c for c in day_out["columns"] if c["member_id"] == member_id)
    return found


def stars(out: dict[str, Any], member_id: str) -> dict[str, Any]:
    found: dict[str, Any] = next(s for s in out["stars"] if s["member_id"] == member_id)
    return found


async def stars_now(client: httpx.AsyncClient, member_id: str) -> dict[str, Any]:
    response = await client.get("/api/chores/points")
    assert response.status_code == 200, response.text
    return stars(response.json(), member_id)


async def give(client: httpx.AsyncClient, member_id: str, points: int) -> dict[str, Any]:
    response = await client.post(
        "/api/chores/points/adjust",
        json={"member_id": member_id, "points": points, "reason": "A head start"},
        headers=CSRF,
    )
    assert response.status_code == 200, response.text
    found: dict[str, Any] = response.json()
    return found


async def set_switches(client: httpx.AsyncClient, **values: bool) -> None:
    response = await client.put(
        "/api/plugins/chores/settings", json={"values": values}, headers=CSRF
    )
    assert response.status_code == 200, response.text


def error(response: httpx.Response) -> tuple[int, str, str]:
    body = response.json()["error"]
    return response.status_code, body["code"], body["message"]
