"""Star balances (PLAN §10.3, ADR 0019): computed, never stored.

A balance is the stars from done chores and finished routines, plus a parent's adjustments,
minus the rewards a parent said yes to. A chore waiting for a parent's OK gives nothing yet, and
one a parent turned down gives nothing. A reward someone asked for and nobody has answered holds
its cost: it stays in the balance, but can't be asked for twice.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True, slots=True)
class Earned:
    """Stars from a done chore or a finished routine."""

    member_id: str
    points: int
    day: date  # the household day it was done
    status: str = "done"  # a chore's "done", "pending" or "rejected"


@dataclass(frozen=True, slots=True)
class Adjustment:
    member_id: str
    points: int  # positive or negative


@dataclass(frozen=True, slots=True)
class Spent:
    """A reward someone asked for."""

    member_id: str
    points: int
    status: str  # "requested", "approved", "denied" or "cancelled"


def balance(
    member_id: str,
    earned: Iterable[Earned],
    adjustments: Iterable[Adjustment] = (),
    spent: Iterable[Spent] = (),
) -> int:
    return (
        sum(e.points for e in earned if e.member_id == member_id and e.status == "done")
        + sum(a.points for a in adjustments if a.member_id == member_id)
        - sum(s.points for s in spent if s.member_id == member_id and s.status == "approved")
    )


def held(member_id: str, spent: Iterable[Spent]) -> int:
    """Stars set aside for rewards asked for and not yet answered."""
    return sum(s.points for s in spent if s.member_id == member_id and s.status == "requested")


def earned_between(member_id: str, earned: Iterable[Earned], start: date, end: date) -> int:
    """Stars from chores and routines done in [start, end) ("+12 this week")."""
    return sum(
        e.points
        for e in earned
        if e.member_id == member_id and e.status == "done" and start <= e.day < end
    )
