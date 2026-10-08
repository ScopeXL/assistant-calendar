from __future__ import annotations

from datetime import date

from hypothesis import given
from hypothesis import strategies as st

from sunroom.domain.countdowns import days_until, in_year, next_birthday, next_date, turning

TODAY = date(2026, 10, 7)


def test_a_one_off_countdown_comes_round_on_its_day_and_then_never() -> None:
    assert next_date(date(2026, 10, 24), yearly=False, today=TODAY) == date(2026, 10, 24)
    assert next_date(TODAY, yearly=False, today=TODAY) == TODAY
    assert next_date(date(2026, 10, 6), yearly=False, today=TODAY) is None


def test_a_yearly_countdown_comes_round_this_year_then_next() -> None:
    first = date(2024, 12, 25)
    assert next_date(first, yearly=True, today=TODAY) == date(2026, 12, 25)
    assert next_date(date(2025, 10, 7), yearly=True, today=TODAY) == TODAY
    assert next_date(date(2025, 10, 6), yearly=True, today=TODAY) == date(2027, 10, 6)
    # One set for a later year waits for its own first time.
    assert next_date(date(2027, 1, 1), yearly=True, today=TODAY) == date(2027, 1, 1)


def test_birthdays_come_round_every_year_and_say_the_age() -> None:
    mia = date(2017, 10, 19)
    assert next_birthday(mia, TODAY) == date(2026, 10, 19)
    assert turning(mia, date(2026, 10, 19)) == 9
    assert next_birthday(date(1988, 4, 12), TODAY) == date(2027, 4, 12)
    assert next_birthday(date(2020, 10, 7), TODAY) == TODAY


def test_february_29_comes_round_on_the_28th_in_other_years() -> None:
    leap = date(2016, 2, 29)
    assert in_year(leap, 2027) == date(2027, 2, 28)
    assert in_year(leap, 2028) == date(2028, 2, 29)
    assert next_birthday(leap, TODAY) == date(2027, 2, 28)
    assert next_date(leap, yearly=True, today=date(2028, 1, 1)) == date(2028, 2, 29)


def test_days_until_counts_whole_days() -> None:
    assert days_until(TODAY, TODAY) == 0
    assert days_until(date(2026, 10, 8), TODAY) == 1
    assert days_until(date(2027, 1, 1), TODAY) == 86


@given(
    st.dates(min_value=date(1950, 1, 1), max_value=date(2100, 12, 31)),
    st.dates(min_value=date(2000, 1, 1), max_value=date(2099, 12, 31)),
)
def test_the_next_birthday_is_never_past_and_within_a_year(birthday: date, today: date) -> None:
    upcoming = next_birthday(birthday, today)
    assert 0 <= days_until(upcoming, today) <= 366
    assert (upcoming.month, upcoming.day) in {(birthday.month, birthday.day), (2, 28)}
