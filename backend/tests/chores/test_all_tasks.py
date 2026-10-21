"""Every task with its next day (All Tasks, ADR 0036): `GET /api/chores` soonest first, the board's
columns for people with a task ahead (or a box on the day), and the hourly tidy that moves a
finished task to Recently removed the day after its last day.

Wednesday 2026-10-07 is today (10:00 in New York). The Sample Family only."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

import httpx

from sunroom.core.clock import FakeClock
from sunroom.plugins.chores import service
from sunroom.plugins.chores.plugin import Chores
from sunroom.plugins.context import PluginContext
from tests.chores.helpers import (
    MON,
    SAT,
    TODAY,
    TUE,
    Family,
    add_chore,
    complete,
    day,
    stars_now,
    tapped,
)
from tests.support import CSRF

NOV_6 = date(2026, 11, 6)


def context(plugin: Chores) -> PluginContext:
    assert plugin.ctx is not None
    return plugin.ctx


async def listed(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    response = await client.get("/api/chores")
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()
    return found


async def removed_titles(client: httpx.AsyncClient) -> list[str]:
    response = await client.get("/api/chores/removed")
    assert response.status_code == 200, response.text
    return [chore["title"] for chore in response.json()]


async def test_every_task_has_its_next_day_soonest_first(
    parent: httpx.AsyncClient, family: Family
) -> None:
    await add_chore(
        parent,
        "Swim lessons",
        rrule="FREQ=DAILY;UNTIL=20261001",
        start_date="2026-09-01",
        assignee_member_ids=[family.leo],
    )
    await add_chore(
        parent, "Dentist", start_date=NOV_6.isoformat(), assignee_member_ids=[family.mia]
    )
    await add_chore(
        parent,
        "Take out the trash",
        rrule="FREQ=WEEKLY;BYDAY=SA",
        start_date="2026-10-03",
        assignee_member_ids=[family.sam],
    )
    await add_chore(
        parent, "Pack for the trip", start_date=MON.isoformat(), assignee_member_ids=[family.mia]
    )
    made = await add_chore(parent, "Make bed", rrule="FREQ=DAILY", assignee_member_ids=[family.mia])
    # Each change answers with the next day too.
    assert made["next_due"] == TODAY.isoformat()
    found = await listed(parent)
    # Today's first (by title), then Saturday, then next month; one that has ended comes last.
    assert [(c["title"], c["next_due"]) for c in found] == [
        ("Make bed", TODAY.isoformat()),
        ("Pack for the trip", TODAY.isoformat()),  # last Monday's, carried over
        ("Take out the trash", SAT.isoformat()),
        ("Dentist", NOV_6.isoformat()),
        ("Swim lessons", None),
    ]


async def test_a_column_is_for_a_task_ahead_or_a_box_on_the_day(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, family: Family, clock: FakeClock
) -> None:
    # Monday: Leo returns the library books on their day.
    clock.set(datetime(2026, 10, 5, 14, 0, tzinfo=UTC))
    books = await add_chore(
        parent, "Return library books", start_date=MON.isoformat(), assignee_member_ids=[family.leo]
    )
    assert (await complete(screen, books["id"], MON, headers=tapped(family.leo))).status_code == 200
    clock.set(datetime(2026, 10, 7, 14, 0, tzinfo=UTC))
    await add_chore(
        parent, "Dentist", start_date=NOV_6.isoformat(), assignee_member_ids=[family.sam]
    )
    today = await day(parent)
    # Leo's only task is finished: no column. Sam's is next month: a column with nothing today.
    assert [(c["member_id"], c["total"]) for c in today["columns"]] == [(family.sam, 0)]
    # On Monday, Leo's box was there, done: his column shows that day.
    monday = await day(parent, MON)
    assert [(c["member_id"], c["done"], c["total"]) for c in monday["columns"]] == [
        (family.sam, 0, 0),
        (family.leo, 1, 1),
    ]


async def test_a_one_day_task_done_late_keeps_its_column_on_the_day_it_was_done(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, family: Family
) -> None:
    shoes = await add_chore(
        parent, "Shoes away", start_date=MON.isoformat(), assignee_member_ids=[family.mia]
    )
    assert (await complete(screen, shoes["id"], MON, headers=tapped(family.mia))).status_code == 200
    # Done today, two days late: finished (no next day), but its stamped box is today's.
    [mia] = (await day(parent))["columns"]
    assert (mia["member_id"], mia["done"], mia["total"]) == (family.mia, 1, 1)
    assert [c["next_due"] for c in await listed(parent)] == [None]


async def test_the_tidy_moves_finished_tasks_the_day_after_and_keeps_their_stars(
    parent: httpx.AsyncClient,
    screen: httpx.AsyncClient,
    family: Family,
    plugin: Chores,
    clock: FakeClock,
    events: list[tuple[str, dict[str, Any]]],
) -> None:
    ctx = context(plugin)
    library = await add_chore(
        parent,
        "Return library books",
        start_date=TUE.isoformat(),
        assignee_member_ids=[family.mia],
        points=3,
    )
    await add_chore(
        parent, "Find the gloves", start_date=TUE.isoformat(), assignee_member_ids=[family.leo]
    )
    await add_chore(
        parent,
        "Swim lessons",
        rrule="FREQ=DAILY;UNTIL=20261001",
        start_date="2026-09-01",
        assignee_member_ids=[family.leo],
    )
    await add_chore(parent, "Make bed", rrule="FREQ=DAILY", assignee_member_ids=[family.mia])
    await add_chore(
        parent,
        "Clean the garage",
        rrule="FREQ=DAILY;UNTIL=20261001",
        start_date="2026-09-01",
        assignee_member_ids=[family.sam],
    )
    paused = next(c for c in await listed(parent) if c["title"] == "Clean the garage")
    off = await parent.patch(f"/api/chores/{paused['id']}", json={"active": False}, headers=CSRF)
    assert off.status_code == 200, off.text
    done = await complete(screen, library["id"], TUE, headers=tapped(family.mia))
    assert done.status_code == 200, done.text
    balance = (await stars_now(parent, family.mia))["balance"]

    # Just added: nothing goes before a day has passed untouched.
    await service.tidy(ctx)
    assert await removed_titles(parent) == []

    # Tomorrow, over a day after: the done one-off and the ended rule leave; the undone one-off
    # (carried over), the daily one and the paused one stay. The stars stay too.
    clock.advance(days=1, hours=1)
    events.clear()
    await service.tidy(ctx)
    assert sorted(await removed_titles(parent)) == ["Return library books", "Swim lessons"]
    assert [c["title"] for c in await listed(parent)] == ["Find the gloves", "Make bed"]
    assert (await stars_now(parent, family.mia))["balance"] == balance
    assert {name for name, _ in events} == {"chores.changed"}

    # Put back, it stays a day, then leaves again.
    back = await parent.post(f"/api/chores/{library['id']}/restore", headers=CSRF)
    assert back.status_code == 200, back.text
    assert back.json()["next_due"] is None
    await service.tidy(ctx)
    assert "Return library books" in [c["title"] for c in await listed(parent)]
    clock.advance(days=1, hours=1)
    await service.tidy(ctx)
    assert "Return library books" not in [c["title"] for c in await listed(parent)]
    assert "Return library books" in await removed_titles(parent)
