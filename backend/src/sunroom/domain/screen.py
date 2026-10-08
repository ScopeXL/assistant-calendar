"""What the wall screen's panel should be doing now (PLAN §13.5): on or off, and how bright.

The household sets a sleep schedule (from, to, and Dim clock or Screen off) and, with it, an
evening dim (from a time until the sleep starts, at a level). A tap while asleep keeps the
screen awake for a couple of minutes. The browser draws the dim clock or a black screen itself;
on a Pi, kiosk/sunroom-screen also switches the panel off and sets its brightness from this.
Pure: the household's minute of the day comes in, the state goes out.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

FULL = 100
NIGHT_CLOCK = 20  # the panel's brightness behind the dim clock

Reason = Literal["day", "dim", "sleep", "awake"]


@dataclass(frozen=True, slots=True)
class Schedule:
    sleep_from: str | None  # "HH:MM"; with sleep_to, or no sleep at all
    sleep_to: str | None
    sleep_mode: str  # "dim_clock" or "screen_off"
    dim_from: str | None  # the evening dim starts; it lasts until the sleep
    dim_level: int  # percent


@dataclass(frozen=True, slots=True)
class ScreenState:
    screen: Literal["on", "off"]
    brightness: int  # percent; 0 while off
    reason: Reason


def minutes(clock: str | None) -> int | None:
    """Minutes after midnight: "21:30" is 1290; None, or anything else, is None."""
    if not clock or len(clock) != 5 or clock[2] != ":":
        return None
    hours, mins = clock[:2], clock[3:]
    if not (hours.isdigit() and mins.isdigit()):
        return None
    value = int(hours) * 60 + int(mins)
    return value if int(hours) < 24 and int(mins) < 60 else None


def within(start: int, end: int, minute: int) -> bool:
    """[start, end) on a clock face, wrapping past midnight; an empty span holds nothing."""
    if start == end:
        return False
    return start <= minute < end if start < end else minute >= start or minute < end


def screen_state(schedule: Schedule, minute: int, *, awake: bool) -> ScreenState:
    """``minute``: minutes after the household's midnight. ``awake``: tapped awake just now."""
    start, end = minutes(schedule.sleep_from), minutes(schedule.sleep_to)
    if start is not None and end is not None and within(start, end, minute):
        if awake:
            return ScreenState("on", FULL, "awake")
        if schedule.sleep_mode == "screen_off":
            return ScreenState("off", 0, "sleep")
        return ScreenState("on", NIGHT_CLOCK, "sleep")
    dim = minutes(schedule.dim_from)
    if dim is not None and start is not None and within(dim, start, minute):
        return ScreenState("on", schedule.dim_level, "dim")
    return ScreenState("on", FULL, "day")
