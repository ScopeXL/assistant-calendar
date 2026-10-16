"""Verified SQLite backups (PLAN §13.7, §14.4).

Ported from Dinner Bell: the SQLite online backup API copies into a
``.partial.db`` file, the copy is verified (quick_check, migration revision, row counts that
fall between the source's before/after counts), and only then is it atomically renamed into
place. A failed verification leaves no file behind.

Every database file name ends in ``.db``; the date or revision goes before the extension.

Settings → Backup lists four kinds of copy, newest first (ADR 0034): the nightly ones in
``backups/``, the one before each upgrade in ``backups/pre-migrate/``, the one Erase everything
keeps in ``backups/pre-erase/``, and the database a restore moved aside, beside the live one. A
name is looked up only by matching one kind's pattern exactly, so no name reaches another file.
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import sqlite3
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from sunroom.core.clock import Clock
from sunroom.core.logging import get_logger

log = get_logger(__name__)

STEM = "sunroom"
NIGHTLY_RE = re.compile(rf"^{STEM}\.(\d{{4}}-\d{{2}}-\d{{2}})\.db$")
# The time each was made, in UTC, is in its name ("stamp").
PRE_MIGRATE_RE = re.compile(rf"^{STEM}\.(\d{{12}}|empty)\.(?P<stamp>\d{{8}}T\d{{6}}Z)\.db$")
PRE_ERASE_RE = re.compile(rf"^{STEM}\.(?P<stamp>\d{{8}}T\d{{6}}Z)\.db$")
PRE_RESTORE_RE = re.compile(rf"^{STEM}\.pre-restore\.(?P<stamp>\d{{8}}T\d{{6}}Z)(?:-\d+)?\.db$")
PRE_MIGRATE_DIR = "pre-migrate"
PRE_ERASE_DIR = "pre-erase"  # the copy Erase everything makes first; never rotated
KIND_NIGHTLY = "nightly"
KIND_PRE_MIGRATE = "pre-migrate"
KIND_PRE_ERASE = "pre-erase"
KIND_PRE_RESTORE = "pre-restore"
STAMP_FORMAT = "%Y%m%dT%H%M%SZ"
# The household's own numbers since 0.12.0 (Settings → Backup); these are the defaults.
KEEP_DAILY = 14
KEEP_WEEKLY = 8
KEEP_PRE_MIGRATE = 5
STALE_AFTER = timedelta(days=7)
NIGHTLY_AT = (3, 30)  # 03:30 local time avoids the daylight-saving changeover hour
MIN_FREE_EXTRA = 64 * 1024 * 1024


class BackupError(Exception):
    pass


class NoRoomError(BackupError):
    """Not enough free disk space for a verified copy."""


class BackupBusyError(BackupError):
    """A backup is being written: a copy can't be removed until it's done."""


@dataclass(frozen=True, slots=True)
class BackupPolicy:
    """The household's choices (Settings → Backup, ADR 0034): whether a copy is made every
    night, and how many daily and weekly copies stay."""

    enabled: bool = True
    keep_daily: int = KEEP_DAILY
    keep_weekly: int = KEEP_WEEKLY


@dataclass(frozen=True, slots=True)
class Copy:
    """One copy on the server, as Settings → Backup lists it."""

    name: str
    kind: str
    path: Path
    made_at: datetime
    bytes: int


@dataclass(frozen=True)
class BackupResult:
    path: Path
    bytes: int
    seconds: float
    revision: str | None
    row_counts: dict[str, int]


def _user_tables(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' "
        "ORDER BY name"
    ).fetchall()
    return [str(row[0]) for row in rows]


def _counts(conn: sqlite3.Connection) -> dict[str, int]:
    return {
        table: int(conn.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])  # noqa: S608
        for table in _user_tables(conn)
    }


def _revision(conn: sqlite3.Connection) -> str | None:
    try:
        row = conn.execute("SELECT version_num FROM alembic_version").fetchone()
    except sqlite3.OperationalError:
        return None
    return str(row[0]) if row else None


def verify_problems(
    copy: Path, before: dict[str, int], after: dict[str, int], revision: str | None
) -> list[str]:
    problems: list[str] = []
    conn = sqlite3.connect(f"file:{copy}?mode=ro", uri=True)
    try:
        check = conn.execute("PRAGMA quick_check").fetchone()
        if not check or check[0] != "ok":
            problems.append("quick_check did not return ok")
        if _revision(conn) != revision:
            problems.append("migration revision differs from the source")
        copied = _counts(conn)
    finally:
        conn.close()
    for table in sorted(set(before) | set(after)):
        low = min(before.get(table, 0), after.get(table, 0))
        high = max(before.get(table, 0), after.get(table, 0))
        if not low <= copied.get(table, -1) <= high:
            problems.append(f"row count for {table} is outside the source's range")
    return problems


def take_backup(source: Path, destination: Path) -> BackupResult:
    """Copy ``source`` to ``destination`` (a ``.db`` path) via a verified ``.partial.db``."""
    started = time.monotonic()
    if not source.exists():
        raise BackupError("there is no database to back up yet")
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_name(destination.name.removesuffix(".db") + ".partial.db")
    partial.unlink(missing_ok=True)
    size = source.stat().st_size
    free = shutil.disk_usage(destination.parent).free
    if free < 2 * size + MIN_FREE_EXTRA:
        raise NoRoomError("not enough free disk space for a verified copy")
    # Opened read-write on purpose: a read-only open of an idle WAL database can leave
    # -wal/-shm files behind.
    src = sqlite3.connect(source)
    try:
        before = _counts(src)
        revision = _revision(src)
        dst = sqlite3.connect(partial)
        try:
            src.backup(dst)
            # A backup must be one self-contained file: switch the copy out of WAL mode.
            dst.execute("PRAGMA journal_mode=DELETE")
        finally:
            dst.close()
        after = _counts(src)
    finally:
        src.close()
    try:
        problems = verify_problems(partial, before, after, revision)
        if problems:
            raise BackupError("backup verification failed: " + "; ".join(problems))
        os.replace(partial, destination)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    finally:
        for suffix in ("-wal", "-shm", "-journal"):
            Path(f"{partial}{suffix}").unlink(missing_ok=True)
    return BackupResult(
        path=destination,
        bytes=destination.stat().st_size,
        seconds=round(time.monotonic() - started, 3),
        revision=revision,
        row_counts=after,
    )


def nightly_name(day: date) -> str:
    return f"{STEM}.{day.isoformat()}.db"


def pre_migrate_name(revision: str | None, at: datetime) -> str:
    return f"{STEM}.{revision or 'empty'}.{at.strftime(STAMP_FORMAT)}.db"


def pre_erase_name(at: datetime) -> str:
    return f"{STEM}.{at.strftime(STAMP_FORMAT)}.db"


def _places(backup_dir: Path, data_dir: Path) -> tuple[tuple[str, Path, re.Pattern[str]], ...]:
    """Where each kind of copy lives, and the exact pattern of its names."""
    return (
        (KIND_NIGHTLY, backup_dir, NIGHTLY_RE),
        (KIND_PRE_MIGRATE, backup_dir / PRE_MIGRATE_DIR, PRE_MIGRATE_RE),
        (KIND_PRE_ERASE, backup_dir / PRE_ERASE_DIR, PRE_ERASE_RE),
        (KIND_PRE_RESTORE, data_dir, PRE_RESTORE_RE),
    )


def _copy_of(kind: str, path: Path, match: re.Match[str], zone: ZoneInfo) -> Copy | None:
    """The copy at ``path``, when it's a file. When it was made: the time in its name (a restore
    moves the old database aside without touching it, so its file time is older), else the
    file's own time."""
    try:
        info = path.stat()
    except FileNotFoundError:
        return None
    if not path.is_file():
        return None
    stamp = match.groupdict().get("stamp")
    if stamp:
        made_at = datetime.strptime(stamp, STAMP_FORMAT).replace(tzinfo=UTC).astimezone(zone)
    else:
        made_at = datetime.fromtimestamp(info.st_mtime, tz=zone)
    return Copy(name=path.name, kind=kind, path=path, made_at=made_at, bytes=info.st_size)


