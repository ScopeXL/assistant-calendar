"""The Sample Family's meals (test mode only: ``just seed``, screenshots, end-to-end runs), as
UX §4 draws the Meals room: this week's dinners from Sunday's roast chicken to Friday's pizza
night, Saturday still open and Tacos tonight (the test clock's today is a Wednesday), and last
week's too, so Copy last week has something to copy. The saved meals have use counts; Tacos and
Pasta night carry their ingredients, and Grilled cheese and soup is saved but on no day yet.
Synthetic only.
"""

from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta

from sqlalchemy import select

from sunroom.domain.timeparts import from_local, to_local, week_start
from sunroom.plugins.context import PluginContext
from sunroom.plugins.meals.models import MealEntry, MealSlot, SavedMeal

# The library: each meal's emoji, how often it was made, its ingredients and a recipe link.
SAVED: tuple[tuple[str, str | None, int, tuple[str, ...], str | None], ...] = (
    ("Tacos", "🌮", 9, ("Tortillas", "Ground beef", "Cheese", "Lettuce", "Salsa"), None),
    ("Pizza night", "🍕", 7, (), None),
    ("Pasta night", "🍝", 6, ("Pasta", "Tomato sauce", "Parmesan"), None),
    ("Leftovers", None, 5, (), None),
    ("Roast chicken", "🍗", 4, (), None),
    ("Salmon and rice", "🐟", 3, (), "https://example.com/recipes/salmon-and-rice"),
    ("Grilled cheese and soup", "🥪", 2, (), None),
)

# Dinner by weekday (Monday 0 … Sunday 6): the meal, who cooks, and a note.
Plan = dict[int, tuple[str, str | None, str | None]]
THIS_WEEK: Plan = {
    6: ("Roast chicken", "Ana", None),
    0: ("Pasta night", None, None),
    1: ("Salmon and rice", "Sam", None),
    2: ("Tacos", "Sam", None),
    3: ("Leftovers", None, "Whatever's in the fridge"),
    4: ("Pizza night", "Ana", None),
}
LAST_WEEK: Plan = {
    6: ("Pasta night", None, None),
    0: ("Tacos", "Sam", None),
    1: ("Roast chicken", "Ana", None),
    2: ("Leftovers", None, None),
    3: ("Salmon and rice", "Sam", None),
    4: ("Pizza night", "Ana", None),
}


async def seed(ctx: PluginContext, people: dict[str, str]) -> None:
    async with ctx.read() as session:
        if await session.scalar(select(SavedMeal.id).limit(1)) is not None:
            return
        if await session.scalar(select(MealEntry.id).limit(1)) is not None:
            return
    zone = ctx.zone()
    first = week_start(to_local(ctx.now(), zone).date(), (await ctx.household.get()).week_starts_on)
    ana = people.get("Ana")

    def evening(day: date) -> datetime:
        """6 PM on ``day`` in the household's time: when the family plans the week ahead."""
        return from_local(datetime.combine(day, time(18, 0)), zone)

    async with ctx.write() as tx:
        long_ago = evening(first - timedelta(days=60))
        library: dict[str, SavedMeal] = {}
        for text, emoji, uses, ingredients, link in SAVED:
            library[text] = SavedMeal(
                text=text,
                emoji=emoji,
                recipe_url=link,
                ingredients_json=json.dumps(list(ingredients)),
                use_count=uses,
                last_used_at=evening(first - timedelta(days=22)),
                created_by_member_id=ana,
                created_at=long_ago,
                updated_at=long_ago,
            )
        tx.session.add_all(library.values())
        await tx.session.flush()
        days: list[date] = []
        for start, plan in ((first - timedelta(days=7), LAST_WEEK), (first, THIS_WEEK)):
            planned = evening(start - timedelta(days=1))
            for offset in range(7):
                day = start + timedelta(days=offset)
                if day.weekday() not in plan:
                    continue
                text, cook, note = plan[day.weekday()]
                meal = library[text]
                tx.session.add(
                    MealEntry(
                        day=day,
                        slot=MealSlot.DINNER,
                        position=0,
                        text=text,
                        emoji=meal.emoji,
                        recipe_url=meal.recipe_url,
                        note=note,
                        member_id=people.get(cook) if cook else None,
                        saved_meal_id=meal.id,
                        created_by_member_id=ana,
                        created_at=planned,
                        updated_at=planned,
                    )
                )
                meal.last_used_at = planned
                days.append(day)
        tx.publish("meals.changed", {"days": [day.isoformat() for day in days]})
