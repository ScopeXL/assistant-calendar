"""The startup sequence (PLAN §14.4). Nothing listens until every step has passed.

1. settings (exit 78)                    5. pre-migration backup (exit 74)
2. data dir + instance lock (73/74)      6. migrate in one transaction (exit 70)
3. the secret key, generated once (73)   7. verify + reconcile app_meta (exit 70)
4. inspect the revision (exit 65)
"""

from __future__ import annotations

import os
import shutil
import sqlite3
from dataclasses import dataclass
from pathlib import Path

from sunroom.core import secretkey
from sunroom.core.clock import Clock
from sunroom.core.config import Settings
from sunroom.core.crypto import key_check, password_fingerprint
from sunroom.core.logging import get_logger
from sunroom.core.version import build_info
from sunroom.db import backup, instance_lock, migrate

log = get_logger(__name__)

EXIT_CONFIG = 78
EXIT_DATA_DIR = 73
EXIT_DISK = 74
EXIT_UNKNOWN_REVISION = 65
EXIT_MIGRATION = 70

NETWORK_FILESYSTEMS = ("nfs", "nfs4", "cifs", "smb3", "smbfs", "9p", "fuse")
MIN_FREE_EXTRA = 64 * 1024 * 1024


class BootError(Exception):
    def __init__(self, exit_code: int, message: str) -> None:
        super().__init__(message)
        self.exit_code = exit_code
        self.message = message


@dataclass(frozen=True)
class MountEntry:
    mount_point: str
    fstype: str


def read_mounts(mountinfo: Path = Path("/proc/self/mountinfo")) -> list[MountEntry]:
    entries: list[MountEntry] = []
    if not mountinfo.exists():
        return entries
    for line in mountinfo.read_text().splitlines():
        before, sep, after = line.partition(" - ")
        fields = before.split()
        if not sep or len(fields) < 5:
            continue
        mount_point = fields[4].replace("\\040", " ")
        fstype = after.split()[0] if after.split() else ""
        entries.append(MountEntry(mount_point, fstype))
    return entries


def check_data_dir(settings: Settings, mounts: list[MountEntry] | None = None) -> None:
    data = settings.data_dir
    if settings.sunroom_container:
        mount_list = read_mounts() if mounts is None else mounts
        entry = next((m for m in mount_list if Path(m.mount_point) == data), None)
        if entry is None:
            raise BootError(
                EXIT_DATA_DIR,
                f"{data} is not a mounted volume, so data would be lost when the container is "
                "recreated. Mount a named volume there (see docker-compose.example.yml).",
            )
        if entry.fstype.startswith(NETWORK_FILESYSTEMS) and not settings.data_dir_unsafe_fs_ok:
            raise BootError(
                EXIT_DATA_DIR,
                f"{data} is on a {entry.fstype} filesystem; SQLite's WAL mode needs a local disk. "
                "Use a local named volume, or set DATA_DIR_UNSAFE_FS_OK=1 to accept the risk.",
            )
    else:
        data.mkdir(parents=True, exist_ok=True)
    probe = data / ".write-probe"
    try:
        with probe.open("wb") as handle:
            handle.write(b"ok")
            handle.flush()
            os.fsync(handle.fileno())
        probe.unlink()
    except OSError:
        stat = data.stat()
        raise BootError(
            EXIT_DATA_DIR,
            f"{data} isn't writable by uid {os.getuid()} (it is owned by "
            f"{stat.st_uid}:{stat.st_gid}, mode {oct(stat.st_mode & 0o777)}). Use the named "
            "volume from docker-compose.example.yml, or run `chown -R "
            f"{os.getuid()}:{os.getgid()} <host folder>`, or set `user:` to the folder's owner.",
        ) from None
    db_size = settings.db_path.stat().st_size if settings.db_path.exists() else 0
    if shutil.disk_usage(data).free < 2 * db_size + MIN_FREE_EXTRA:
        raise BootError(EXIT_DISK, f"Not enough free disk space in {data} to run safely.")


def _last_boot_version(db_path: Path) -> str | None:
    if not db_path.exists():
        return None
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        row = conn.execute("SELECT last_boot_version FROM app_meta").fetchone()
    except sqlite3.OperationalError:
        return None
    finally:
        conn.close()
    return row[0] if row else None


def _recent_copy_exists(directory: Path, revision: str | None, db_path: Path) -> bool:
    newest_source = max(
        (p.stat().st_mtime for p in (db_path, Path(f"{db_path}-wal")) if p.exists()), default=0.0
    )
    prefix = f"{backup.STEM}.{revision or 'empty'}."
    return any(
        path.stat().st_mtime >= newest_source
        for path in directory.glob(f"{prefix}*.db")
        if not path.name.endswith(".partial.db")
    )