def list_copies(backup_dir: Path, data_dir: Path, zone: ZoneInfo) -> list[Copy]:
    """Every copy on the server, newest first; never a half-written ``.partial`` file."""
    found: list[Copy] = []
    for kind, folder, pattern in _places(backup_dir, data_dir):
        try:
            names = os.listdir(folder)
        except FileNotFoundError, NotADirectoryError:
            continue
        for name in names:
            match = pattern.fullmatch(name)
            if match:
                copy = _copy_of(kind, folder / name, match, zone)
                if copy is not None:
                    found.append(copy)
    return sorted(found, key=lambda copy: copy.made_at, reverse=True)


def locate(backup_dir: Path, data_dir: Path, name: str, zone: ZoneInfo) -> Copy | None:
    """The copy with this exact name, or None. Only a name matching one kind's pattern is looked
    for, in that kind's folder: ``../x``, ``data.db`` or ``full.zip`` find nothing."""
    for kind, folder, pattern in _places(backup_dir, data_dir):
        match = pattern.fullmatch(name)
        if match:
            return _copy_of(kind, folder / name, match, zone)
    return None


def nightly_files(backup_dir: Path) -> list[tuple[date, Path]]:
    found: list[tuple[date, Path]] = []
    if not backup_dir.is_dir():
        return found
    for path in backup_dir.iterdir():
        match = NIGHTLY_RE.match(path.name)
        if match:
            found.append((date.fromisoformat(match.group(1)), path))
    return sorted(found)


