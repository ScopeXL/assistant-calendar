"""Chores as rules (domain/chores.py, ADR 0025): due days, the three ways a chore is assigned,
whose turn it is, what counts as done, carrying a one-day chore over, and streaks.

Wednesday 2026-10-07 is "today" unless a test says otherwise. Synthetic people only."""

from __future__ import annotations

from datetime import date, timedelta
from time import perf_counter

from sunroom.domain.chores import (
    ANY,
    FIXED,
    ROTATE,
    Completion,
    Rule,
    Schedule,
    due_days,
    due_on,
    streak,
    tally,
    turn_on,
)

MIA, LEO, SAM = "mia", "leo", "sam"
MON, TUE, WED, THU, FRI = (date(2026, 10, d) for d in (5, 6, 7, 8, 9))
TODAY = WED


def done(chore: str, due: date, member: str, *, on: date | None = None, status: str = "done"):
    return Completion(chore, due, member, on or due, status)


def test_a_repeating_chore_is_due_on_its_rule_s_days_from_its_first() -> None:
    # The editor starts a chore on a day its rule makes (as the event editor does): Fri Oct 2.
    weekdays = Rule("bins", date(2026, 10, 2), "FREQ=WEEKLY;BYDAY=MO,WE,FR")
    assert due_days(weekdays, MON, date(2026, 10, 12)) == [MON, WED, FRI]
    assert due_days(weekdays, date(2026, 9, 1), date(2026, 10, 3)) == [date(2026, 10, 2)]
    skipped = Rule(
        "bins", date(2026, 10, 2), "FREQ=WEEKLY;BYDAY=MO,WE,FR", skipped=frozenset({WED})
    )
    assert due_days(skipped, MON, date(2026, 10, 12)) == [MON, FRI]


def test_a_fixed_chore_gives_each_of_its_people_a_box() -> None:
    bed = Rule("bed", MON, "FREQ=DAILY", FIXED, (MIA, LEO))
    boxes = due_on([bed], [done("bed", WED, MIA)], WED, TODAY)
    assert [(b.owner_id, b.done) for b in boxes] == [(MIA, True), (LEO, False)]
    assert (tally(boxes, MIA).done, tally(boxes, MIA).total) == (1, 1)
    assert tally(boxes, MIA).all_done and not tally(boxes, LEO).all_done
    assert tally(boxes, None).total == 0  # nothing in the Anyone column


def test_anyone_s_chore_is_one_box_that_anybody_ticks() -> None:
    plants = Rule("plants", MON, "FREQ=DAILY", ANY)
    [box] = due_on([plants], [done("plants", WED, LEO)], WED, TODAY)
    assert (box.owner_id, box.turn_id, box.done) == (None, None, True)
    assert box.completion is not None and box.completion.member_id == LEO


def test_a_rotating_chore_goes_round_in_order_one_turn_per_day_it_s_due() -> None:
    dishes = Rule("dishes", MON, "FREQ=DAILY", ROTATE, (MIA, LEO, SAM))
    assert [turn_on(dishes, day) for day in (MON, TUE, WED, THU, FRI)] == [MIA, LEO, SAM, MIA, LEO]
    started_on_leo = Rule("dishes", MON, "FREQ=DAILY", ROTATE, (MIA, LEO, SAM), rotation_index=1)
    assert turn_on(started_on_leo, MON) == LEO
    # A skipped day isn't anybody's turn: Wednesday's turn moves to Thursday.
    skipping = Rule("dishes", MON, "FREQ=DAILY", ROTATE, (MIA, LEO, SAM), skipped=frozenset({WED}))
    assert [turn_on(skipping, day) for day in (TUE, THU, FRI)] == [LEO, SAM, MIA]
    # The schedule works turns out once for a range, and agrees.
    schedule = Schedule([skipping], [], MON, date(2026, 10, 10), TODAY)
    assert [b.turn_id for day in (MON, TUE, THU, FRI) for b in schedule.due_on(day)] == [
        MIA,
        LEO,
        SAM,
        MIA,
    ]
    assert schedule.due_on(WED) == []


