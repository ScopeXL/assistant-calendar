"""Stars & rewards through the API (UX §4 "Stars & rewards", §6 "Redeem a reward"): asking holds
the stars, a parent says yes (spending them) or not now, a kid takes an ask back, and rewards
can be turned off. The Sample Family only."""

from __future__ import annotations

from typing import Any

import httpx

from tests.chores.helpers import Family, day, error, give, set_switches, stars, tapped
from tests.support import CSRF


async def add_reward(client: httpx.AsyncClient, title: str, cost: int) -> dict[str, Any]:
    response = await client.post(
        "/api/chores/rewards", json={"title": title, "cost_points": cost}, headers=CSRF
    )
    assert response.status_code == 201, response.text
    reward: dict[str, Any] = response.json()
    return reward


async def ask(
    client: httpx.AsyncClient, reward_id: str, *, headers: dict[str, str] = CSRF, **body: Any
) -> httpx.Response:
    return await client.post(f"/api/chores/rewards/{reward_id}/redeem", json=body, headers=headers)


async def rewards(client: httpx.AsyncClient) -> dict[str, Any]:
    response = await client.get("/api/chores/rewards")
    assert response.status_code == 200, response.text
    found: dict[str, Any] = response.json()
    return found


async def test_asking_holds_the_stars_and_a_yes_spends_them(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, family: Family
) -> None:
    movie = await add_reward(parent, "Movie night", 30)
    ice = await add_reward(parent, "Ice cream run", 10)
    await add_reward(parent, "Pick dinner", 10)
    await give(parent, family.mia, 42)
    listed = await rewards(parent)
    assert [r["title"] for r in listed["rewards"]] == [
        "Ice cream run",
        "Pick dinner",
        "Movie night",
    ]
    assert [s["member_id"] for s in listed["stars"]] == [family.mia, family.leo]  # kids only
    asked = await ask(screen, movie["id"], headers=tapped(family.mia))
    assert asked.status_code == 201, asked.text
    request = asked.json()
    assert (request["status"], request["reward_title"], request["cost_points"]) == (
        "requested",
        "Movie night",
        30,
    )
    assert (request["member_id"], request["decided_at"]) == (family.mia, None)
    shown = await rewards(parent)
    assert [a["id"] for a in shown["asked"]] == [request["id"]]
    assert (stars(shown, family.mia)["balance"], stars(shown, family.mia)["held"]) == (42, 30)
    # The held stars can't be asked with twice.
    twice = await ask(screen, movie["id"], headers=tapped(family.mia))
    assert error(twice) == (409, "not_enough", "Mia has 12 of 30 stars.")
    small = (await ask(screen, ice["id"], headers=tapped(family.mia))).json()
    today = await day(parent)
    assert [a["reward_title"] for a in today["asked"]] == ["Movie night", "Ice cream run"]
    yes = await parent.post(f"/api/chores/redemptions/{request['id']}/approve", headers=CSRF)
    assert yes.status_code == 200, yes.text
    assert (yes.json()["status"], yes.json()["decided_by_member_id"]) == ("approved", family.ana)
    no = await parent.post(f"/api/chores/redemptions/{small['id']}/deny", headers=CSRF)
    assert no.json()["status"] == "denied"
    after = await rewards(parent)
    assert (stars(after, family.mia)["balance"], stars(after, family.mia)["held"]) == (12, 0)
    assert after["asked"] == []
    assert [r["id"] for r in after["recent"]] == [small["id"], request["id"]]  # newest first
    late = await parent.post(f"/api/chores/redemptions/{small['id']}/approve", headers=CSRF)
    assert error(late) == (409, "already_answered", "A parent already answered that.")
    same = await parent.post(f"/api/chores/redemptions/{request['id']}/approve", headers=CSRF)
    assert same.json()["status"] == "approved"


async def test_not_enough_stars_says_how_many(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, family: Family
) -> None:
    movie = await add_reward(parent, "Movie night", 30)
    await give(parent, family.leo, 18)
    refused = await ask(screen, movie["id"], headers=tapped(family.leo))
    assert error(refused) == (409, "not_enough", "Leo has 18 of 30 stars.")
    # A yes needs the stars still there: a parent took some away after the ask.
    await give(parent, family.leo, 12)
    request = (await ask(screen, movie["id"], headers=tapped(family.leo))).json()
    await give(parent, family.leo, -10)
    too_late = await parent.post(f"/api/chores/redemptions/{request['id']}/approve", headers=CSRF)
    assert error(too_late) == (409, "not_enough", "Leo has 20 of 30 stars.")


