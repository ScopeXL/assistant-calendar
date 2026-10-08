"""Chores as rules (PLAN §10.3, ADR 0019, ADR 0025): which boxes are due on a day and whose they
are, whose turn a rotating chore is, and how many days in a row someone finished theirs.

Pure: the service passes in the rules, the completions and ``today``; nothing here reads a clock.

- A repeating chore is due on each day its rule makes, from its first day, except the days a
  parent skipped. A chore without a rule is due on its day and stays on the list, "since Mon",
  until somebody does it; it then shows on the day it was done.
- A fixed chore gives each of its people their own box, in their own column. An anyone chore
  and a rotating chore give one box, in the Anyone column; a rotating chore names whose turn it
  is, going round its people in order, one turn per day it's due (a skipped day isn't a turn).
- A box is done when a completion covers it: the owner's for a fixed chore, anybody's
  otherwise. Waiting for a parent's OK counts as done; a completion a parent turned down doesn't.
- A day counts toward someone's streak when every box that was theirs that day (their fixed
  chores and the rotating ones on their turn) got done. Days with nothing of theirs neither
  count nor break it, and today only counts once it's finished.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from sunroom.domain.recurrence import Series, Timing, Window, count_before, expand
from sunroom.domain.timeparts import rid_date

FIXED = "fixed"
ROTATE = "rotate"
ANY = "any"
STREAK_DAYS = 400  # how far back a streak looks
_DAY = timedelta(days=1)


@dataclass(frozen=True, slots=True)
class Rule:
    """A chore, as far as the due list cares."""

    id: str
    start_date: date
    rrule: str | None = None  # None: one day only, and it stays due until it's done
    mode: str = FIXED
    assignees: tuple[str, ...] = ()  # member ids, in turn order
    rotation_index: int = 0  # whose turn the first day is
    skipped: frozenset[date] = frozenset()


@dataclass(frozen=True, slots=True)
class Completion:
    chore_id: str
    due_date: date
    member_id: str  # who gets the credit
    done_day: date  # the household day it was ticked
    status: str = "done"  # "done", "pending" (a parent hasn't said yet) or "rejected"

    @property
    def counts(self) -> bool:
        return self.status in ("done", "pending")


@dataclass(frozen=True, slots=True)
class Due:
    """One box on one day."""

    chore_id: str
    day: date  # the day it shows on
    due_date: date  # the day it's for: a one-day chore left undone shows on later days too
    owner_id: str | None  # a fixed chore's person; None: the Anyone column
    turn_id: str | None  # a rotating chore: whose turn it is
    completion: Completion | None  # the one that ticks it (done or waiting for a parent)

    @property
    def done(self) -> bool:
        return self.completion is not None

    def belongs_to(self, member_id: str) -> bool:
        """Theirs for a streak: their own box, or a rotating one on their turn."""
        return self.owner_id == member_id or (self.owner_id is None and self.turn_id == member_id)


@dataclass(frozen=True, slots=True)
class Tally:
    done: int
    total: int

    @property
    def all_done(self) -> bool:
        return self.total > 0 and self.done == self.total


def _series(rule: Rule) -> Series:
    first = rule.start_date
    return Series(
        timing=Timing(all_day=True, start_date=first, end_date=first + _DAY),
        tzid="UTC",
        rrule=rule.rrule,
    )


def _window(start: date, end: date) -> Window:
    """Days [start, end); all-day occurrences only look at the dates."""
    return Window(
        start_utc=datetime.combine(start, time(), UTC),
        end_utc=datetime.combine(end, time(), UTC),
        start_date=start,
        end_date=end,
    )


def _rule_days(rule: Rule, start: date, end: date) -> list[date]:
    """The days in [start, end) the rule makes, skipped or not."""
    if end <= start:
        return []
    if not rule.rrule:
        return [rule.start_date] if start <= rule.start_date < end else []
    limit = (end - start).days + 1
    found = (
        o.timing.start_date for o in expand(_series(rule), (), _window(start, end), limit=limit)
    )
    return [day for day in found if day is not None]


def due_days(rule: Rule, start: date, end: date) -> list[date]:
    """The days in [start, end) a chore is due by its rule, skipped days left out. A chore
    without a rule is due on its first day only here (``Schedule`` carries it over)."""
    return [day for day in _rule_days(rule, start, end) if day not in rule.skipped]


def turn_on(rule: Rule, due_date: date) -> str | None:
    """Whose turn a rotating chore is on one of its days (None for other chores)."""
    if rule.mode != ROTATE or not rule.assignees:
        return None
    return rule.assignees[
        (rule.rotation_index + _turns_before(rule, due_date)) % len(rule.assignees)
    ]


def _turns_before(rule: Rule, due_date: date) -> int:
    """Turns taken before ``due_date``: the days the rule made before it, less skipped ones."""
    if not rule.rrule or due_date <= rule.start_date:
        return 0
    made = count_before(_series(rule), rid_date(due_date))
    skipped = sum(
        1
        for day in rule.skipped
        if rule.start_date <= day < due_date and _rule_days(rule, day, day + _DAY)
    )
    return made - skipped


class Schedule:
    """The rules worked out once for the days [start, end): each repeating chore's due days and
    whose turn each is, and the completions by chore and day. A streak asks about 400 days and
    a week about 7, so each rule is walked once, not once a day."""

    def __init__(
        self,
        rules: Sequence[Rule],
        completions: Iterable[Completion],
        start: date,
        end: date,
        today: date,
    ) -> None:
        self.rules = tuple(rules)
        self.start, self.end, self.today = start, end, today
        self._days: dict[str, frozenset[date]] = {}
        self._turns: dict[tuple[str, date], str] = {}
        for rule in self.rules:
            if not rule.rrule:
                continue
            days = due_days(rule, max(start, rule.start_date), end)
            self._days[rule.id] = frozenset(days)
            if rule.mode == ROTATE and rule.assignees and days:
                base = rule.rotation_index + _turns_before(rule, days[0])
                for offset, day in enumerate(days):
                    self._turns[rule.id, day] = rule.assignees[
                        (base + offset) % len(rule.assignees)
                    ]
        self._done: dict[tuple[str, date], list[Completion]] = {}
        for completion in completions:
            if completion.counts:
                self._done.setdefault((completion.chore_id, completion.due_date), []).append(
                    completion
                )

    def _turn(self, rule: Rule, due_date: date) -> str | None:
        if rule.mode != ROTATE or not rule.assignees:
            return None
        if rule.rrule:
            return self._turns.get((rule.id, due_date))
        return rule.assignees[rule.rotation_index % len(rule.assignees)]

    def _boxes(self, rule: Rule, day: date, due_date: date) -> list[Due]:
        done = self._done.get((rule.id, due_date), [])
        if rule.mode == FIXED:
            return [
                Due(
                    rule.id,
                    day,
                    due_date,
                    member,
                    None,
                    next((c for c in done if c.member_id == member), None),
                )
                for member in rule.assignees
            ]
        return [
            Due(rule.id, day, due_date, None, self._turn(rule, due_date), next(iter(done), None))
        ]

    def due_on(self, day: date) -> list[Due]:
        """Every box on ``day`` (within the schedule's days), in the rules' order."""
        found: list[Due] = []
        for rule in self.rules:
            if rule.rrule:
                if day in self._days.get(rule.id, frozenset()):
                    found.extend(self._boxes(rule, day, day))
                continue
            first = rule.start_date
            if day < first or first in rule.skipped:
                continue
            if day == first:
                found.extend(self._boxes(rule, day, first))
            elif day <= self.today:
                # Carried over: still to do, or done on this very day.
                found.extend(
                    box
                    for box in self._boxes(rule, day, first)
                    if box.completion is None or box.completion.done_day == day
                )
        return found

    def streak(self, member_id: str) -> int:
        """Days in a row ``member_id`` finished every box that was theirs, back from today."""
        count = 0
        day = self.today
        while day >= self.start:
            theirs = [box for box in self.due_on(day) if box.belongs_to(member_id)]
            if theirs:
                if all(box.done for box in theirs):
                    count += 1
                elif day != self.today:
                    break
            day -= _DAY
        return count


def due_on(
    rules: Sequence[Rule], completions: Iterable[Completion], day: date, today: date
) -> list[Due]:
    """Every box on ``day``, in the rules' order (each fixed chore's people in their order)."""
    return Schedule(rules, completions, day, day + _DAY, today).due_on(day)


def streak(
    rules: Sequence[Rule], completions: Iterable[Completion], member_id: str, today: date
) -> int:
    """Days in a row ``member_id`` finished every box that was theirs (see the module)."""
    start = today - timedelta(days=STREAK_DAYS - 1)
    return Schedule(rules, completions, start, today + _DAY, today).streak(member_id)


def tally(boxes: Iterable[Due], owner_id: str | None) -> Tally:
    """ "2 of 3" for one column: a person's (``owner_id``) or Anyone's (None)."""
    mine = [box for box in boxes if box.owner_id == owner_id]
    return Tally(sum(1 for box in mine if box.done), len(mine))
