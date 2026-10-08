"""The Sample Family's countdowns (test mode only: ``just seed``, screenshots, end-to-end runs).

Grandma visits in 5 days, the camping trip in 17, Halloween every year (Mia's), and Ana's
surprise party in 40 days, kept off the wall. Mia's birthday (October 19) comes up in 12 days by
itself, from Family. Synthetic only.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from sunroom.db.types import new_id
from sunroom.domain.timeparts import to_local
from sunroom.plugins.context import PluginContext
from sunroom.plugins.countdowns.models import Countdown


async def seed(ctx: PluginContext, people: dict[str, str]) -> None:
    async with ctx.read() as session:
        if await session.scalar(select(Countdown.id).limit(1)) is not None:
            return
    now = ctx.now()
    today = to_local(now, ctx.zone()).date()
    ana, sam, mia = (people.get(name) for name in ("Ana", "Sam", "Mia"))

    def countdown(
        title: str,
        emoji: str,
        on: date,
        *,
        by: str | None,
        member: str | None = None,
        color: str | None = None,
        yearly: bool = False,
        shown: bool = True,
    ) -> Countdown:
        return Countdown(
            id=new_id(),
            title=title,
            emoji=emoji,
            color=color,
            date=on,
            time=None,
            repeat_yearly=yearly,
            member_id=member,
            show_on_display=shown,
            created_by_member_id=by,
            created_at=now,
            updated_at=now,
            deleted_at=None,
        )

    rows = [
        countdown("Grandma visits", "👵", today + timedelta(days=5), by=ana),
        countdown("Camping trip", "⛺", today + timedelta(days=17), by=sam, color="moss"),
        countdown("Halloween", "🎃", date(today.year, 10, 31), by=mia, member=mia, yearly=True),
        countdown("Ana's surprise party", "🎉", today + timedelta(days=40), by=sam, shown=False),
    ]
    async with ctx.write() as tx:
        tx.session.add_all(rows)
        for row in rows:
            tx.publish("countdowns.changed", {"id": row.id})
