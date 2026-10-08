"""Star balances (domain/points.py): what earns, what spends, and what a request holds.
Synthetic people only."""

from __future__ import annotations

from datetime import date

from sunroom.domain.points import Adjustment, Earned, Spent, balance, earned_between, held

MON, TUE, NEXT_MON = date(2026, 10, 5), date(2026, 10, 6), date(2026, 10, 12)


def test_a_balance_is_done_stars_plus_adjustments_minus_approved_rewards() -> None:
    earned = [
        Earned("mia", 2, MON),
        Earned("mia", 3, TUE, "pending"),  # nothing until a parent says yes
        Earned("mia", 5, TUE, "rejected"),
        Earned("leo", 4, MON),
    ]
    adjustments = [Adjustment("mia", 10), Adjustment("mia", -1)]
    spent = [
        Spent("mia", 6, "approved"),
        Spent("mia", 30, "requested"),
        Spent("mia", 8, "denied"),
        Spent("mia", 4, "cancelled"),
    ]
    assert balance("mia", earned, adjustments, spent) == 2 + 10 - 1 - 6
    assert balance("leo", earned, adjustments, spent) == 4
    assert held("mia", spent) == 30


def test_this_week_counts_what_was_done_this_week() -> None:
    earned = [Earned("mia", 2, MON), Earned("mia", 3, TUE), Earned("mia", 1, NEXT_MON)]
    assert earned_between("mia", earned, MON, NEXT_MON) == 5
