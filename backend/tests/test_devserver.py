"""``sunroom serve --reload`` restarts after a restore by writing a file the reloader watches
(ADR 0034): its worker is a spawned child, which can't run its own command line again."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from sunroom import cli, devserver


def test_the_dev_servers_restart_writes_a_watched_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The reloader watches the package's folder, where this module lives.
    assert Path(devserver.__file__).parent == Path(cli.__file__).parent
    # A stand-in for the module's own file, so the test changes nothing in the repository.
    stand_in = tmp_path / "devserver.py"
    stand_in.write_text('"""unchanged"""\n')
    os.utime(stand_in, (1_000_000, 1_000_000))
    monkeypatch.setattr(devserver, "__file__", str(stand_in))

    devserver.reload()

    assert stand_in.stat().st_mtime > 1_000_000
    assert stand_in.read_text() == '"""unchanged"""\n'
