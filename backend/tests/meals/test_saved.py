"""Saved meals through the API (UX §4 "Meals room": the library, "made 6 times"): most used
first, search, each meal saved once, changing one, archiving and putting back.

Only this plugin is registered. Wednesday 2026-10-07 is today (10:00 in New York). The Sample
Family only."""

from __future__ import annotations

import httpx
from fastapi import FastAPI

from sunroom.core.clock import FakeClock
from sunroom.plugins.meals.models import SavedMeal
from tests.meals.helpers import (
    FRI,
    MON,
    SAT,
    SAVED_GONE,
    SUN,
    THU,
    TUE,
    WED,
    Family,
    Json,
    error,
    plan,
    put_entry,
    removed,
    save_meal,
    saved_meals,
    week,
)
from tests.support import CSRF, state_of


async def test_saved_meals_are_the_most_used_first_and_searchable(
    parent: httpx.AsyncClient, family: Family, clock: FakeClock
) -> None:
    assert await saved_meals(parent) == []
    for day in (SUN, MON, TUE):
        await plan(parent, day, "Tacos")
    clock.advance(minutes=1)
    for day in (WED, THU):
        await plan(parent, day, "Pizza night")
    clock.advance(minutes=1)
    for day in (FRI, SAT):
        await plan(parent, day, "Soup")
    for text in ("Pasta night", "Apple pie", "apple crumble"):
        await save_meal(parent, text)
    library = await saved_meals(parent)
    assert [(meal["text"], meal["use_count"], meal["last_used_at"]) for meal in library] == [
        ("Tacos", 3, "2026-10-07T14:00:00Z"),
        ("Soup", 2, "2026-10-07T14:02:00Z"),  # the same count: the latest first
        ("Pizza night", 2, "2026-10-07T14:01:00Z"),
        ("apple crumble", 0, None),  # never made: by name
        ("Apple pie", 0, None),
        ("Pasta night", 0, None),
    ]
    assert [meal["text"] for meal in await saved_meals(parent, "PI")] == [
        "Pizza night",
        "Apple pie",
    ]
    assert [meal["text"] for meal in await saved_meals(parent, " apple ")] == [
        "apple crumble",
        "Apple pie",
    ]
    assert len(await saved_meals(parent, "  ")) == 6
    assert await saved_meals(parent, "lasagna") == []
    too_long = await parent.get("/api/meals/saved", params={"q": "x" * 121})
    assert too_long.status_code == 422


async def test_one_answer_lists_a_hundred_saved_meals(
    app: FastAPI, parent: httpx.AsyncClient, family: Family, clock: FakeClock
) -> None:
    now = clock.now()
    async with state_of(app).db.write() as tx:
        for number in range(105):
            tx.session.add(
                SavedMeal(
                    text=f"Meal {number:03}",
                    use_count=number,
                    last_used_at=now,
                    created_at=now,
                    updated_at=now,
                )
            )
    library = await saved_meals(parent)
    assert (len(library), library[0]["text"], library[-1]["text"]) == (100, "Meal 104", "Meal 005")


async def test_a_meal_is_saved_once(parent: httpx.AsyncClient, family: Family) -> None:
    tacos = await save_meal(parent, "Tacos", emoji="🌮")
    for text in ("Tacos", " tacos ", "TACOS"):
        refused = await parent.post("/api/meals/saved", json={"text": text}, headers=CSRF)
        assert error(refused) == (409, "already_saved", "That meal is saved already.")
    # Typed on a day, it's that saved meal.
    assert (await plan(parent, WED, "tacos"))["saved_meal_id"] == tacos["id"]
    # A new name can't be another's; a meal's own name in other letters is fine.
    soup = await save_meal(parent, "Soup")
    clash = await parent.patch(
        f"/api/meals/saved/{soup['id']}", json={"text": "TACOS"}, headers=CSRF
    )
    assert error(clash) == (409, "already_saved", "That meal is saved already.")
    recased = await parent.patch(
        f"/api/meals/saved/{tacos['id']}", json={"text": "TACOS"}, headers=CSRF
    )
    assert (recased.status_code, recased.json()["text"]) == (200, "TACOS")
    for body in (
        {"text": " "},
        {"text": "x" * 121},
        {"text": "Stew", "ingredients": [""]},
        {"text": "Stew", "ingredients": ["Beans"] * 51},
        {"text": "Stew", "recipe_url": "x" * 501},
    ):
        response = await parent.post("/api/meals/saved", json=body, headers=CSRF)
        assert response.status_code == 422, body


async def test_changing_a_saved_meal_changes_only_what_is_sent(
    parent: httpx.AsyncClient, family: Family, clock: FakeClock
) -> None:
    tacos = await save_meal(
        parent,
        "Tacos",
        emoji="🌮",
        recipe_url="https://example.com/recipes/tacos",
        ingredients=["Tortillas", "Cheese"],
    )
    entry = await plan(parent, WED, "Tacos")

    async def change(**body: object) -> Json:
        response = await parent.patch(f"/api/meals/saved/{tacos['id']}", json=body, headers=CSRF)
        assert response.status_code == 200, response.text
        changed: Json = response.json()
        return changed

    clock.advance(minutes=1)
    renamed = await change(text="Taco night")
    assert (renamed["text"], renamed["emoji"], renamed["recipe_url"], renamed["ingredients"]) == (
        "Taco night",
        "🌮",
        "https://example.com/recipes/tacos",
        ["Tortillas", "Cheese"],
    )
    assert (renamed["use_count"], renamed["last_used_at"]) == (1, "2026-10-07T14:00:00Z")
    # Each ingredient once, as first written.
    listed = await change(ingredients=["Tortillas", "cheese", " Cheese ", "Salsa"])
    assert listed["ingredients"] == ["Tortillas", "cheese", "Salsa"]
    cleared = await change(emoji="", recipe_url=" ")
    assert (cleared["emoji"], cleared["recipe_url"], cleared["text"]) == (None, None, "Taco night")
    assert await change() == cleared  # nothing sent, nothing changed
    # A meal on a day keeps its own name and emoji, and shows the new ingredients.
    [planned] = (await week(parent))["entries"]
    assert (planned["id"], planned["text"], planned["emoji"], planned["ingredients"]) == (
        entry["id"],
        "Tacos",
        "🌮",
        ["Tortillas", "cheese", "Salsa"],
    )
    unknown = await parent.patch("/api/meals/saved/not-a-meal", json={}, headers=CSRF)
    assert (unknown.status_code, unknown.json()["error"]) == (404, SAVED_GONE)


