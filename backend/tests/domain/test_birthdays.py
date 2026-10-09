from __future__ import annotations

from datetime import date, timedelta

from hypothesis import given
from hypothesis import strategies as st

from sunroom.domain.birthdays import birthday_days


def test_each_years_day_in_the_range_and_the_end_left_out() -> None:
    mia = date(2018, 10, 20)
    assert birthday_days(mia, date(2026, 10, 18), date(2026, 10, 25)) == [date(2026, 10, 20)]
    assert birthday_days(mia, date(2026, 10, 1), date(2026, 10, 20)) == []
    assert birthday_days(mia, date(2026, 10, 20), date(2026, 10, 21)) == [date(2026, 10, 20)]
    assert birthday_days(date(2018, 1, 2), date(2026, 12, 1), date(2027, 2, 1)) == [
        date(2027, 1, 2)
    ]
    assert birthday_days(date(2018, 6, 1), date(2026, 1, 1), date(2028, 1, 1)) == [
        date(2026, 6, 1),
        date(2027, 6, 1),
    ]


def test_february_29_comes_round_on_the_28th_in_other_years() -> None:
    leo = date(2016, 2, 29)
    assert birthday_days(leo, date(2027, 2, 1), date(2027, 3, 1)) == [date(2027, 2, 28)]
    assert birthday_days(leo, date(2028, 2, 1), date(2028, 3, 1)) == [date(2028, 2, 29)]


def test_never_before_the_birthday_itself() -> None:
    on_the_way = date(2027, 1, 10)
    assert birthday_days(on_the_way, date(2026, 1, 1), date(2027, 1, 1)) == []
    assert birthday_days(on_the_way, date(2026, 1, 1), date(2028, 1, 1)) == [on_the_way]


@given(
    st.dates(min_value=date(1950, 1, 1), max_value=date(2100, 12, 31)),
    st.dates(min_value=date(2000, 1, 1), max_value=date(2099, 12, 31)),
    st.integers(min_value=1, max_value=93),
)
def test_every_day_is_in_the_range_and_on_the_birthday(
    birthday: date, start: date, length: int
) -> None:
    end = start + timedelta(days=length)
    found = birthday_days(birthday, start, end)
    assert len(found) <= 1  # at most 93 days asked: a birthday comes round once
    for on in found:
        assert start <= on < end and on >= birthday
        assert (on.month, on.day) in {(birthday.month, birthday.day), (2, 28)}
