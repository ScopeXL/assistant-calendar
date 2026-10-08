"""Routines through the API (UX §4 "Routine runner", §6 "A kid runs a bedtime routine"): a kid
checks steps for the day, finishes once a day for stars, steps are rearranged keeping their ids,
old checks are pruned. The Sample Family only."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx

from sunroom.core.clock import FakeClock
from sunroom.plugins.chores import service
from sunroom.plugins.chores.plugin import Chores
from sunroom.plugins.chores.routines import is_open
from tests.chores.helpers import (
    SAT,
    TODAY,
    Family,
    add_chore,
    column,
    day,
    error,
    set_switches,
    tapped,
)
from tests.support import CSRF

EVENING = datetime(2026, 10, 7, 23, 45, tzinfo=UTC)  # 7:45 PM in New York


async def add_routine(client: httpx.AsyncClient, title: str, **body: Any) -> dict[str, Any]:
    body = {
        "title": title,
        "window_start": "19:30",
        "window_end": "20:30",
        "points": 5,
        "steps": [
            {"title": "Brush teeth", "icon": "toothbrush"},
            {"title": "Pajamas", "icon": "shirt"},
            {"title": "Story", "icon": "book"},
        ],
    } | body
    response = await client.post("/api/chores/routines", json=body, headers=CSRF)
    assert response.status_code == 201, response.text
    routine: dict[str, Any] = response.json()
    return routine


async def check(
    client: httpx.AsyncClient,
    routine: dict[str, Any],
    step: int,
    *,
    checked: bool = True,
    when: date = TODAY,
    headers: dict[str, str] = CSRF,
) -> httpx.Response:
    step_id = routine["steps"][step]["id"]
    return await client.post(
        f"/api/chores/routines/{routine['id']}/steps/{step_id}/check",
        json={"date": when.isoformat(), "checked": checked},
        headers=headers,
    )


async def finish(
    client: httpx.AsyncClient, routine: dict[str, Any], *, headers: dict[str, str] = CSRF
) -> httpx.Response:
    return await client.post(
        f"/api/chores/routines/{routine['id']}/finish",
        json={"date": TODAY.isoformat()},
        headers=headers,
    )


async def runs(client: httpx.AsyncClient, **params: str) -> list[dict[str, Any]]:
    response = await client.get("/api/chores/routines", params=params)
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()["runs"]
    return found


def test_a_window_can_run_past_midnight() -> None:
    assert is_open("19:30", "20:30", "19:30") and not is_open("19:30", "20:30", "20:30")
    assert is_open("22:00", "01:00", "23:15") and is_open("22:00", "01:00", "00:30")
    assert not is_open("22:00", "01:00", "12:00")


async def test_a_kid_checks_steps_and_finishes_once_a_day(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, clock: FakeClock, family: Family
) -> None:
    bedtime = await add_routine(parent, "Bedtime routine")
    assert [s["title"] for s in bedtime["steps"]] == ["Brush teeth", "Pajamas", "Story"]
    assert (bedtime["member_id"], bedtime["days"]) == (None, [0, 1, 2, 3, 4, 5, 6])
    # Every kid runs it; at 10 AM its window isn't open.
    morning = await runs(parent)
    assert [(r["member_id"], r["open_now"]) for r in morning] == [
        (family.mia, False),
        (family.leo, False),
    ]
    clock.set(EVENING)
    checked = await check(screen, bedtime, 0, headers=tapped(family.leo))
    assert checked.status_code == 200, checked.text
    run = checked.json()
    assert (run["member_id"], run["open_now"], run["finished"]) == (family.leo, True, False)
    assert run["checked"] == [bedtime["steps"][0]["id"]]
    await check(screen, bedtime, 1, headers=tapped(family.leo))
    unchecked = (await check(screen, bedtime, 0, checked=False, headers=tapped(family.leo))).json()
    assert unchecked["checked"] == [bedtime["steps"][1]["id"]]
    done = await finish(screen, bedtime, headers=tapped(family.leo))
    assert done.status_code == 200, done.text
    assert (done.json()["points_awarded"], done.json()["stars"]["balance"]) == (5, 5)
    assert done.json()["stars"]["week"] == 5
    again = (await finish(screen, bedtime, headers=tapped(family.leo))).json()
    assert (again["points_awarded"], again["stars"]["balance"]) == (0, 5)
    leo = column(await day(parent), family.leo)
    assert [(r["title"], r["finished"], r["open_now"]) for r in leo["routines"]] == [
        ("Bedtime routine", True, True)
    ]
    assert (leo["total"], leo["boxes"]) == (0, [])  # nothing else today, but he has a column
    mine = await runs(parent, member_id=family.leo)
    assert [(r["member_id"], len(r["checked"]), r["finished"]) for r in mine] == [
        (family.leo, 1, True)
    ]
    # A new day starts fresh.
    clock.advance(days=1)
    tomorrow = await runs(parent, member_id=family.leo)
    assert [(r["checked"], r["finished"]) for r in tomorrow] == [([], False)]


async def test_a_routine_is_its_own_persons_on_its_own_days(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, family: Family
) -> None:
    morning = await add_routine(
        parent,
        "Morning routine",
        member_id=family.mia,
        days=[4, 0, 1, 2, 3],
        window_start="07:00",
        window_end="08:00",
    )
    assert morning["days"] == [0, 1, 2, 3, 4]
    assert [r["member_id"] for r in await runs(parent)] == [family.mia]
    not_his = await check(screen, morning, 0, headers=tapped(family.leo))
    assert error(not_his) == (409, "not_theirs", "That isn't Leo's routine.")
    weekend = await check(screen, morning, 0, when=SAT, headers=tapped(family.mia))
    assert error(weekend) == (409, "not_due", "That routine isn't on that day.")
    assert await runs(parent, date=SAT.isoformat()) == []
    # Mia's column is there for her routine alone.
    today = await day(parent)
    assert [c["member_id"] for c in today["columns"]] == [family.mia]
    bad = await parent.post(
        "/api/chores/routines",
        json={"title": "Never", "window_start": "07:00", "window_end": "07:00"},
        headers=CSRF,
    )
    assert error(bad)[:2] == (422, "invalid")
    nobody = await parent.post(
        "/api/chores/routines",
        json={"title": "Never", "window_start": "07:00", "window_end": "08:00", "days": []},
        headers=CSRF,
    )
    assert error(nobody) == (422, "invalid", "Pick at least one day.")


async def test_steps_are_replaced_keeping_their_ids(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, family: Family
) -> None:
    bedtime = await add_routine(parent, "Bedtime routine")
    brush, pajamas, story = (step["id"] for step in bedtime["steps"])
    await check(screen, bedtime, 0, headers=tapped(family.mia))
    await check(screen, bedtime, 1, headers=tapped(family.mia))
    replaced = await parent.put(
        f"/api/chores/routines/{bedtime['id']}/steps",
        json={
            "steps": [
                {"id": pajamas, "title": "Pajamas on", "icon": "shirt"},
                {"title": "Hug", "icon": "heart"},
            ]
        },
        headers=CSRF,
    )
    assert replaced.status_code == 200, replaced.text
    steps = replaced.json()["steps"]
    assert [(s["title"], s["position"]) for s in steps] == [("Pajamas on", 0), ("Hug", 1)]
    assert steps[0]["id"] == pajamas and steps[1]["id"] not in (brush, story)
    [mia] = await runs(parent, member_id=family.mia)
    assert mia["checked"] == [pajamas]  # the kept step kept its check
    changed = await parent.patch(
        f"/api/chores/routines/{bedtime['id']}",
        json={"title": "Night routine", "member_id": family.leo, "points": 2},
        headers=CSRF,
    )
    assert (changed.json()["title"], changed.json()["member_id"]) == (
        "Night routine",
        family.leo,
    )
    every_kid = await parent.patch(
        f"/api/chores/routines/{bedtime['id']}", json={"every_kid": True}, headers=CSRF
    )
    assert every_kid.json()["member_id"] is None
    removed = await parent.delete(f"/api/chores/routines/{bedtime['id']}", headers=CSRF)
    assert removed.status_code == 204
    assert (await parent.get("/api/chores/routines")).json() == {"routines": [], "runs": []}


async def test_routines_off_hides_them_and_refuses_runs(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, family: Family
) -> None:
    bedtime = await add_routine(parent, "Bedtime routine")
    await add_chore(parent, "Make bed", rrule="FREQ=DAILY", assignee_member_ids=[family.mia])
    await set_switches(parent, routines=False)
    today = await day(parent)
    assert today["routines_on"] is False
    assert [(c["member_id"], c["routines"]) for c in today["columns"]] == [(family.mia, [])]
    assert error(await check(screen, bedtime, 0, headers=tapped(family.mia))) == (
        409,
        "routines_off",
        "Routines are turned off in Settings.",
    )
    assert await runs(parent) == []


async def test_old_checks_are_pruned_and_finishes_kept(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, plugin: Chores, family: Family
) -> None:
    bedtime = await add_routine(parent, "Bedtime routine")
    long_ago, lately = TODAY - timedelta(days=61), TODAY - timedelta(days=59)
    for when in (long_ago, lately):
        response = await check(screen, bedtime, 0, when=when, headers=tapped(family.mia))
        assert response.status_code == 200, response.text
    finished = await screen.post(
        f"/api/chores/routines/{bedtime['id']}/finish",
        json={"date": long_ago.isoformat()},
        headers=tapped(family.mia),
    )
    assert finished.json()["points_awarded"] == 5
    assert plugin.ctx is not None
    await service.prune(plugin.ctx)
    [old] = await runs(parent, member_id=family.mia, date=long_ago.isoformat())
    [recent] = await runs(parent, member_id=family.mia, date=lately.isoformat())
    assert (old["checked"], old["finished"], recent["checked"]) == (
        [],
        True,
        [bedtime["steps"][0]["id"]],
    )


async def test_routine_changes_go_out_live(
    parent: httpx.AsyncClient,
    screen: httpx.AsyncClient,
    family: Family,
    events: list[tuple[str, dict[str, Any]]],
) -> None:
    bedtime = await add_routine(parent, "Bedtime routine")
    await check(screen, bedtime, 0, headers=tapped(family.mia))
    await finish(screen, bedtime, headers=tapped(family.mia))
    await finish(screen, bedtime, headers=tapped(family.mia))  # nothing new
    mine = [e for e in events if e[0] in ("routines.changed", "points.changed")]
    assert mine == [
        ("routines.changed", {}),
        ("routines.changed", {}),
        ("routines.changed", {}),
        ("points.changed", {"member_id": family.mia}),
    ]
