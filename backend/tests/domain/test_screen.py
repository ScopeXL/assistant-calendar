from __future__ import annotations

from hypothesis import given
from hypothesis import strategies as st

from sunroom.domain.screen import Schedule, ScreenState, minutes, screen_state, within


def at(clock: str) -> int:
    value = minutes(clock)
    assert value is not None
    return value


NIGHTS = Schedule("22:00", "06:30", "screen_off", "20:00", 40)


def test_clock_words_become_minutes() -> None:
    assert minutes("00:00") == 0
    assert minutes("21:30") == 1290
    assert minutes("24:00") is None
    assert minutes("7:30") is None
    assert minutes(None) is None


def test_a_span_can_wrap_past_midnight() -> None:
    assert within(at("22:00"), at("06:30"), at("23:59"))
    assert within(at("22:00"), at("06:30"), at("03:00"))
    assert not within(at("22:00"), at("06:30"), at("06:30"))
    assert within(at("09:00"), at("17:00"), at("12:00"))
    assert not within(at("09:00"), at("09:00"), at("09:00"))


def test_the_day_is_bright_the_evening_dim_and_the_night_off() -> None:
    assert screen_state(NIGHTS, at("12:00"), awake=False) == ScreenState("on", 100, "day")
    assert screen_state(NIGHTS, at("19:59"), awake=False) == ScreenState("on", 100, "day")
    assert screen_state(NIGHTS, at("20:00"), awake=False) == ScreenState("on", 40, "dim")
    assert screen_state(NIGHTS, at("21:59"), awake=False) == ScreenState("on", 40, "dim")
    assert screen_state(NIGHTS, at("22:00"), awake=False) == ScreenState("off", 0, "sleep")
    assert screen_state(NIGHTS, at("06:29"), awake=False) == ScreenState("off", 0, "sleep")
    assert screen_state(NIGHTS, at("06:30"), awake=False) == ScreenState("on", 100, "day")


def test_a_tap_wakes_it_and_the_dim_clock_keeps_it_low() -> None:
    assert screen_state(NIGHTS, at("23:00"), awake=True) == ScreenState("on", 100, "awake")
    clock = Schedule("22:00", "06:30", "dim_clock", None, 40)
    assert screen_state(clock, at("23:00"), awake=False) == ScreenState("on", 20, "sleep")
    # Awake in the day changes nothing.
    assert screen_state(NIGHTS, at("12:00"), awake=True) == ScreenState("on", 100, "day")


def test_without_a_sleep_schedule_nothing_dims_or_sleeps() -> None:
    free = Schedule(None, None, "screen_off", "20:00", 40)
    for clock in ("03:00", "12:00", "21:00"):
        assert screen_state(free, at(clock), awake=False) == ScreenState("on", 100, "day")


@given(st.integers(min_value=0, max_value=24 * 60 - 1), st.booleans())
def test_the_screen_is_always_in_one_known_state(minute: int, awake: bool) -> None:
    state = screen_state(NIGHTS, minute, awake=awake)
    assert state.reason in {"day", "dim", "sleep", "awake"}
    assert (state.screen == "off") == (state.brightness == 0)
    assert 0 <= state.brightness <= 100
