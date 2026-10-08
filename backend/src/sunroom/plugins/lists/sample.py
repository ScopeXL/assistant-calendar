"""The Sample Family's lists (test mode only: ``just seed``, screenshots, end-to-end runs).

Groceries with a few things to get, one done, and a history of cleared items so its Usuals have
something to show; a to-do list with one thing due today; a packing list. Synthetic only.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select

from sunroom.domain.timeparts import to_local
from sunroom.plugins.context import PluginContext
from sunroom.plugins.lists.models import ListItem, ListKind, ShoppingList


async def seed(ctx: PluginContext, people: dict[str, str]) -> None:
    async with ctx.read() as session:
        if await session.scalar(select(ShoppingList.id).limit(1)) is not None:
            return
    now = ctx.now()
    today = to_local(now, ctx.zone()).date()
    ana, sam, mia, leo = (people.get(name) for name in ("Ana", "Sam", "Mia", "Leo"))

    def ago(**delta: float) -> datetime:
        return now - timedelta(**delta)

    async with ctx.write() as tx:
        groceries = ShoppingList(
            name="Groceries",
            kind=ListKind.GROCERY,
            sort=0,
            created_by_member_id=ana,
            created_at=ago(days=60),
            updated_at=ago(hours=1),
        )
        todo = ShoppingList(
            name="To do",
            kind=ListKind.TODO,
            sort=1,
            created_by_member_id=sam,
            created_at=ago(days=60),
            updated_at=ago(days=1),
        )
        packing = ShoppingList(
            name="Packing: beach",
            kind=ListKind.PACKING,
            sort=2,
            created_by_member_id=ana,
            created_at=ago(days=3),
            updated_at=ago(days=2),
        )
        tx.session.add_all([groceries, todo, packing])
        await tx.session.flush()
        position = 0

        def item(
            on: ShoppingList,
            text: str,
            *,
            by: str | None = None,
            added: datetime,
            checked: datetime | None = None,
            checker: str | None = None,
            cleared: datetime | None = None,
            due: int | None = None,
            who: str | None = None,
            quantity: str | None = None,
        ) -> None:
            nonlocal position
            position += 1
            tx.session.add(
                ListItem(
                    list_id=on.id,
                    text=text,
                    quantity=quantity,
                    due_date=today + timedelta(days=due) if due is not None else None,
                    assigned_member_id=who,
                    checked_at=checked,
                    checked_by_member_id=checker if checked else None,
                    position=position,
                    created_by_member_id=by,
                    created_at=added,
                    updated_at=checked or added,
                    cleared_at=cleared,
                )
            )

        # What the household buys most (cleared on earlier shopping trips): the Usuals.
        for week in (3, 2):
            for text in ("Apples", "Yogurt", "Cheese", "Milk"):
                bought = ago(days=7 * week)
                item(
                    groceries,
                    text,
                    by=ana,
                    added=bought - timedelta(days=1),
                    checked=bought,
                    checker=ana,
                    cleared=bought + timedelta(hours=2),
                )
        item(groceries, "Milk", by=mia, added=ago(hours=2))
        item(groceries, "Eggs", by=sam, added=ago(hours=5))
        item(groceries, "Bananas", by=ana, added=ago(hours=6), quantity="6")
        item(groceries, "Shin guards", by=ana, added=ago(days=1), due=1, who=mia)
        item(groceries, "Bread", by=sam, added=ago(days=1), checked=ago(hours=1), checker=ana)

        item(todo, "Call the plumber", by=sam, added=ago(days=2), due=0, who=sam)
        item(todo, "Return library books", by=ana, added=ago(days=1), due=1, who=leo)
        item(todo, "Sign the field trip form", by=mia, added=ago(days=1), who=ana)

        item(packing, "Sunscreen", by=ana, added=ago(days=2))
        item(packing, "Towels", by=ana, added=ago(days=2))
        item(packing, "Sand toys", by=leo, added=ago(days=2), who=leo)
        item(packing, "Snacks", by=sam, added=ago(days=2))
        for shopping in (groceries, todo, packing):
            tx.publish("lists.changed", {"list_id": shopping.id})
