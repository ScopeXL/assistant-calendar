"""Birthdays on the calendar (PLAN §7.6, ADR 0028): a core overlay, always on.

A person's birthday in Settings → Family shows on its day as an all-day chip in their color,
whichever plugins are on. The countdowns plugin still counts birthdays down (Coming up, the day's
celebration) but doesn't draw them, so nothing shows twice. Like every overlay it isn't cached:
a changed birthday shows at once.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from sunroom.calendar.occurrences import OverlayProvider
from sunroom.calendar.schemas import OccurrenceOut
from sunroom.db.engine import Database
from sunroom.domain.birthdays import birthday_days
from sunroom.household import service as household_service
from sunroom.household.models import Member

OVERLAY = "birthdays"
DAY = timedelta(days=1)


def _occurrence(member: Member, on: date) -> OccurrenceOut:
    return OccurrenceOut.model_validate(
        {
            "key": f"{OVERLAY}|{member.id}|{on.isoformat()}",
            "event_id": None,
            "recurrence_id": None,
            "calendar_id": None,
            "title": f"{member.name}'s birthday",
            "location": "",
            "all_day": True,
            "start_utc": None,
            "end_utc": None,
            "start_local": None,
            "end_local": None,
            "start_date": on,
            "end_date": on + DAY,
            "member_ids": [member.id],
            "color": member.color,
            "calendar_color": None,
            "is_recurring": False,
            "is_override": False,
            "read_only": True,
            "source": OVERLAY,
            "status": "confirmed",
            "overlay": OVERLAY,
            "reminders": [],
            "version": 0,
        }
    )


def provider(db: Database) -> OverlayProvider:
    """``overlays=birthdays``: each active person's birthday on its days in [start, end)."""

    async def birthdays(start: date, end: date, zone: ZoneInfo) -> Sequence[OccurrenceOut]:
        async with db.read() as session:
            members = await household_service.active_members(session)
        return [
            _occurrence(member, on)
            for member in members
            if member.birthday is not None
            for on in birthday_days(member.birthday, start, end)
        ]

    return birthdays
