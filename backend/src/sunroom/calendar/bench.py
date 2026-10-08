"""`sunroom bench occurrences` (PLAN §7.3): how long a week of occurrences takes, cold and warm,
on a throwaway database of synthetic events. The M1 budget on a Raspberry Pi 4: cold under
100 ms, warm under 10 ms (docs/PERF.md)."""

from __future__ import annotations

import statistics
import tempfile
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from datetime import time as dtime
from pathlib import Path

from sunroom.auth.deps import Actor
from sunroom.calendar import service
from sunroom.calendar.occurrences import CalendarRuntime, occurrences
from sunroom.calendar.schemas import EventCreate
from sunroom.db import migrate
from sunroom.db.engine import make_database
from sunroom.domain.timeparts import iso_monday
from sunroom.household.models import Household, Member

ZONE = "America/New_York"
RULES = (
    "FREQ=WEEKLY;BYDAY=MO,WE,FR",
    "FREQ=DAILY",
    "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
    "FREQ=MONTHLY;BYDAY=2TH",
    "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    "FREQ=YEARLY",
)


@dataclass(frozen=True, slots=True)
class BenchResult:
    events: int
    recurring: int
    weeks: int
    occurrences: int
    cold_ms: float
    warm_ms: float


async def run(events: int, recurring: int, weeks: int, rounds: int = 5) -> BenchResult:
    from zoneinfo import ZoneInfo

    zone = ZoneInfo(ZONE)
    today = date(2026, 10, 7)
    now = datetime(2026, 10, 7, 14, 0, tzinfo=UTC)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "bench.db"
        migrate.upgrade(path)
        db = make_database(path)
        try:
            async with db.write() as tx:
                home = await tx.session.get(Household, 1)
                assert home is not None
                home.timezone = ZONE
                people = [Member(name=f"Sample {n}", role="parent", color="sky") for n in range(4)]
                tx.session.add_all(people)
                await tx.session.flush()
                ids = [p.id for p in people]
                ctx = service.Context(
                    actor=Actor(
                        device_id="bench",
                        epoch=0,
                        kind="phone",
                        member_id=None,
                        is_kid_device=False,
                        is_parent=True,
                        has_grant=False,
                    ),
                    now=now,
                    zone_key=ZONE,
                    members=frozenset(ids),
                )
                for n in range(events):
                    if n < recurring:
                        first = today - timedelta(days=365 + n % 90)
                        start = datetime.combine(first, dtime(7 + n % 12, 0))  # wall time
                        body = EventCreate(
                            title=f"Sample repeating {n}",
                            start=start,
                            end=start + timedelta(minutes=45),
                            rrule=RULES[n % len(RULES)],
                            member_ids=[ids[n % len(ids)]],
                        )
                    elif n % 5 == 0:
                        day = today + timedelta(days=(n * 7) % 360 - 180)
                        body = EventCreate(title=f"Sample day {n}", start_date=day)
                    else:
                        day = today + timedelta(days=(n * 7) % 360 - 180)
                        start = datetime.combine(day, dtime(8 + n % 11, 30))  # wall time
                        body = EventCreate(
                            title=f"Sample event {n}",
                            start=start,
                            member_ids=[ids[n % len(ids)]],
                        )
                    await service.create_event(tx, body, ctx)
            start_day = iso_monday(today)
            end_day = start_day + timedelta(days=7 * weeks)
            runtime = CalendarRuntime()
            colds: list[float] = []
            warms: list[float] = []
            found = 0
            for _ in range(rounds):
                runtime.cache.clear()
                async with db.read() as session:
                    calendars = await service.list_calendars(session)
                    began = time.perf_counter()
                    result = await occurrences(
                        session, runtime, calendars, start_day, end_day, zone
                    )
                    colds.append((time.perf_counter() - began) * 1000)
                    began = time.perf_counter()
                    await occurrences(session, runtime, calendars, start_day, end_day, zone)
                    warms.append((time.perf_counter() - began) * 1000)
                    found = len(result)
        finally:
            await db.read_engine.dispose()
            await db.write_engine.dispose()
    return BenchResult(
        events=events,
        recurring=recurring,
        weeks=weeks,
        occurrences=found,
        cold_ms=statistics.median(colds),
        warm_ms=statistics.median(warms),
    )
