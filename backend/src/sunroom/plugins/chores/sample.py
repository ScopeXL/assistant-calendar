"""The Sample Family's chores (test mode only: ``just seed``, screenshots, end-to-end runs), as
UX §4 draws them: Mia has Feed the dog and Make bed; Leo has Make bed, already done ("All done,
Leo!"); Sam takes out the trash; anyone empties the dishwasher (Mia's turn) and waters the
plants. A week of history gives streaks and "+ this week"; Mia has 42 stars and Leo 18. Three
rewards, a morning routine for every kid and Leo's bedtime routine. Synthetic only.
"""

from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta

from sqlalchemy import select

from sunroom.domain.chores import Rule, turn_on
from sunroom.domain.timeparts import from_local, to_local
from sunroom.plugins.chores.models import (
    AssigneeMode,
    Chore,
    ChoreCompletion,
    PointAdjustment,
    Reward,
    Routine,
    RoutineStep,
)
from sunroom.plugins.context import PluginContext

HISTORY_DAYS = 6
STARS = {"Mia": 42, "Leo": 18}


async def seed(ctx: PluginContext, people: dict[str, str]) -> None:
    async with ctx.read() as session:
        if await session.scalar(select(Chore.id).limit(1)) is not None:
            return
    mia, leo, sam = people.get("Mia"), people.get("Leo"), people.get("Sam")
    if not (mia and leo and sam):
        return
    zone = ctx.zone()
    now = ctx.now()
    today = to_local(now, zone).date()
    first = today - timedelta(days=30)

    def at(day: date, hour: int, minute: int) -> datetime:
        return from_local(datetime.combine(day, time(hour, minute)), zone)

    async with ctx.write() as tx:

        def chore(
            title: str, members: list[str], mode: str, points: int, due: str | None = None
        ) -> Chore:
            row = Chore(
                title=title,
                points=points,
                rrule="FREQ=DAILY",
                start_date=first,
                due_time=due,
                assignee_mode=mode,
                assignee_member_ids_json=json.dumps(members),
                created_by_member_id=people.get("Ana"),
                created_at=at(first, 9, 0),
                updated_at=at(first, 9, 0),
            )
            tx.session.add(row)
            return row

        dog = chore("Feed the dog", [mia], AssigneeMode.FIXED, 2, "17:00")
        bed = chore("Make bed", [mia, leo], AssigneeMode.FIXED, 1)
        trash = chore("Take out the trash", [sam], AssigneeMode.FIXED, 0, "20:00")
        dishes = chore("Empty the dishwasher", [mia, leo], AssigneeMode.ROTATE, 1)
        plants = chore("Water the plants", [], AssigneeMode.ANY, 1)
        await tx.session.flush()

        earned = {mia: 0, leo: 0}

        def done(row: Chore, day: date, member: str, hour: int, minute: int) -> None:
            tx.session.add(
                ChoreCompletion(
                    chore_id=row.id,
                    due_date=day,
                    member_id=member,
                    completed_at=at(day, hour, minute),
                    points_awarded=row.points,
                )
            )
            if member in earned:
                earned[member] += row.points

        rotation = Rule(dishes.id, first, "FREQ=DAILY", "rotate", (mia, leo))
        for back in range(HISTORY_DAYS, 0, -1):
            day = today - timedelta(days=back)
            done(bed, day, mia, 7, 40)
            done(bed, day, leo, 7, 55)
            done(dog, day, mia, 16, 30)
            done(trash, day, sam, 19, 45)
            done(dishes, day, turn_on(rotation, day) or mia, 18, 10)
            done(plants, day, leo if back % 2 else mia, 17, 5)
        done(bed, today, mia, 7, 42)
        done(bed, today, leo, 7, 50)
        for name, member in (("Mia", mia), ("Leo", leo)):
            tx.session.add(
                PointAdjustment(
                    member_id=member,
                    points=STARS[name] - earned[member],
                    reason="Stars from before Sunroom",
                    by_member_id=people.get("Ana"),
                    created_at=at(first, 9, 5),
                )
            )

        for sort, (title, cost) in enumerate(
            (("Pick the dinner", 15), ("Ice cream run", 20), ("Movie night", 30))
        ):
            tx.session.add(
                Reward(title=title, cost_points=cost, sort=sort, created_at=at(first, 9, 10))
            )

        routines: list[tuple[str, str | None, str, str, int, list[tuple[str, str]]]] = [
            (
                "Morning routine",
                None,
                "07:00",
                "08:00",
                1,
                [
                    ("Get dressed", "shirt"),
                    ("Breakfast", "plate"),
                    ("Brush teeth", "toothbrush"),
                    ("Pack your bag", "backpack"),
                ],
            ),
            (
                "Bedtime routine",
                leo,
                "19:30",
                "20:30",
                5,
                [
                    ("Pajamas on", "shirt"),
                    ("Brush teeth", "toothbrush"),
                    ("Read a book", "book"),
                    ("Glass of water", "water"),
                    ("Into bed", "bed"),
                ],
            ),
        ]
        for title, member, start, end, points, steps in routines:
            row = Routine(
                title=title,
                member_id=member,
                window_start=start,
                window_end=end,
                points=points,
                created_at=at(first, 9, 15),
            )
            tx.session.add(row)
            await tx.session.flush()
            for position, (step, icon) in enumerate(steps):
                tx.session.add(
                    RoutineStep(routine_id=row.id, title=step, icon=icon, position=position)
                )
        tx.publish("chores.changed", {})
        tx.publish("routines.changed", {})
