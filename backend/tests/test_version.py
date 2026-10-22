"""The running version (core/version.py): the image's build info, a release's own package, or a
checkout's VERSION file (ADR 0038)."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from pathlib import Path

import pytest

from sunroom.core import version


def says(answer: str) -> Callable[[str], str]:
    """importlib.metadata.version, answering for the installed package."""

    def version_of(name: str) -> str:
        assert name == "sunroom"
        return answer

    return version_of


@pytest.fixture(autouse=True)
def fresh(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    monkeypatch.setattr(version, "BUILD_INFO_PATH", tmp_path / "no-build-info.json")
    version.build_info.cache_clear()
    yield
    version.build_info.cache_clear()


def test_a_program_reads_its_version_from_its_package(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(version.metadata, "version", says("0.15.0"))
    assert version.build_info() == version.BuildInfo("0.15.0", "release", None)


def test_a_checkout_reads_the_repos_version_file(monkeypatch: pytest.MonkeyPatch) -> None:
    # The checkout's own package says 0.0.0 (the repo's pyproject never changes): not a release.
    monkeypatch.setattr(version.metadata, "version", says("0.0.0"))
    repo = (Path(__file__).resolve().parents[2] / "VERSION").read_text().strip()
    assert version.build_info() == version.BuildInfo(repo, "dev", None)


def test_the_images_build_info_comes_first(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    info = tmp_path / "build-info.json"
    info.write_text('{"version": "0.15.0", "revision": "abc1234", "created": "2026-10-22"}')
    monkeypatch.setattr(version, "BUILD_INFO_PATH", info)
    monkeypatch.setattr(version.metadata, "version", says("9.9.9"))
    assert version.build_info() == version.BuildInfo("0.15.0", "abc1234", "2026-10-22")