def days_to_keep(
    days: list[date],
    today: date,
    keep_daily: int = KEEP_DAILY,
    keep_weekly: int = KEEP_WEEKLY,
) -> set[date]:
    """The newest ``keep_daily`` copies, plus the newest copy from each of the ``keep_weekly``
    weeks before this one."""
    newest_first = sorted(days, reverse=True)
    keep = set(newest_first[:keep_daily])
    this_week = today.isocalendar()[:2]
    seen_weeks: list[tuple[int, int]] = []
    for day in newest_first:
        week = day.isocalendar()[:2]
        if week == this_week or week in seen_weeks:
            continue
        if len(seen_weeks) >= keep_weekly:
            break
        seen_weeks.append(week)
        keep.add(day)
    return keep


def rotate_nightly(
    backup_dir: Path,
    today: date,
    keep_daily: int = KEEP_DAILY,
    keep_weekly: int = KEEP_WEEKLY,
) -> int:
    files = nightly_files(backup_dir)
    keep = days_to_keep([day for day, _ in files], today, keep_daily, keep_weekly)
    removed = 0
    for day, path in files:
        if day not in keep:
            path.unlink(missing_ok=True)
            removed += 1
    return removed


def rotate_pre_migrate(directory: Path) -> None:
    files = sorted(
        (p for p in directory.glob(f"{STEM}.*.db") if not p.name.endswith(".partial.db")),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for stale in files[KEEP_PRE_MIGRATE:]:
        stale.unlink(missing_ok=True)


def inspect_backup(path: Path) -> dict[str, object]:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        check = conn.execute("PRAGMA quick_check").fetchone()
        app_version: str | None = None
        try:
            row = conn.execute("SELECT last_boot_version FROM app_meta").fetchone()
            app_version = row[0] if row else None
        except sqlite3.OperationalError:
            pass
        return {
            "file": path.name,
            "revision": _revision(conn),
            "app_version": app_version,
            "quick_check": check[0] if check else None,
            "row_counts": _counts(conn),
        }
    finally:
        conn.close()


def _unlink_with_journal(path: Path) -> None:
    for suffix in ("", "-wal", "-shm"):
        Path(f"{path}{suffix}").unlink(missing_ok=True)


def _error_shape(message: str) -> str:
    return re.sub(r"\d+", "#", message)


@dataclass
class BackupService:
    """Nightly verified copies plus on-demand runs (GET/POST /api/admin/backups). "Nightly" is
    03:30 in the household's time zone, which can change in Settings, hence a callable; so can
    whether there is a nightly copy at all, and how many stay (``policy_of``, ADR 0034)."""

    db_path: Path
    backup_dir: Path
    zone_of: Callable[[], ZoneInfo]
    clock: Clock
    policy_of: Callable[[], BackupPolicy] = BackupPolicy
    last_success_at: datetime | None = None
    last_error: str | None = None
    _last_error_shape: str | None = None
    _retry_after: datetime | None = None
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    def _newest_file_time(self) -> datetime | None:
        files = nightly_files(self.backup_dir)
        if not files:
            return None
        newest = max(files, key=lambda item: item[1].stat().st_mtime)[1]
        return datetime.fromtimestamp(newest.stat().st_mtime, tz=self.zone_of())

    def copies(self) -> list[Copy]:
        return list_copies(self.backup_dir, self.db_path.parent, self.zone_of())

    def locate(self, name: str) -> Copy | None:
        return locate(self.backup_dir, self.db_path.parent, name, self.zone_of())

    def status(self) -> dict[str, object]:
        policy = self.policy_of()
        last = self.last_success_at or self._newest_file_time()
        # UX §8: a line in Backup once the newest copy is a week old. A new install that hasn't
        # reached its first night yet isn't behind, and nor is a household that turned the
        # nightly copies off.
        stale = policy.enabled and last is not None and (self.clock.now() - last) > STALE_AFTER
        return {
            "directory": str(self.backup_dir),
            "schedule": f"daily at {NIGHTLY_AT[0]:02d}:{NIGHTLY_AT[1]:02d} ({self.zone_of().key})",
            "retention": f"{policy.keep_daily} daily + {policy.keep_weekly} weekly",
            "enabled": policy.enabled,
            "keep_daily": policy.keep_daily,
            "keep_weekly": policy.keep_weekly,
            "busy": self._lock.locked(),
            "last_success_at": last.isoformat() if last else None,
            "last_error": self.last_error,
            "stale": stale,
            "files": [
                {
                    "name": copy.name,
                    "kind": copy.kind,
                    "made_at": copy.made_at.isoformat(),
                    "bytes": copy.bytes,
                }
                for copy in self.copies()
            ],
        }

    async def remove(self, name: str) -> None:
        """Remove one copy (Settings → Backup), with what SQLite may have left beside it.
        LookupError for a name that isn't a copy; BackupBusyError while a backup is written."""
        copy = self.locate(name)
        if copy is None:
            raise LookupError(name)
        if self._lock.locked():
            raise BackupBusyError("a backup is being written")
        async with self._lock:
            await asyncio.to_thread(_unlink_with_journal, copy.path)
        log.info("backup.removed", file=copy.name, kind=copy.kind)

    async def run_now(self) -> BackupResult:
        async with self._lock:
            local_today = self.clock.now().astimezone(self.zone_of()).date()
            destination = self.backup_dir / nightly_name(local_today)
            try:
                result = await asyncio.to_thread(take_backup, self.db_path, destination)
                await asyncio.to_thread(self._optimize)
            except Exception as exc:
                self._record_failure(str(exc))
                raise
            policy = self.policy_of()
            removed = rotate_nightly(
                self.backup_dir, local_today, policy.keep_daily, policy.keep_weekly
            )
            self.last_success_at = self.clock.now()
            self.last_error = None
            self._last_error_shape = None
            self._retry_after = None
            log.info(
                "backup.completed",
                file=result.path.name,
                bytes=result.bytes,
                seconds=result.seconds,
                rotated_out=removed,
            )
            return result

    def _optimize(self) -> None:
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("PRAGMA optimize")
        finally:
            conn.close()

    def _record_failure(self, message: str) -> None:
        self.last_error = message
        self._retry_after = self.clock.now() + timedelta(hours=1)
        shape = _error_shape(message)
        if shape != self._last_error_shape:
            self._last_error_shape = shape
            log.error("backup.failed", reason=message)

    def due(self) -> bool:
        if not self.policy_of().enabled:
            return False  # Back Up Now still makes one (run_now)
        now_local = self.clock.now().astimezone(self.zone_of())
        if self._retry_after and self.clock.now() < self._retry_after:
            return False
        if (now_local.hour, now_local.minute) < NIGHTLY_AT:
            return False
        today = now_local.date()
        return not (self.backup_dir / nightly_name(today)).exists()

    async def tick(self) -> None:
        """Called every 10 minutes by the job runner."""
        if self.due():
            try:
                await self.run_now()
            except Exception:  # noqa: S110 - already recorded and logged once per error shape
                pass