def pre_migration_backup(settings: Settings, clock: Clock) -> Path | None:
    db_path = settings.db_path
    directory = settings.backup_dir / backup.PRE_MIGRATE_DIR
    revision = migrate.current_revision(db_path)
    if directory.exists() and _recent_copy_exists(directory, revision, db_path):
        log.info("boot.pre_migration_backup_skipped", reason="an up-to-date copy exists")
        return None
    destination = directory / backup.pre_migrate_name(revision, clock.now())
    try:
        result = backup.take_backup(db_path, destination)
    except backup.BackupError as exc:
        raise BootError(EXIT_DISK, f"The pre-migration backup failed: {exc}") from exc
    backup.rotate_pre_migrate(directory)
    log.info("boot.pre_migration_backup", file=result.path.name, bytes=result.bytes)
    return result.path


def _credential_tables(conn: sqlite3.Connection) -> list[tuple[str, bool]]:
    """Every table with a ``credentials_enc`` column, and whether it has a ``status`` column.
    Plugins add such tables (sync accounts, photo sources); a test enumerates them."""
    found: list[tuple[str, bool]] = []
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    for (table,) in tables:
        columns = {row[1] for row in conn.execute(f'PRAGMA table_info("{table}")')}
        if "credentials_enc" in columns:
            found.append((str(table), "status" in columns))
    return found


def reconcile_app_meta(settings: Settings, secret: str) -> None:
    """Notice a changed secret key or APP_PASSWORD since the last boot (PLAN §8.2, §12.7).

    Either signs every device out. A new secret key also wipes every stored credential (they were
    encrypted under the old one and can't be read) and marks their owners needs_reconnect."""
    env_password = settings.app_password.get_secret_value() if settings.app_password else None
    fingerprint = password_fingerprint(secret, env_password) if env_password else None
    check = key_check(secret)
    conn = sqlite3.connect(settings.db_path)
    try:
        row = conn.execute("SELECT password_fp, secret_key_check FROM app_meta").fetchone()
        old_fp, old_check = (row[0], row[1]) if row else (None, None)
        first_boot = old_check is None
        password_changed = not first_boot and old_fp != fingerprint
        key_changed = not first_boot and old_check != check
        if password_changed:
            log.warning("boot.password_changed", effect="every device must sign in again")
        if key_changed:
            log.warning(
                "boot.secret_key_changed",
                effect="every device must sign in again; connected accounts must reconnect",
            )
        bump = 1 if (password_changed or key_changed) else 0
        conn.execute(
            "UPDATE app_meta SET password_fp = ?, secret_key_check = ?, last_boot_version = ?, "
            "auth_epoch = auth_epoch + ?",
            (fingerprint, check, build_info().version, bump),
        )
        if key_changed:
            for table, has_status in _credential_tables(conn):
                status = ", status = 'needs_reconnect'" if has_status else ""
                conn.execute(
                    f'UPDATE "{table}" SET credentials_enc = NULL{status} '  # noqa: S608
                    "WHERE credentials_enc IS NOT NULL"
                )
        conn.commit()
    finally:
        conn.close()


def prepare(settings: Settings, clock: Clock, *, mounts: list[MountEntry] | None = None) -> str:
    """Steps 2-7. Returns the secret key to run with; raises BootError with the exit code."""
    check_data_dir(settings, mounts)
    try:
        instance_lock.acquire(settings.lock_path)
    except instance_lock.InstanceLockError as exc:
        raise BootError(EXIT_DATA_DIR, str(exc)) from None
    try:
        secret = secretkey.resolve(settings)
    except (secretkey.SecretKeyError, OSError) as exc:
        raise BootError(EXIT_DATA_DIR, f"The secret key couldn't be read or made: {exc}") from None
    db_path = settings.db_path
    try:
        migrate.check_known(db_path)
    except migrate.UnknownRevisionError as exc:
        raise BootError(EXIT_UNKNOWN_REVISION, str(exc)) from None
    pending = migrate.is_pending(db_path)
    version_changed = _last_boot_version(db_path) != build_info().version
    if db_path.exists() and (pending or version_changed):
        pre_migration_backup(settings, clock)
    try:
        if pending:
            target = migrate.upgrade(db_path)
            log.info("migrations.upgraded", head=target)
        migrate.verify(db_path)
    except migrate.MigrationError as exc:
        raise BootError(EXIT_MIGRATION, f"Migration failed; no changes were kept. {exc}") from exc
    log.info("migrations.at_head", head=migrate.head_revision())
    reconcile_app_meta(settings, secret)
    return secret
