"""Countdowns (PLAN §9): the day a countdown or a birthday next comes round, how many days off
that is, and the age a birthday brings. Pure: ``today`` is passed in.

A birthday on February 29 comes round on February 28 in other years, and so does a yearly
countdown on that date.
"""

from __future__ import annotations

from datetime import date


def in_year(on: date, year: int) -> date:
    """The same month and day in ``year`` (February 29 → February 28 when it has none)."""
    try:
        return on.replace(year=year)
    except ValueError:
        return date(year, 2, 28)


def next_date(on: date, *, yearly: bool, today: date) -> date | None:
    """When a countdown next comes round: its own date, or None once that has passed; a yearly
    one comes round this year, or next year once this year's has passed."""
    if not yearly:
        return on if on >= today else None
    if on >= today:
        return on
    this_year = in_year(on, today.year)
    return this_year if this_year >= today else in_year(on, today.year + 1)


def next_birthday(birthday: date, today: date) -> date:
    """The next birthday on or after today."""
    this_year = in_year(birthday, today.year)
    return this_year if this_year >= today else in_year(birthday, today.year + 1)


def turning(birthday: date, on: date) -> int:
    """The age a birthday on ``on`` brings."""
    return on.year - birthday.year


def days_until(target: date, today: date) -> int:
    return (target - today).days
