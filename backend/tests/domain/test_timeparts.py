"""Wall times, instants and recurrence ids (PLAN §7.2), around the 2026 daylight-saving
changes: New York springs forward on Mar 8 and falls back on Nov 1; London on Mar 29 and
Oct 25."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from sunroom.domain import timeparts
from sunroom.domain.timeparts import (
    FAR_FUTURE,
    day_bounds,
    from_local,
    iso_monday,
    parse_rid,
    rid_date,
    rid_timed,
    to_local,
    week_start,
)

NY = ZoneInfo("America/New_York")
LONDON = ZoneInfo("Europe/London")


def wall(text: str) -> datetime:
    return datetime.fromisoformat(text)


def utc(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


def test_the_constants() -> None:
    assert timeparts.UTC is UTC
    assert FAR_FUTURE == datetime(9999, 12, 31, tzinfo=UTC)


def test_to_local_gives_naive_wall_time() -> None:
    assert to_local(utc("2026-10-09T20:00:00"), NY) == wall("2026-10-09T16:00:00")
    assert to_local(utc("2026-01-09T21:00:00"), NY) == wall("2026-01-09T16:00:00")
    assert to_local(utc("2026-07-01T12:00:00"), LONDON) == wall("2026-07-01T13:00:00")


def test_from_local_gives_aware_utc() -> None:
    instant = from_local(wall("2026-10-09T16:00:00"), NY)
    assert instant == utc("2026-10-09T20:00:00")
    assert instant.utcoffset() == timedelta(0)


@pytest.mark.parametrize(
    ("naive", "zone", "expected", "shown"),
    [
        # Spring forward: 2:30 doesn't exist, so it moves forward by the gap to 3:30.
        ("2026-03-08T02:30:00", NY, "2026-03-08T07:30:00", "2026-03-08T03:30:00"),
        ("2026-03-29T01:30:00", LONDON, "2026-03-29T01:30:00", "2026-03-29T02:30:00"),
        # Fall back: 1:30 happens twice; the first one wins.
        ("2026-11-01T01:30:00", NY, "2026-11-01T05:30:00", "2026-11-01T01:30:00"),
        ("2026-10-25T01:30:00", LONDON, "2026-10-25T00:30:00", "2026-10-25T01:30:00"),
    ],
)
def test_daylight_saving_edges(naive: str, zone: ZoneInfo, expected: str, shown: str) -> None:
    instant = from_local(wall(naive), zone)
    assert instant == utc(expected)
    assert to_local(instant, zone) == wall(shown)


def test_a_second_fold_still_means_the_first_instant() -> None:
    assert from_local(wall("2026-11-01T01:30:00").replace(fold=1), NY) == utc("2026-11-01T05:30:00")


def test_naive_and_aware_are_not_mixed_up() -> None:
    with pytest.raises(ValueError, match="aware"):
        to_local(wall("2026-10-09T16:00:00"), NY)
    with pytest.raises(ValueError, match="naive"):
        from_local(utc("2026-10-09T16:00:00"), NY)
    with pytest.raises(ValueError, match="naive"):
        rid_timed(utc("2026-10-09T16:00:00"))


@settings(max_examples=150, deadline=None)
@given(
    st.datetimes(min_value=wall("2025-01-01T00:00:00"), max_value=wall("2028-01-01T00:00:00")),
    st.sampled_from([NY, LONDON, ZoneInfo("Australia/Sydney"), ZoneInfo("UTC")]),
)
def test_wall_times_round_trip_unless_they_fall_in_a_gap(naive: datetime, zone: ZoneInfo) -> None:
    instant = from_local(naive, zone)
    back = to_local(instant, zone)
    if back != naive:  # only a time the clocks skip moves, and only forward by the gap
        after = zone.utcoffset(naive + timedelta(hours=3))
        before = zone.utcoffset(naive - timedelta(hours=3))
        assert after is not None and before is not None
        assert back - naive == after - before > timedelta(0)


def test_recurrence_ids() -> None:
    assert rid_timed(wall("2026-10-09T16:00:00")) == "2026-10-09T16:00:00"
    assert rid_timed(wall("2026-10-09T16:00:00.250000")) == "2026-10-09T16:00:00"
    assert rid_date(date(2026, 10, 9)) == "2026-10-09"
    assert rid_date(wall("2026-10-09T16:00:00")) == "2026-10-09"


def test_parse_rid_tells_timed_from_all_day() -> None:
    timed = parse_rid("2026-10-09T16:00:00")
    assert isinstance(timed, datetime) and timed.tzinfo is None
    assert timed == wall("2026-10-09T16:00:00")
    day = parse_rid("2026-10-09")
    assert day == date(2026, 10, 9) and not isinstance(day, datetime)


@pytest.mark.parametrize(
    "rid",
    [
        "",
        "2026-10-09T16:00",
        "2026-10-09 16:00:00",
        "2026-10-09T16:00:00Z",
        "2026-10-09T16:00:00+00:00",
        "2026-10-09T16:00:00.5",
        "2026-02-30",
        "2026-10-09T24:00:00",
        "20261009",
        "\uff12\uff10\uff12\uff16-10-09",  # full-width digits
        " 2026-10-09",
    ],
)
def test_parse_rid_refuses_anything_else(rid: str) -> None:
    with pytest.raises(ValueError, match="recurrence id"):
        parse_rid(rid)


def test_day_bounds_follow_the_household_zone() -> None:
    start, end = day_bounds(date(2026, 10, 9), NY)
    assert (start, end) == (utc("2026-10-09T04:00:00"), utc("2026-10-10T04:00:00"))
    spring = day_bounds(date(2026, 3, 8), NY)
    autumn = day_bounds(date(2026, 11, 1), NY)
    assert spring[1] - spring[0] == timedelta(hours=23)
    assert autumn[1] - autumn[0] == timedelta(hours=25)
    london = day_bounds(date(2026, 3, 29), LONDON)
    assert london == (utc("2026-03-29T00:00:00"), utc("2026-03-29T23:00:00"))


def test_week_math() -> None:
    thursday = date(2026, 10, 8)
    assert iso_monday(thursday) == date(2026, 10, 5)
    assert iso_monday(date(2026, 10, 5)) == date(2026, 10, 5)
    assert week_start(thursday, 0) == date(2026, 10, 5)
    assert week_start(thursday, 6) == date(2026, 10, 4)  # a Sunday-first household
    assert week_start(date(2026, 10, 4), 6) == date(2026, 10, 4)
    assert week_start(date(2026, 10, 3), 6) == date(2026, 9, 27)
    assert week_start(thursday, 5) == date(2026, 10, 3)
    with pytest.raises(ValueError):
        week_start(thursday, 7)
