"""Who an event's title names (domain/people.py, ADR 0034): quick add's rules, server side."""

from __future__ import annotations

import pytest

from sunroom.domain.people import fold, people_named

FAMILY = ["Ana", "Sam", "Mia", "Leo"]


@pytest.mark.parametrize(
    ("title", "names", "expected"),
    [
        ("Mia & Leo's Skate Lesson", ["Mia", "Leo", "Ana"], ["Mia", "Leo"]),
        ("Dentist", FAMILY, []),
        ("Take Leo to soccer", FAMILY, ["Leo"]),
        ("Mia\u2019s piano", FAMILY, ["Mia"]),  # a curly apostrophe
        ("mia leo", FAMILY, ["Mia", "Leo"]),  # household order, whatever the title's
        ("Leo and Mia: dentist", FAMILY, ["Mia", "Leo"]),
        ("Samba class", FAMILY, []),  # a name inside a word isn't the name
        ("Leopard spotting", FAMILY, []),
        ("Pick up Sam's car", FAMILY, ["Sam"]),
    ],
)
def test_names_in_a_title(title: str, names: list[str], expected: list[str]) -> None:
    assert people_named(title, names) == expected


def test_a_month_beside_a_number_is_a_date() -> None:
    names = ["May", "Leo"]
    assert people_named("May 5 picnic", names) == []
    assert people_named("Picnic on the 5th of May", names) == []
    assert people_named("Picnic 5 May", names) == []
    assert people_named("Swim with May", names) == ["May"]
    assert people_named("May's swim, May 5", names) == ["May"]


def test_a_full_name_its_first_word_and_someone_else_s_whole_name() -> None:
    both = ["Ana", "Ana Sofia"]
    assert people_named("Ana Sofia's recital", both) == ["Ana Sofia"]
    assert people_named("Ana's recital", both) == ["Ana"]
    # Without a plain Ana, the first word is Ana Sofia's.
    assert people_named("Ana's recital", ["Ana Sofia", "Leo"]) == ["Ana Sofia"]
    # A first word two people share is nobody's.
    assert people_named("Ana's recital", ["Ana Sofia", "Ana Maria"]) == []
    assert people_named("Ana  Maria at noon", ["Ana Sofia", "Ana Maria"]) == ["Ana Maria"]


def test_accents_and_case_fold_both_ways() -> None:
    assert people_named("Zoe's party", ["Zoë"]) == ["Zoë"]
    assert people_named("ZOË SWIM", ["Zoe"]) == ["Zoe"]
    assert fold("Zoë") == "zoe"
    assert len(fold("Ana Sofía")) == len("Ana Sofía")


def test_a_one_letter_name_never_matches() -> None:
    assert people_named("J and Leo", ["J", "Leo"]) == ["Leo"]
    assert people_named("Plan A", ["A"]) == []
