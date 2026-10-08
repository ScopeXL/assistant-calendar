"""The calendar API end to end (PLAN §7, §11.1): adding, scoped changes, removing, moving, Undo,
occurrences, calendars. The fake clock reads Wednesday 2026-10-07, 10:00 in New York.
Synthetic data only."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy import update

from sunroom.calendar.models import Calendar, Event
from sunroom.calendar.schemas import OccurrenceOut
from tests.support import CSRF, PASSWORD, add_member, set_pin, state_of

WEEK = {"from": "2026-10-04", "to": "2026-10-11"}  # Sun Oct 4 to Sat Oct 10


async def week(client: httpx.AsyncClient, **params: Any) -> list[dict[str, Any]]:
    response = await client.get("/api/calendar/occurrences", params=WEEK | params)
    assert response.status_code == 200, response.text
    found: list[dict[str, Any]] = response.json()["occurrences"]
    return found


async def add(client: httpx.AsyncClient, **body: Any) -> dict[str, Any]:
    response = await client.post("/api/calendar/events", json=body, headers=CSRF)
    assert response.status_code == 201, response.text
    change: dict[str, Any] = response.json()
    return change


async def soccer(client: httpx.AsyncClient, **extra: Any) -> dict[str, Any]:
    """Every Tuesday and Thursday, 4 to 5 PM, from Tuesday Sep 29."""
    change = await add(
        client,
        title="Soccer practice",
        start="2026-09-29T16:00",
        end="2026-09-29T17:00",
        rrule="FREQ=WEEKLY;BYDAY=TU,TH",
        **extra,
    )
    event: dict[str, Any] = change["event"]
    return event


def starts(found: list[dict[str, Any]], title: str) -> list[str]:
    return [o["start_local"] for o in found if o["title"] == title]


async def test_a_new_household_has_a_home_calendar(parent: httpx.AsyncClient) -> None:
    calendars = (await parent.get("/api/calendar/calendars")).json()
    assert [(c["name"], c["is_default"], c["kind"]) for c in calendars] == [("Home", True, "local")]


async def test_quick_add_lands_on_thursday_for_mia(
    parent: httpx.AsyncClient, events: list[tuple[str, dict[str, Any]]]
) -> None:
    mia = await add_member(parent, "Mia", role="kid")
    change = await add(parent, title="Dentist", start="2026-10-08T14:30", member_ids=[mia["id"]])
    event = change["event"]
    assert event["end"] == "2026-10-08T15:30:00"  # an hour unless told otherwise
    assert event["tzid"] == "America/New_York"
    found = await week(parent)
    assert [(o["title"], o["start_local"], o["member_ids"]) for o in found] == [
        ("Dentist", "2026-10-08T14:30:00", [mia["id"]])
    ]
    assert found[0]["start_utc"] == "2026-10-08T18:30:00Z"
    kinds = [kind for kind, _ in events]
    assert "events.changed" in kinds
    payload = next(p for kind, p in events if kind == "events.changed")
    assert payload["event_ids"] == [event["id"]] and payload["calendar_version"] >= 2


async def test_all_day_spans_keep_their_dates(parent: httpx.AsyncClient) -> None:
    await add(parent, title="Grandparents visiting", start_date="2026-10-08", end_date="2026-10-11")
    found = await week(parent)
    assert [(o["start_date"], o["end_date"], o["all_day"]) for o in found] == [
        ("2026-10-08", "2026-10-11", True)
    ]
    assert await week(parent, **{"from": "2026-10-11", "to": "2026-10-12"}) == []


async def test_a_repeating_event_expands_and_one_occurrence_can_change(
    parent: httpx.AsyncClient,
) -> None:
    event = await soccer(parent)
    assert starts(await week(parent), "Soccer practice") == [
        "2026-10-06T16:00:00",
        "2026-10-08T16:00:00",
    ]
    response = await parent.patch(
        f"/api/calendar/events/{event['id']}/occurrences/2026-10-08T16:00:00",
        json={"scope": "this", "start": "2026-10-08T17:30", "title": "Soccer (late)"},
        headers=CSRF,
    )
    assert response.status_code == 200, response.text
    found = await week(parent)
    changed = next(o for o in found if o["is_override"])
    assert (changed["title"], changed["start_local"], changed["end_local"]) == (
        "Soccer (late)",
        "2026-10-08T17:30:00",
        "2026-10-08T18:30:00",
    )
    assert changed["key"] == f"{event['id']}|2026-10-08T16:00:00"
    assert starts(found, "Soccer practice") == ["2026-10-06T16:00:00"]
    # The next week is untouched.
    later = await week(parent, **{"from": "2026-10-11", "to": "2026-10-18"})
    assert starts(later, "Soccer practice") == ["2026-10-13T16:00:00", "2026-10-15T16:00:00"]


async def test_this_and_following_splits_and_undo_joins_it_back(
    parent: httpx.AsyncClient,
) -> None:
    event = await soccer(parent)
    response = await parent.patch(
        f"/api/calendar/events/{event['id']}/occurrences/2026-10-08T16:00:00",
        json={"scope": "following", "start": "2026-10-08T17:00", "end": "2026-10-08T18:00"},
        headers=CSRF,
    )
    assert response.status_code == 200, response.text
    change = response.json()
    sibling = change["event"]
    assert sibling["id"] != event["id"] and sibling["rrule"] == "FREQ=WEEKLY;BYDAY=TU,TH"
    found = await week(parent)
    assert starts(found, "Soccer practice") == ["2026-10-06T16:00:00", "2026-10-08T17:00:00"]
    undone = await parent.post(
        f"/api/calendar/events/{event['id']}/undo",
        json={"revision_id": change["revision_id"]},
        headers=CSRF,
    )
    assert undone.status_code == 200, undone.text
    assert starts(await week(parent), "Soccer practice") == [
        "2026-10-06T16:00:00",
        "2026-10-08T16:00:00",
    ]
    missing = await parent.get(f"/api/calendar/events/{sibling['id']}")
    assert missing.status_code == 404


async def test_changing_the_time_of_all_keeps_one_offs_in_step(parent: httpx.AsyncClient) -> None:
    event = await soccer(parent)
    gone = await parent.delete(
        f"/api/calendar/events/{event['id']}/occurrences/2026-10-06T16:00:00",
        params={"scope": "this"},
        headers=CSRF,
    )
    assert gone.status_code == 200, gone.text
    response = await parent.patch(
        f"/api/calendar/events/{event['id']}",
        json={"start": "2026-09-29T16:30", "end": "2026-09-29T17:30"},
        headers=CSRF,
    )
    assert response.status_code == 200, response.text
    assert response.json()["event"]["exdates"] == ["2026-10-06T16:30:00"]
    assert starts(await week(parent), "Soccer practice") == ["2026-10-08T16:30:00"]


async def test_removing_one_following_or_all(parent: httpx.AsyncClient) -> None:
    event = await soccer(parent)
    url = f"/api/calendar/events/{event['id']}"
    one = await parent.delete(
        f"{url}/occurrences/2026-10-06T16:00:00", params={"scope": "this"}, headers=CSRF
    )
    assert starts(await week(parent), "Soccer practice") == ["2026-10-08T16:00:00"]
    await parent.post(f"{url}/undo", json={"revision_id": one.json()["revision_id"]}, headers=CSRF)
    assert len(starts(await week(parent), "Soccer practice")) == 2

    await parent.delete(
        f"{url}/occurrences/2026-10-08T16:00:00", params={"scope": "following"}, headers=CSRF
    )
    assert starts(await week(parent), "Soccer practice") == ["2026-10-06T16:00:00"]
    assert await week(parent, **{"from": "2026-10-11", "to": "2026-10-18"}) == []

    removed = await parent.delete(url, headers=CSRF)
    assert removed.status_code == 200 and removed.json()["event"] is None
    assert await week(parent) == []
    listed = (await parent.get("/api/calendar/removed")).json()
    assert [e["title"] for e in listed] == ["Soccer practice"]
    back = await parent.post(f"{url}/restore", headers=CSRF)
    assert back.status_code == 200, back.text
    assert starts(await week(parent), "Soccer practice") == ["2026-10-06T16:00:00"]


async def test_moving_by_drag(parent: httpx.AsyncClient) -> None:
    one = (await add(parent, title="Vet", start="2026-10-07T09:00", end="2026-10-07T09:30"))[
        "event"
    ]
    moved = await parent.post(
        f"/api/calendar/events/{one['id']}/move", json={"to_date": "2026-10-09"}, headers=CSRF
    )
    assert moved.status_code == 200, moved.text
    assert (moved.json()["event"]["start"], moved.json()["event"]["end"]) == (
        "2026-10-09T09:00:00",
        "2026-10-09T09:30:00",
    )
    series = await soccer(parent)
    this = await parent.post(
        f"/api/calendar/events/{series['id']}/move",
        json={"to_date": "2026-10-07", "recurrence_id": "2026-10-06T16:00:00", "scope": "this"},
        headers=CSRF,
    )
    assert this.status_code == 200, this.text
    assert starts(await week(parent), "Soccer practice") == [
        "2026-10-07T16:00:00",
        "2026-10-08T16:00:00",
    ]
    everything = await parent.post(
        f"/api/calendar/events/{series['id']}/move",
        json={"to_date": "2026-09-30", "scope": "all"},
        headers=CSRF,
    )
    assert everything.status_code == 200, everything.text
    assert everything.json()["event"]["rrule"] == "FREQ=WEEKLY;BYDAY=WE,FR"


async def test_moving_all_from_a_later_one_moves_the_series_as_far(
    parent: httpx.AsyncClient,
) -> None:
    series = await soccer(parent)
    moved = await parent.post(
        f"/api/calendar/events/{series['id']}/move",
        json={"to_date": "2026-10-09", "recurrence_id": "2026-10-08T16:00:00", "scope": "all"},
        headers=CSRF,
    )
    assert moved.status_code == 200, moved.text
    event = moved.json()["event"]
    assert (event["start"], event["rrule"]) == ("2026-09-30T16:00:00", "FREQ=WEEKLY;BYDAY=WE,FR")
    assert starts(await week(parent), "Soccer practice") == [
        "2026-10-07T16:00:00",
        "2026-10-09T16:00:00",
    ]


async def test_an_occurrence_that_isnt_there_is_not_found(parent: httpx.AsyncClient) -> None:
    series = await soccer(parent)
    url = f"/api/calendar/events/{series['id']}"
    for rid in ("not-a-day", "2026-10-08T25:00:00", "2026-10-07T16:00:00"):
        changed = await parent.patch(
            f"{url}/occurrences/{rid}", json={"title": "Soccer", "scope": "following"}, headers=CSRF
        )
        assert changed.status_code == 404, changed.text
        removed = await parent.delete(
            f"{url}/occurrences/{rid}", params={"scope": "following"}, headers=CSRF
        )
        assert removed.status_code == 404, removed.text
        moved = await parent.post(
            f"{url}/move",
            json={"to_date": "2026-10-09", "recurrence_id": rid, "scope": "following"},
            headers=CSRF,
        )
        assert moved.status_code == 404, moved.text


async def test_one_off_dates_go_with_this_and_the_ones_after(
    parent: httpx.AsyncClient, app: FastAPI
) -> None:
    series = await soccer(parent)
    # A synced series can carry one-off dates (RDATE): two Saturdays here.
    async with state_of(app).db.write() as tx:
        await tx.session.execute(
            update(Event)
            .where(Event.id == series["id"])
            .values(rdates_json='["2026-10-03T16:00:00", "2026-10-10T16:00:00"]')
        )
        await tx.session.execute(
            update(Calendar)
            .where(Calendar.id == series["calendar_id"])
            .values(version=Calendar.version + 1)
        )
    changed = await parent.patch(
        f"/api/calendar/events/{series['id']}/occurrences/2026-10-08T16:00:00",
        json={"title": "Soccer training", "scope": "following"},
        headers=CSRF,
    )
    assert changed.status_code == 200, changed.text
    found = await week(parent, **{"from": "2026-10-01", "to": "2026-10-12"})
    assert [(o["title"], o["start_local"]) for o in found] == [
        ("Soccer practice", "2026-10-01T16:00:00"),
        ("Soccer practice", "2026-10-03T16:00:00"),
        ("Soccer practice", "2026-10-06T16:00:00"),
        ("Soccer training", "2026-10-08T16:00:00"),
        ("Soccer training", "2026-10-10T16:00:00"),
    ]


async def test_undo_refuses_when_someone_changed_it_since(parent: httpx.AsyncClient) -> None:
    event = (await add(parent, title="Vet", start="2026-10-07T09:00"))["event"]
    first = await parent.patch(
        f"/api/calendar/events/{event['id']}", json={"title": "Vet visit"}, headers=CSRF
    )
    await parent.patch(
        f"/api/calendar/events/{event['id']}", json={"location": "Sample Street"}, headers=CSRF
    )
    stale = await parent.post(
        f"/api/calendar/events/{event['id']}/undo",
        json={"revision_id": first.json()["revision_id"]},
        headers=CSRF,
    )
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "changed_since"


async def test_a_stale_version_is_refused(parent: httpx.AsyncClient) -> None:
    event = (await add(parent, title="Vet", start="2026-10-07T09:00"))["event"]
    await parent.patch(f"/api/calendar/events/{event['id']}", json={"title": "A"}, headers=CSRF)
    late = await parent.patch(
        f"/api/calendar/events/{event['id']}",
        json={"title": "B", "expected_version": event["version"]},
        headers=CSRF,
    )
    assert late.status_code == 409 and late.json()["error"]["code"] == "version_conflict"


async def test_rules_are_checked_and_described(parent: httpx.AsyncClient) -> None:
    bad = await parent.post(
        "/api/calendar/events",
        json={"title": "Too often", "start": "2026-10-07T09:00", "rrule": "FREQ=HOURLY"},
        headers=CSRF,
    )
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "rrule_unsupported"
    described = await parent.get(
        "/api/calendar/rrule/describe",
        params={"rrule": "FREQ=WEEKLY;INTERVAL=2;BYDAY=TH", "start": "2026-10-08T16:00"},
    )
    assert described.status_code == 200, described.text
    assert described.json()["text"] == "Every 2 weeks on Thu"


async def test_ranges_are_bounded(parent: httpx.AsyncClient) -> None:
    too_long = await parent.get(
        "/api/calendar/occurrences", params={"from": "2026-01-01", "to": "2026-06-01"}
    )
    assert too_long.status_code == 422


async def test_the_cache_follows_the_calendar_version(
    parent: httpx.AsyncClient, app: FastAPI
) -> None:
    await soccer(parent)
    cache = state_of(app).calendar.cache
    await week(parent)
    misses = cache.misses
    await week(parent)
    assert cache.misses == misses and cache.hits > 0
    await add(parent, title="Vet", start="2026-10-07T09:00")
    found = await week(parent)
    assert cache.misses > misses and "Vet" in [o["title"] for o in found]


async def test_people_filter_keeps_everyone_events(parent: httpx.AsyncClient) -> None:
    mia = await add_member(parent, "Mia", role="kid")
    leo = await add_member(parent, "Leo", role="kid")
    await add(parent, title="Mia's thing", start="2026-10-07T09:00", member_ids=[mia["id"]])
    await add(parent, title="Leo's thing", start="2026-10-07T10:00", member_ids=[leo["id"]])
    await add(parent, title="Family thing", start="2026-10-07T11:00")
    found = await week(parent, member_ids=[mia["id"]])
    assert [o["title"] for o in found] == ["Mia's thing", "Family thing"]


async def test_plugins_add_overlays_on_request(parent: httpx.AsyncClient, app: FastAPI) -> None:
    async def holidays(start: date, end: date, zone: ZoneInfo) -> list[OccurrenceOut]:
        day = date(2026, 10, 12)
        if not start <= day < end:
            return []
        return [
            OccurrenceOut(
                key=f"holidays|{day.isoformat()}",
                event_id=None,
                recurrence_id=None,
                calendar_id=None,
                title="Harvest Day",
                location="",
                all_day=True,
                start_utc=None,
                end_utc=None,
                start_local=None,
                end_local=None,
                start_date=day,
                end_date=day + timedelta(days=1),
                member_ids=[],
                color=None,
                calendar_color=None,
                is_recurring=False,
                is_override=False,
                read_only=True,
                source="holidays",
                status="confirmed",
                overlay="holidays",
                reminders=[],
                version=0,
            )
        ]

    state_of(app).calendar.overlays["holidays"] = holidays
    await add(parent, title="Vet", start="2026-10-13T09:00", end="2026-10-13T09:30")
    span = {"from": "2026-10-11", "to": "2026-10-18"}
    assert [o["title"] for o in await week(parent, **span)] == ["Vet"]
    found = await week(parent, **span, overlays=["holidays", "nobody-registered-this"])
    assert [(o["title"], o["overlay"], o["read_only"]) for o in found] == [
        ("Harvest Day", "holidays", True),
        ("Vet", None, False),
    ]


async def test_search_finds_the_next_one(parent: httpx.AsyncClient) -> None:
    await soccer(parent, location="Field 3")
    hits = (await parent.get("/api/calendar/search", params={"q": "field"})).json()
    assert [(h["event"]["title"], h["next_start_local"]) for h in hits] == [
        ("Soccer practice", "2026-10-08T16:00:00")
    ]


async def test_calendars_are_managed_by_parents(parent: httpx.AsyncClient) -> None:
    created = await parent.post(
        "/api/calendar/calendars", json={"name": "Kids' activities", "color": "iris"}, headers=CSRF
    )
    assert created.status_code == 201, created.text
    kids = created.json()
    home = next(c for c in (await parent.get("/api/calendar/calendars")).json() if c["is_default"])
    refused = await parent.delete(f"/api/calendar/calendars/{home['id']}", headers=CSRF)
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "default_calendar"
    await add(parent, title="Practice", start="2026-10-07T09:00", calendar_id=kids["id"])
    gone = await parent.delete(f"/api/calendar/calendars/{kids['id']}", headers=CSRF)
    assert gone.status_code == 200 and gone.json()["deleted"]
    assert await week(parent) == []  # a removed calendar's events are hidden, not lost
    await parent.post(f"/api/calendar/calendars/{kids['id']}/restore", headers=CSRF)
    assert [o["title"] for o in await week(parent)] == ["Practice"]


async def test_read_only_calendars_refuse_changes(parent: httpx.AsyncClient, app: FastAPI) -> None:
    kids = (
        await parent.post("/api/calendar/calendars", json={"name": "School"}, headers=CSRF)
    ).json()
    async with state_of(app).db.write() as tx:
        await tx.session.execute(
            update(Calendar).where(Calendar.id == kids["id"]).values(read_only=True)
        )
    refused = await parent.post(
        "/api/calendar/events",
        json={"title": "Field trip", "start": "2026-10-07T09:00", "calendar_id": kids["id"]},
        headers=CSRF,
    )
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "calendar_read_only"


@pytest.fixture
async def screen(parent: httpx.AsyncClient, other: httpx.AsyncClient) -> httpx.AsyncClient:
    """The wall screen, paired, with a parent PIN set (kid-safe editing is on by default)."""
    await set_pin(parent)
    paired = await other.post(
        "/api/auth/kiosk/pair-with-password",
        json={"password": PASSWORD, "label": "Kitchen screen"},
        headers=CSRF,
    )
    assert paired.status_code == 200, paired.text
    return other


async def test_kid_safe_editing_guards_changes_on_the_wall(
    screen: httpx.AsyncClient,
) -> None:
    created = await screen.post(
        "/api/calendar/events",
        json={"title": "Pajama day", "start_date": "2026-10-09"},
        headers=CSRF,
    )
    assert created.status_code == 201, created.text  # adding never asks
    event = created.json()["event"]
    moved = await screen.post(
        f"/api/calendar/events/{event['id']}/move", json={"to_date": "2026-10-10"}, headers=CSRF
    )
    assert moved.status_code == 200, moved.text  # neither does moving
    changed = await screen.patch(
        f"/api/calendar/events/{event['id']}", json={"title": "PJ day"}, headers=CSRF
    )
    assert changed.status_code == 403 and changed.json()["error"]["pin"] is True
    removed = await screen.delete(f"/api/calendar/events/{event['id']}", headers=CSRF)
    assert removed.status_code == 403


async def test_the_export_has_the_calendar(parent: httpx.AsyncClient) -> None:
    await soccer(parent)
    data = (await parent.get("/api/export")).json()["data"]
    assert [e["title"] for e in data["events"]] == ["Soccer practice"]
    assert [c["name"] for c in data["calendars"]] == ["Home"]
    assert "event_revisions" not in data
