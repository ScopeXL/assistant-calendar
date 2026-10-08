"""The lists plugin's rules apart from the API: what a list's name says it is, when two items are
the same thing, and the Usuals strip. Synthetic data only."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sunroom.plugins.lists.models import ListKind
from sunroom.plugins.lists.service import STAPLES, guess_kind, item_key, usuals

T0 = datetime(2026, 10, 7, 14, 0, tzinfo=UTC)


def at(minutes: int) -> datetime:
    return T0 + timedelta(minutes=minutes)


def test_a_lists_name_says_what_it_is() -> None:
    guesses = {
        "Groceries": ListKind.GROCERY,
        "grocery run": ListKind.GROCERY,
        "Shopping": ListKind.GROCERY,
        "Costco": ListKind.GROCERY,
        "Pharmacy": ListKind.GROCERY,
        "Farmers market": ListKind.GROCERY,
        "Hardware store": ListKind.GROCERY,
        "To do": ListKind.TODO,
        "TODO": ListKind.TODO,
        "To-do this week": ListKind.TODO,
        "Errands": ListKind.TODO,
        "Packing: beach": ListKind.PACKING,
        "Pack for camp": ListKind.PACKING,
        "Packing to do": ListKind.PACKING,  # packing is looked for first,
        "Shopping errands": ListKind.TODO,  # then to-dos, then shopping
        "Gift ideas": ListKind.CUSTOM,
        "Movies to watch": ListKind.CUSTOM,
    }
    for name, kind in guesses.items():
        assert guess_kind(name) is kind, name


def test_items_are_the_same_thing_whatever_their_case_and_outer_spaces() -> None:
    assert item_key("  Oat Milk ") == item_key("oat milk") == item_key("OAT MILK") == "oat milk"
    assert item_key("Oat milk") != item_key("Oatmilk")


def test_usuals_need_two_adds_and_show_the_latest_spelling() -> None:
    history = [("bananas", at(0)), ("Rice", at(1)), ("BANANAS", at(2)), ("Bananas ", at(3))]
    assert usuals(history, set(), ListKind.CUSTOM) == ["Bananas"]


def test_usuals_go_by_how_often_then_how_lately() -> None:
    history = [
        ("Coffee", at(0)),
        ("Tea", at(1)),
        ("Tea", at(2)),
        ("Coffee", at(3)),
        ("Jam", at(4)),
        ("Jam", at(5)),
        ("Jam", at(6)),
    ]
    assert usuals(history, set(), ListKind.TODO) == ["Jam", "Coffee", "Tea"]


def test_usuals_leave_out_what_is_on_the_list_and_stop_at_twelve() -> None:
    history = [(f"Thing {n}", at(n)) for n in range(15) for _ in range(2)]
    shown = usuals(history, {"thing 14"}, ListKind.CUSTOM)
    assert shown == [f"Thing {n}" for n in range(13, 1, -1)]


def test_a_grocery_list_is_topped_up_with_staples() -> None:
    assert usuals([], set(), ListKind.GROCERY) == list(STAPLES)
    assert usuals([], {"milk", "eggs"}, ListKind.GROCERY) == [
        "Bread",
        "Bananas",
        "Apples",
        "Butter",
        "Cheese",
        "Yogurt",
    ]
    # A staple the family buys shows once, in their spelling.
    assert usuals([("milk", at(0)), ("MILK", at(1))], set(), ListKind.GROCERY) == [
        "MILK",
        "Eggs",
        "Bread",
        "Bananas",
        "Apples",
        "Butter",
        "Cheese",
        "Yogurt",
    ]
    # Eight of its own: no staples.
    own = [(f"Thing {n}", at(n)) for n in range(8) for _ in range(2)]
    assert usuals(own, set(), ListKind.GROCERY) == [f"Thing {n}" for n in range(7, -1, -1)]
    # Other lists never get them.
    assert usuals([], set(), ListKind.PACKING) == []
