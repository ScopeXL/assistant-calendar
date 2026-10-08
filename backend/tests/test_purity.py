"""domain/ must stay pure: no clocks, no randomness, no I/O (CLAUDE.md rule 5, PLAN §7.3).

Only the standard library, plus python-dateutil's rrule and zoneinfo, which are deterministic
given their inputs (recurrence expansion, M1)."""

from __future__ import annotations

import ast
from pathlib import Path

import sunroom.domain

ALLOWED_IMPORTS = {
    "__future__",
    "zoneinfo",
    "dateutil.rrule",
    "calendar",
    "dataclasses",
    "enum",
    "typing",
    "collections",
    "collections.abc",
    "datetime",
    "math",
    "re",
    "unicodedata",
    "itertools",
    "functools",
}
BANNED_CALLS = {"now", "today", "utcnow", "time", "random"}
DOMAIN = Path(sunroom.domain.__file__).parent


def _modules() -> list[Path]:
    return sorted(DOMAIN.rglob("*.py"))


def test_the_check_sees_the_domain_package() -> None:
    assert DOMAIN.name == "domain"
    assert _modules()


def test_domain_imports_only_the_allowed_standard_library() -> None:
    for path in _modules():
        tree = ast.parse(path.read_text(), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                if node.level and node.level > 0:
                    continue  # relative imports stay inside domain/
                names = [node.module or ""]
            else:
                continue
            for name in names:
                assert name in ALLOWED_IMPORTS or name.startswith("sunroom.domain"), (
                    f"{path.name} imports {name}; domain/ must stay pure"
                )


def test_domain_never_reads_the_clock_or_randomness() -> None:
    for path in _modules():
        tree = ast.parse(path.read_text(), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                assert node.func.attr not in BANNED_CALLS, (
                    f"{path.name} calls .{node.func.attr}(); pass `now` in instead"
                )
