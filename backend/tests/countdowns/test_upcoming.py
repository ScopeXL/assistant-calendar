"""Coming up (PLAN §9, §11.3, §15 M4 verify; UX §3 "Coming up", §4 "Countdowns room"): the
countdowns still to come and each person's next birthday with the age it brings, soonest first,
from the household's today or a day asked for; cut short for the Today panel; birthdays left out
when asked or switched off. Wednesday 2026-10-07 is today (10:00 in New York). The Sample Family
only."""

from __future__ import annotations

from datetime import UTC, datetime

import httpx

from sunroom.core.clock import FakeClock
from tests.countdowns.helpers import Family, add_countdown, day, error, titles, upcoming
from tests.support import CSRF


async def set_birthdays(client: httpx.AsyncClient, on: bool) -> None:
    response = await client.put(
        "/api/plugins/countdowns/settings", json={"values": {"birthdays": on}}, headers=CSRF
    )
    assert response.status_code == 200, response.text


async def test_coming_up_has_countdowns_and_birthdays_soonest_first(
    parent: httpx.AsyncClient, family: Family
) -> None:
    grandma = await add_countdown(parent, "Grandma visits", day(5), emoji="👵")
    carving = await add_countdown(
        parent, "Pumpkin carving", "2026-10-19", member_id=family.leo, color="clay", time="16:00"
    )
    await add_countdown(parent, "apple picking", "2026-10-19")
    await add_countdown(parent, "Halloween", "2024-10-31", repeat_yearly=True, emoji="🎃")
    found = await upcoming(parent)
    assert found["today"] == "2026-10-07"
    items = found["items"]
    assert [(i["kind"], i["title"], i["date"], i["days"], i["turning"]) for i in items] == [
        ("countdown", "Grandma visits", "2026-10-12", 5, None),
        ("birthday", "Mia's birthday", "2026-10-19", 12, 9),  # on the same day, birthdays first
        ("countdown", "apple picking", "2026-10-19", 12, None),
        ("countdown", "Pumpkin carving", "2026-10-19", 12, None),
        ("countdown", "Halloween", "2026-10-31", 24, None),  # yearly: this year's
        ("birthday", "Leo's birthday", "2027-02-03", 119, 7),
        ("birthday", "Ana's birthday", "2027-04-12", 187, 39),  # Sam has no birthday set
    ]
    by_key = {item["key"]: item for item in items}
    assert by_key[f"countdown:{carving['id']}"] == {
        "key": f"countdown:{carving['id']}",
        "kind": "countdown",
        "countdown_id": carving["id"],
        "title": "Pumpkin carving",
        "emoji": None,
        "color": "clay",
        "member_id": family.leo,
        "date": "2026-10-19",
        "time": "16:00",
        "days": 12,
        "turning": None,
        "show_on_display": True,
    }
    assert by_key[f"birthday:{family.mia}"] == {
        "key": f"birthday:{family.mia}",
        "kind": "birthday",
        "countdown_id": None,
        "title": "Mia's birthday",
        "emoji": None,
        "color": None,  # the person's own
        "member_id": family.mia,
        "date": "2026-10-19",
        "time": None,
        "days": 12,
        "turning": 9,
        "show_on_display": True,
    }
    assert by_key[f"countdown:{grandma['id']}"]["emoji"] == "👵"


async def test_today_is_the_households(
    parent: httpx.AsyncClient, family: Family, clock: FakeClock
) -> None:
    await add_countdown(parent, "Fall fair", day(0))
    await add_countdown(parent, "Zoo day", day(1))
    # 11:30 PM in New York: still Wednesday there, though Thursday in UTC.
    clock.set(datetime(2026, 10, 8, 3, 30, tzinfo=UTC))
    found = await upcoming(parent, include_birthdays=False)
    assert found["today"] == "2026-10-07"
    assert [(i["title"], i["days"]) for i in found["items"]] == [("Fall fair", 0), ("Zoo day", 1)]
    # Midnight there: the fair has passed, and the zoo is today.
    clock.set(datetime(2026, 10, 8, 4, 0, tzinfo=UTC))
    found = await upcoming(parent, include_birthdays=False)
    assert found["today"] == "2026-10-08"
    assert [(i["title"], i["days"]) for i in found["items"]] == [("Zoo day", 0)]


async def test_coming_up_from_another_day(parent: httpx.AsyncClient, family: Family) -> None:
    await add_countdown(parent, "Grandma visits", day(5))
    await add_countdown(parent, "Halloween", "2024-10-31", repeat_yearly=True)
    found = await upcoming(parent, date="2026-11-01")
    assert found["today"] == "2026-11-01"
    assert [(i["title"], i["date"], i["days"], i["turning"]) for i in found["items"]] == [
        ("Leo's birthday", "2027-02-03", 94, 7),
        ("Ana's birthday", "2027-04-12", 162, 39),
        ("Mia's birthday", "2027-10-19", 352, 10),
        ("Halloween", "2027-10-31", 364, None),
    ]


async def test_the_today_panel_asks_for_a_few(parent: httpx.AsyncClient, family: Family) -> None:
    await add_countdown(parent, "Grandma visits", day(5))
    await add_countdown(parent, "Camping trip", day(17))
    everything = [
        "Grandma visits",
        "Mia's birthday",
        "Camping trip",
        "Leo's birthday",
        "Ana's birthday",
    ]
    assert titles((await upcoming(parent))["items"]) == everything
    assert titles((await upcoming(parent, limit=50))["items"]) == everything
    assert titles((await upcoming(parent, limit=2))["items"]) == everything[:2]
    no_birthdays = (await upcoming(parent, include_birthdays=False))["items"]
    assert titles(no_birthdays) == ["Grandma visits", "Camping trip"]
    for limit in (0, 51, "a few"):
        response = await parent.get("/api/countdowns/upcoming", params={"limit": limit})
        assert error(response) == (422, "invalid", "Some of the details aren't valid."), limit


async def test_birthdays_count_down_while_the_setting_is_on(
    parent: httpx.AsyncClient, family: Family
) -> None:
    await add_countdown(parent, "Grandma visits", day(5))
    await set_birthdays(parent, False)
    assert titles((await upcoming(parent))["items"]) == ["Grandma visits"]
    await set_birthdays(parent, True)
    assert len((await upcoming(parent))["items"]) == 4


async def test_a_birthday_follows_the_family(parent: httpx.AsyncClient, family: Family) -> None:
    # February 29 comes round on the 28th in other years.
    leap = await parent.patch(
        f"/api/members/{family.leo}", json={"birthday": "2016-02-29"}, headers=CSRF
    )
    assert leap.status_code == 200, leap.text
    # Someone archived has no birthday here.
    archived = await parent.post(f"/api/members/{family.mia}/archive", headers=CSRF)
    assert archived.status_code == 200, archived.text
    # A birthday typed after today first comes round on the day itself.
    later = await parent.patch(
        f"/api/members/{family.sam}", json={"birthday": "2027-01-15"}, headers=CSRF
    )
    assert later.status_code == 200, later.text
    found = await upcoming(parent)
    assert [(i["title"], i["date"], i["turning"]) for i in found["items"]] == [
        ("Sam's birthday", "2027-01-15", 0),
        ("Leo's birthday", "2027-02-28", 11),
        ("Ana's birthday", "2027-04-12", 39),
    ]
