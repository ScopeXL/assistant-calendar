"""The test server's Sample Family (``POST /api/_test/seed``): what `just seed`, screenshots and
end-to-end runs start from. Each enabled plugin adds its own; lists and chores read as UX §4
draws them. The clock is Wednesday 2026-10-07, 10:00 in New York. Synthetic data only."""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from sunroom.app import create_app
from sunroom.core.clock import ShiftableClock
from tests.support import BASE_URL, CSRF, make_settings

SEED_PASSWORD = "sample-family-passphrase"


@pytest.fixture
async def test_server(data_dir: Path) -> AsyncIterator[FastAPI]:
    clock = ShiftableClock()
    application = create_app(make_settings(data_dir, sunroom_test_mode=True), clock=clock)
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def phone(test_server: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=test_server)
    async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as client:
        yield client


async def seed(client: httpx.AsyncClient, **body: Any) -> None:
    """The clock on Wednesday 10:00 in New York, the Sample Family seeded, signed in."""
    moved = await client.post(
        "/api/_test/clock", json={"set": "2026-10-07T14:00:00Z"}, headers=CSRF
    )
    assert moved.status_code == 204, moved.text
    response = await client.post(
        "/api/_test/seed", json={"password": SEED_PASSWORD, **body}, headers=CSRF
    )
    assert response.status_code == 204, response.text
    signed = await client.post("/api/auth/login", json={"password": SEED_PASSWORD}, headers=CSRF)
    assert signed.status_code == 200, signed.text


async def test_the_sample_family_has_lists_and_chores(phone: httpx.AsyncClient) -> None:
    await seed(phone)
    names = {m["id"]: m["name"] for m in (await phone.get("/api/members")).json()}
    lists = (await phone.get("/api/lists")).json()
    assert [(each["name"], each["kind"]) for each in lists] == [
        ("Groceries", "grocery"),
        ("To do", "todo"),
        ("Packing: beach", "packing"),
    ]
    groceries = (await phone.get(f"/api/lists/{lists[0]['id']}/items")).json()
    assert [item["text"] for item in groceries["items"]] == [
        "Milk",
        "Eggs",
        "Bananas",
        "Shin guards",
    ]
    assert [item["text"] for item in groceries["done"]] == ["Bread"]
    assert {"Apples", "Yogurt", "Cheese"} <= set(groceries["usuals"])
    assert "Milk" not in groceries["usuals"]  # it's on the list already
    todo = (await phone.get("/api/lists/todo", params={"date": "2026-10-07"})).json()
    assert [item["text"] for item in todo["items"]] == ["Call the plumber"]

    day = (await phone.get("/api/chores/today", params={"date": "2026-10-07"})).json()
    columns = {names.get(c["member_id"], "Anyone"): (c["done"], c["total"]) for c in day["columns"]}
    assert columns == {"Sam": (0, 1), "Mia": (1, 2), "Leo": (1, 1), "Anyone": (0, 2)}
    anyone = next(c for c in day["columns"] if c["member_id"] is None)
    dishes = next(b for b in anyone["boxes"] if b["title"] == "Empty the dishwasher")
    assert names[dishes["turn_id"]] == "Mia"
    stars = {names[s["member_id"]]: s for s in day["stars"]}
    assert (stars["Mia"]["balance"], stars["Leo"]["balance"]) == (42, 18)
    assert stars["Leo"]["streak"] == 7  # six days and today, all done
    rewards = (await phone.get("/api/chores/rewards")).json()
    assert [r["title"] for r in rewards["rewards"]] == [
        "Pick the dinner",
        "Ice cream run",
        "Movie night",
    ]


async def test_seeding_twice_adds_nothing_twice(phone: httpx.AsyncClient) -> None:
    await seed(phone)
    await phone.post("/api/_test/seed", json={"password": SEED_PASSWORD}, headers=CSRF)
    assert len((await phone.get("/api/lists")).json()) == 3
    assert len((await phone.get("/api/chores")).json()) == 5


async def test_plugins_can_be_left_empty(phone: httpx.AsyncClient) -> None:
    await seed(phone, plugins=False)
    assert (await phone.get("/api/lists")).json() == []
    assert (await phone.get("/api/chores")).json() == []
