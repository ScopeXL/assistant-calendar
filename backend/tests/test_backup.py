from __future__ import annotations

import sqlite3
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from sunroom.core.clock import FakeClock
from sunroom.db import backup

NY = ZoneInfo("America/New_York")


def _row_count(db: Path, table: str) -> int:
    conn = sqlite3.connect(db)
    try:
        return int(conn.execute(f"SELECT count(*) FROM {table}").fetchone()[0])  # noqa: S608
    finally:
        conn.close()


def test_backup_copies_and_verifies(data_dir: Path) -> None:
    db = data_dir / "sunroom.db"
    destination = data_dir / "backups" / "sunroom.2026-10-06.db"
    result = backup.take_backup(db, destination)
    assert destination.exists()
    assert not list(destination.parent.glob("*.partial.db"))
    assert result.revision is not None
    assert backup.inspect_backup(destination)["quick_check"] == "ok"


def test_rows_still_in_the_wal_are_included(data_dir: Path) -> None:
    db = data_dir / "sunroom.db"
    writer = sqlite3.connect(db)
    writer.execute("PRAGMA journal_mode=WAL")
    writer.execute("PRAGMA wal_autocheckpoint=0")
    writer.execute(
        "INSERT INTO members (id, name, role, color, sort, created_at) "
        "VALUES ('m1', 'Sample Parent', 'parent', 'clay', 0, '2026-10-06 12:00:00')"
    )
    writer.commit()  # committed to the WAL, not yet checkpointed
    try:
        destination = data_dir / "backups" / "sunroom.2026-10-06.db"
        backup.take_backup(db, destination)
        assert _row_count(destination, "members") == 1
    finally:
        writer.close()