async def test_an_archived_meal_waits_in_recently_removed(
    parent: httpx.AsyncClient, family: Family, clock: FakeClock
) -> None:
    tacos = await save_meal(parent, "Tacos", emoji="🌮", ingredients=["Tortillas", "Salsa"])
    entry = await plan(parent, WED, "Tacos")
    clock.advance(minutes=5)
    archived = await parent.delete(f"/api/meals/saved/{tacos['id']}", headers=CSRF)
    assert archived.status_code == 204, archived.text
    assert await saved_meals(parent) == []
    assert (await removed(parent))["saved"] == [
        {"id": tacos["id"], "text": "Tacos", "deleted_at": "2026-10-07T14:05:00Z"}
    ]
    # A meal on a day keeps its link and ingredients...
    [kept] = (await week(parent))["entries"]
    assert (kept["saved_meal_id"], kept["ingredients"]) == (tacos["id"], ["Tortillas", "Salsa"])
    # ...and through a change, though an archived meal can't be changed or picked anew.
    changed = await plan(
        parent, WED, "Tacos", id=entry["id"], saved_meal_id=tacos["id"], note="Hot"
    )
    assert (changed["saved_meal_id"], changed["note"]) == (tacos["id"], "Hot")
    for response in (
        await parent.patch(f"/api/meals/saved/{tacos['id']}", json={"emoji": "🌯"}, headers=CSRF),
        await parent.delete(f"/api/meals/saved/{tacos['id']}", headers=CSRF),
        await put_entry(parent, THU, "Tacos", saved_meal_id=tacos["id"]),
    ):
        assert (response.status_code, response.json()["error"]) == (404, SAVED_GONE)
    # Typed again, the name makes a new saved meal...
    fresh = await plan(parent, FRI, "Tacos")
    assert fresh["saved_meal_id"] not in (None, tacos["id"])
    # ...so the archived one can't come back while that one is saved.
    refused = await parent.post(f"/api/meals/saved/{tacos['id']}/restore", headers=CSRF)
    assert error(refused) == (409, "already_saved", "That meal is saved already.")
    gone = await parent.delete(f"/api/meals/saved/{fresh['saved_meal_id']}", headers=CSRF)
    assert gone.status_code == 204, gone.text
    back = await parent.post(f"/api/meals/saved/{tacos['id']}/restore", headers=CSRF)
    assert back.status_code == 200, back.text
    assert (back.json()["id"], back.json()["ingredients"]) == (tacos["id"], ["Tortillas", "Salsa"])
    again = await parent.post(f"/api/meals/saved/{tacos['id']}/restore", headers=CSRF)
    assert again.status_code == 200  # here already: nothing to do
    assert [meal["id"] for meal in await saved_meals(parent)] == [tacos["id"]]
    unknown = await parent.post("/api/meals/saved/not-a-meal/restore", headers=CSRF)
    assert (unknown.status_code, unknown.json()["error"]) == (404, SAVED_GONE)


async def test_recently_removed_is_the_last_week_newest_first(
    parent: httpx.AsyncClient, family: Family, clock: FakeClock
) -> None:
    tacos = await plan(parent, WED, "Tacos")
    soup = await plan(parent, THU, "Soup", slot="lunch")
    removed_tacos = await parent.delete(f"/api/meals/entries/{tacos['id']}", headers=CSRF)
    assert removed_tacos.status_code == 204
    clock.advance(hours=1)
    await plan(parent, THU, "Salad", slot="lunch")  # replaces the soup
    clock.advance(hours=1)
    pasta = await save_meal(parent, "Pasta night")
    assert (await parent.delete(f"/api/meals/saved/{pasta['id']}", headers=CSRF)).status_code == 204
    assert await removed(parent) == {
        "entries": [
            {
                "id": soup["id"],
                "day": "2026-10-08",
                "slot": "lunch",
                "text": "Soup",
                "deleted_at": "2026-10-07T15:00:00Z",
            },
            {
                "id": tacos["id"],
                "day": "2026-10-07",
                "slot": "dinner",
                "text": "Tacos",
                "deleted_at": "2026-10-07T14:00:00Z",
            },
        ],
        "saved": [{"id": pasta["id"], "text": "Pasta night", "deleted_at": "2026-10-07T16:00:00Z"}],
    }
    # A week on, the last of them is still there for a minute.
    clock.advance(days=7)
    left = await removed(parent)
    assert (left["entries"], [s["text"] for s in left["saved"]]) == ([], ["Pasta night"])
    clock.advance(minutes=1)
    assert await removed(parent) == {"entries": [], "saved": []}