def test_a_rotating_chore_counts_its_turns_across_weeks() -> None:
    trash = Rule("trash", date(2026, 9, 1), "FREQ=WEEKLY;BYDAY=TU", ROTATE, (MIA, LEO))
    # Sep 1 is Mia's turn; Oct 6 is the sixth Tuesday after it.
    assert turn_on(trash, TUE) == LEO
    [box] = due_on([trash], [], TUE, TODAY)
    assert (box.owner_id, box.turn_id) == (None, LEO)


def test_waiting_for_a_parent_counts_as_done_and_turned_down_doesn_t() -> None:
    bed = Rule("bed", MON, "FREQ=DAILY", FIXED, (MIA,))
    [pending] = due_on([bed], [done("bed", WED, MIA, status="pending")], WED, TODAY)
    assert pending.done and pending.completion is not None
    assert pending.completion.status == "pending"
    [rejected] = due_on([bed], [done("bed", WED, MIA, status="rejected")], WED, TODAY)
    assert not rejected.done


def test_a_one_day_chore_stays_on_the_list_until_it_s_done() -> None:
    shoes = Rule("shoes", MON, None, FIXED, (MIA,))
    assert [b.due_date for b in due_on([shoes], [], MON, TODAY)] == [MON]
    # Not done: still there on Tuesday and today, "since Mon", but not on future days.
    assert [b.due_date for b in due_on([shoes], [], TUE, TODAY)] == [MON]
    assert [b.due_date for b in due_on([shoes], [], WED, TODAY)] == [MON]
    assert due_on([shoes], [], THU, TODAY) == []
    # Done on Tuesday: it shows there, stamped, and on its own day; not on Wednesday.
    late = [done("shoes", MON, MIA, on=TUE)]
    assert [b.done for b in due_on([shoes], late, TUE, TODAY)] == [True]
    assert [b.done for b in due_on([shoes], late, MON, TODAY)] == [True]
    assert due_on([shoes], late, WED, TODAY) == []
    # Skipped: gone.
    off = Rule("shoes", MON, None, FIXED, (MIA,), skipped=frozenset({MON}))
    assert due_on([off], [], MON, TODAY) == []


def test_a_streak_counts_finished_days_and_skips_empty_ones() -> None:
    bed = Rule("bed", date(2026, 10, 1), "FREQ=WEEKLY;BYDAY=MO,TU,TH,FR,SA,SU", FIXED, (MIA,))
    history = [done("bed", day, MIA) for day in (date(2026, 10, 3), date(2026, 10, 4), MON, TUE)]
    # Wednesday has nothing of hers; Oct 3 to Oct 6 were all done; Oct 2 wasn't.
    assert streak([bed], history, MIA, TODAY) == 4
    # Today still to do doesn't break it; done, it counts.
    assert streak([bed], history, MIA, THU) == 4
    assert streak([bed], [*history, done("bed", THU, MIA)], MIA, THU) == 5
    # A missed day yesterday does break it.
    assert streak([bed], history, MIA, FRI) == 0


def test_a_streak_counts_rotating_turns_but_not_anyone_s_chores() -> None:
    dishes = Rule("dishes", MON, "FREQ=DAILY", ROTATE, (MIA, LEO))
    plants = Rule("plants", MON, "FREQ=DAILY", ANY)
    # Mia's turns are Mon and Wed; Leo did Monday's for her, which still covers it.
    history = [done("dishes", MON, LEO), done("dishes", WED, MIA)]
    assert streak([dishes, plants], history, MIA, TODAY) == 2
    assert streak([dishes, plants], history, LEO, TODAY) == 0  # Tuesday's turn wasn't done


def test_a_long_streak_is_quick() -> None:
    rules = [
        Rule(f"chore{n}", date(2025, 1, 1), "FREQ=DAILY", FIXED if n % 2 else ROTATE, (MIA, LEO))
        for n in range(8)
    ]
    history = [
        done(rule.id, date(2025, 1, 1) + timedelta(days=k), MIA if rule.mode == FIXED else LEO)
        for rule in rules
        for k in range(700)
    ]
    started = perf_counter()
    streak(rules, history, MIA, TODAY)
    assert perf_counter() - started < 2.0