async def test_taking_an_ask_back(
    parent: httpx.AsyncClient,
    screen: httpx.AsyncClient,
    kid_phone: httpx.AsyncClient,
    family: Family,
) -> None:
    movie = await add_reward(parent, "Movie night", 30)
    await give(parent, family.mia, 30)
    request = (await ask(screen, movie["id"], headers=tapped(family.mia))).json()
    # Leo's phone can't take back Mia's ask; the screen, for Mia, can.
    refused = await kid_phone.post(f"/api/chores/redemptions/{request['id']}/cancel", headers=CSRF)
    assert error(refused)[:2] == (403, "parent_required")
    taken = await screen.post(
        f"/api/chores/redemptions/{request['id']}/cancel", headers=tapped(family.mia)
    )
    assert taken.status_code == 200, taken.text
    assert taken.json()["status"] == "cancelled"
    shown = await rewards(parent)
    assert (shown["asked"], stars(shown, family.mia)["held"]) == ([], 0)
    again = await screen.post(
        f"/api/chores/redemptions/{request['id']}/cancel", headers=tapped(family.mia)
    )
    assert again.json()["status"] == "cancelled"
    answer = await parent.post(f"/api/chores/redemptions/{request['id']}/approve", headers=CSRF)
    assert error(answer) == (409, "already_answered", "Mia took that back.")
    # A kid's own phone asks for itself, and takes its own ask back.
    await give(parent, family.leo, 30)
    his = (await ask(kid_phone, movie["id"])).json()
    assert his["member_id"] == family.leo
    mine = await kid_phone.post(f"/api/chores/redemptions/{his['id']}/cancel", headers=CSRF)
    assert mine.json()["status"] == "cancelled"
    # Only a parent answers.
    third = (await ask(kid_phone, movie["id"])).json()
    nope = await kid_phone.post(f"/api/chores/redemptions/{third['id']}/approve", headers=CSRF)
    assert error(nope)[:2] == (403, "parent_required")


async def test_a_parent_keeps_the_rewards_list(
    parent: httpx.AsyncClient, kid_phone: httpx.AsyncClient, family: Family
) -> None:
    movie = await add_reward(parent, "Movie night", 30)
    changed = await parent.patch(
        f"/api/chores/rewards/{movie['id']}",
        json={"title": "Movie night at home", "cost_points": 25, "icon": "film"},
        headers=CSRF,
    )
    assert (changed.json()["title"], changed.json()["cost_points"], changed.json()["icon"]) == (
        "Movie night at home",
        25,
        "film",
    )
    off = await parent.patch(
        f"/api/chores/rewards/{movie['id']}", json={"active": False}, headers=CSRF
    )
    assert off.json()["active"] is False
    assert (await rewards(parent))["rewards"] == []
    every = (await parent.get("/api/chores/rewards", params={"include_inactive": True})).json()
    assert [r["id"] for r in every["rewards"]] == [movie["id"]]
    refused = await kid_phone.post(
        "/api/chores/rewards", json={"title": "Pony", "cost_points": 5}, headers=CSRF
    )
    assert error(refused)[:2] == (403, "parent_required")
    removed = await parent.delete(f"/api/chores/rewards/{movie['id']}", headers=CSRF)
    assert removed.status_code == 204
    gone = await parent.patch(f"/api/chores/rewards/{movie['id']}", json={}, headers=CSRF)
    assert error(gone) == (404, "not_found", "That reward isn't here any more.")


async def test_with_rewards_off_nothing_changes(
    parent: httpx.AsyncClient, screen: httpx.AsyncClient, family: Family
) -> None:
    movie = await add_reward(parent, "Movie night", 10)
    await give(parent, family.mia, 30)
    request = (await ask(screen, movie["id"], headers=tapped(family.mia))).json()
    await set_switches(parent, rewards=False)
    off = (409, "rewards_off", "Rewards are turned off in Settings.")
    assert error(await add_reward_raw(parent)) == off
    assert error(await ask(screen, movie["id"], headers=tapped(family.mia))) == off
    for action in ("approve", "deny", "cancel"):
        response = await parent.post(
            f"/api/chores/redemptions/{request['id']}/{action}", headers=CSRF
        )
        assert error(response) == off
    assert (await parent.get("/api/chores/rewards")).status_code == 200
    today = await day(parent)
    assert (today["rewards_on"], today["asked"]) == (False, [])


async def add_reward_raw(client: httpx.AsyncClient) -> httpx.Response:
    return await client.post(
        "/api/chores/rewards", json={"title": "Pony", "cost_points": 5}, headers=CSRF
    )