def test_failed_verification_leaves_no_file(
    data_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def always_fails(*args: object) -> list[str]:
        return ["quick_check did not return ok"]

    monkeypatch.setattr(backup, "verify_problems", always_fails)
    destination = data_dir / "backups" / "sunroom.2026-10-06.db"
    with pytest.raises(backup.BackupError):
        backup.take_backup(data_dir / "sunroom.db", destination)
    assert list((data_dir / "backups").iterdir()) == []


def test_a_stale_partial_is_replaced(data_dir: Path) -> None:
    folder = data_dir / "backups"
    folder.mkdir()
    (folder / "sunroom.2026-10-06.partial.db").write_text("junk")
    backup.take_backup(data_dir / "sunroom.db", folder / "sunroom.2026-10-06.db")
    assert sorted(p.name for p in folder.iterdir()) == ["sunroom.2026-10-06.db"]


def test_missing_source_is_a_clear_error(tmp_path: Path) -> None:
    with pytest.raises(backup.BackupError, match="no database"):
        backup.take_backup(tmp_path / "missing.db", tmp_path / "out.db")


def test_retention_keeps_14_daily_and_8_weekly(tmp_path: Path) -> None:
    today = date(2026, 10, 6)
    days = [today - timedelta(days=offset) for offset in range(120)]
    for day in days:
        (tmp_path / backup.nightly_name(day)).write_text("x")
    (tmp_path / "unrelated.db").write_text("keep me")
    backup.rotate_nightly(tmp_path, today)
    kept = {d for d, _ in backup.nightly_files(tmp_path)}
    dailies = {today - timedelta(days=offset) for offset in range(14)}
    this_monday = today - timedelta(days=today.weekday())
    # newest copy (the Sunday) of each of the 8 ISO weeks before this one
    weekly = {this_monday - timedelta(days=7 * i - 6) for i in range(1, 9)}
    assert kept == dailies | weekly
    assert (tmp_path / "unrelated.db").exists()


def test_retention_follows_the_households_numbers(tmp_path: Path) -> None:
    """Settings → Backup (ADR 0034): 3 daily and 2 weekly here; 0 weekly keeps only dailies."""
    today = date(2026, 10, 6)  # a Tuesday
    for offset in range(40):
        (tmp_path / backup.nightly_name(today - timedelta(days=offset))).write_text("x")
    backup.rotate_nightly(tmp_path, today, keep_daily=3, keep_weekly=2)
    kept = {d for d, _ in backup.nightly_files(tmp_path)}
    # The newest three, and the Sunday of each of the two weeks before this one.
    assert kept == {today, date(2026, 10, 5), date(2026, 10, 4), date(2026, 9, 27)}
    backup.rotate_nightly(tmp_path, today, keep_daily=1, keep_weekly=0)
    assert {d for d, _ in backup.nightly_files(tmp_path)} == {today}


def test_a_copy_is_found_only_by_its_exact_name(tmp_path: Path) -> None:
    backups, data = tmp_path / "backups", tmp_path / "data"
    (backups / backup.PRE_ERASE_DIR).mkdir(parents=True)
    data.mkdir()
    (backups / "sunroom.2026-10-07.db").write_text("n")
    (backups / backup.PRE_ERASE_DIR / "sunroom.20261007T090000Z.db").write_text("e")
    (data / "sunroom.db").write_text("live")
    (data / "sunroom.pre-restore.20261007T080000Z-2.db").write_text("r")
    found = backup.locate(backups, data, "sunroom.pre-restore.20261007T080000Z-2.db", NY)
    assert found is not None and found.kind == backup.KIND_PRE_RESTORE
    assert found.made_at == datetime(2026, 10, 7, 4, 0, tzinfo=NY)
    erased = backup.locate(backups, data, "sunroom.20261007T090000Z.db", NY)
    assert erased is not None and erased.path.parent.name == backup.PRE_ERASE_DIR
    for name in (
        "../data/sunroom.db",
        "sunroom.2026-10-07.db/..",
        "pre-erase/sunroom.20261007T090000Z.db",
        "sunroom.db",
        "data.db",
        "full.zip",
        "sunroom.2026-10-08.db",  # the right shape, but there's no such copy
        "sunroom.2026-10-07.partial.db",
    ):
        assert backup.locate(backups, data, name, NY) is None, name


def test_service_runs_once_a_day_after_0330(data_dir: Path) -> None:
    clock = FakeClock(datetime(2026, 10, 6, 7, 0, tzinfo=UTC))  # 03:00 in New York
    service = backup.BackupService(
        db_path=data_dir / "sunroom.db",
        backup_dir=data_dir / "backups",
        zone_of=lambda: NY,
        clock=clock,
    )
    assert not service.due()
    clock.advance(minutes=31)  # 03:31 local
    assert service.due()


async def test_service_writes_one_copy_and_reports_status(data_dir: Path) -> None:
    clock = FakeClock(datetime(2026, 10, 6, 8, 0, tzinfo=UTC))
    service = backup.BackupService(
        db_path=data_dir / "sunroom.db",
        backup_dir=data_dir / "backups",
        zone_of=lambda: NY,
        clock=clock,
    )
    await service.tick()
    assert not service.due()
    status = service.status()
    assert status["last_error"] is None
    assert status["stale"] is False
    files = status["files"]
    assert isinstance(files, list) and len(files) == 1  # pyright: ignore[reportUnknownArgumentType]


async def test_a_backup_is_overdue_only_after_a_week(data_dir: Path) -> None:
    clock = FakeClock(datetime(2026, 10, 6, 8, 0, tzinfo=UTC))
    service = backup.BackupService(
        db_path=data_dir / "sunroom.db",
        backup_dir=data_dir / "backups",
        zone_of=lambda: NY,
        clock=clock,
    )
    assert service.status()["stale"] is False  # a new install, before its first night
    await service.tick()
    clock.advance(days=6)
    assert service.status()["stale"] is False
    clock.advance(days=2)
    assert service.status()["stale"] is True


async def test_failures_alert_once_per_shape_and_retry_hourly(
    data_dir: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    clock = FakeClock(datetime(2026, 10, 6, 8, 0, tzinfo=UTC))
    service = backup.BackupService(
        db_path=data_dir / "sunroom.db",
        backup_dir=data_dir / "backups",
        zone_of=lambda: NY,
        clock=clock,
    )
    calls = iter(["only 12 MB free", "only 11 MB free"])

    def failing(*args: object) -> backup.BackupResult:
        raise backup.BackupError(next(calls))

    alerts: list[str] = []

    class FakeLog:
        def error(self, event: str, **kwargs: object) -> None:
            alerts.append(event)

        def info(self, event: str, **kwargs: object) -> None:
            pass

    monkeypatch.setattr(backup, "take_backup", failing)
    monkeypatch.setattr(backup, "log", FakeLog())
    await service.tick()
    assert not service.due()  # waits an hour before retrying
    clock.advance(hours=1, minutes=1)
    await service.tick()
    assert service.last_error == "only 11 MB free"
    assert alerts == ["backup.failed"]  # same error shape (only the number changed): one alert
