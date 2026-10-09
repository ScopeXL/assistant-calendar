"""Birthdays on the calendar (PLAN §7.6, ADR 0028): the days a person's birthday comes round in
a range, for the core ``birthdays`` overlay. Pure: no clock, no database.

A birthday on February 29 comes round on February 28 in the other years, and never before the day
itself: a birthday set in the future (a baby on the way) first shows on that day.
"""

from __future__ import annotations

from datetime import date

from sunroom.domain.countdowns import yearly_days


def birthday_days(birthday: date, start: date, end: date) -> list[date]:
    """Each year's birthday in [start, end), never before the birthday itself."""
    return yearly_days(birthday, start, end)
