"""Who an event's title names (ADR 0034): "Mia & Leo's Skate Lesson" is Mia's and Leo's.

The same rules as quick add's (``features/calendar/quickAdd.ts``), so a title typed on the wall
and one imported from a synced calendar agree:

* whole words, with case and accents folded one character for one (Zoë meets Zoe);
* a person's full name, or for a name of several words its first word, unless that word is
  someone else's whole name (Ana and Ana Sofia: "Ana's recital" is Ana's) or the first word of
  another person's name too (then it's nobody's);
* an optional possessive ('s, with a straight or a curly apostrophe);
* the longest names first, each match hidden from the shorter ones, so Sam never matches inside
  Samba and Ana never inside Ana Sofia;
* a month's name beside a number is a date ("May 5", "the 5th of May"), not a person;
* a name of fewer than two letters never matches.

Pure: standard library only, no clock.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Sequence

MONTH_WORDS = frozenset(
    (
        "january february march april may june july august september october november december"
        " jan feb mar apr jun jul aug sep sept oct nov dec"
    ).split()
)

_HIDDEN = ""  # what a matched span becomes: not a word character, so it's an edge
_BEFORE_DATE = re.compile(r"\d(?:st|nd|rd|th)?\s+(?:of\s+)?$")
_AFTER_DATE = re.compile(r"^\s*\d")


def fold(text: str) -> str:
    """Lowercase without accents, one character for each one given, so positions line up."""
    out: list[str] = []
    for char in text:
        base = unicodedata.normalize("NFKD", char)[:1] or char
        out.append(base.lower()[:1] or base)
    return "".join(out)


def _key(name: str) -> str:
    return " ".join(fold(name).split())


def _candidates(names: Sequence[str]) -> list[tuple[str, int]]:
    """What each person can be called in a title, longest first: (folded words, their index)."""
    keys = [_key(name) for name in names]
    whole = set(keys)
    firsts: dict[str, int] = {}
    for key in keys:
        words = key.split()
        if len(words) > 1:
            firsts[words[0]] = firsts.get(words[0], 0) + 1
    found: list[tuple[str, int]] = []
    for index, key in enumerate(keys):
        if len(key.replace(" ", "")) >= 2:
            found.append((key, index))
        words = key.split()
        first = words[0] if len(words) > 1 else ""
        if len(first) >= 2 and first not in whole and firsts.get(first) == 1:
            found.append((first, index))
    return sorted(found, key=lambda candidate: -len(candidate[0]))


def _is_date(text: str, start: int, end: int) -> bool:
    return bool(_AFTER_DATE.match(text[end:]) or _BEFORE_DATE.search(text[:start]))


def people_named(title: str, names: Sequence[str]) -> list[str]:
    """The names the title says, as given and in the order of ``names`` (the household's)."""
    text = fold(title)
    matched: set[int] = set()
    for candidate, index in _candidates(names):
        body = r"\s+".join(re.escape(word) for word in candidate.split())
        pattern = re.compile(rf"(?<!\w)(?:{body})(?:['\u2019]s)?(?!\w)")
        spans = [
            (match.start(), match.end())
            for match in pattern.finditer(text)
            if not (candidate in MONTH_WORDS and _is_date(text, match.start(), match.end()))
        ]
        if not spans:
            continue
        matched.add(index)
        for start, end in spans:
            text = text[:start] + _HIDDEN * (end - start) + text[end:]
    return [names[index] for index in sorted(matched)]
