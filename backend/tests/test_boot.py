"""The startup sequence (PLAN §14.4)."""

from __future__ import annotations

import sqlite3
import subprocess
import sys
import textwrap
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

import pytest

from sunroom import boot
from sunroom.core import secretkey
from sunroom.core.clock import FakeClock
from sunroom.db import backup, instance_lock, migrate
from tests.support import make_settings

CLOCK = FakeClock(datetime(2026, 10, 7, 14, 0, tzinfo=UTC))
OTHER_SECRET = "another-secret-" + "1" * 32


def _epoch(db: Path) -> int:
    with closing(sqlite3.connect(db)) as conn:
        return int(conn.execute("SELECT auth_epoch FROM app_meta").fetchone()[0])


def _reboot(data_dir: Path, **settings: object) -> str:
    instance_lock.release(data_dir / ".lock")
    return boot.prepare(make_settings(data_dir, **settings), CLOCK)


def test_fresh_install_migrates_and_records_the_boot(tmp_path: Path) -> None:
    settings = make_settings(tmp_path / "data")
    boot.prepare(settings, CLOCK)
    assert migrate.current_revision(settings.db_path) == migrate.head_revision()
    with closing(sqlite3.connect(settings.db_path)) as conn:
        fp, check, version = conn.execute(
            "SELECT password_fp, secret_key_check, last_boot_version FROM app_meta"
        ).fetchone()
    assert fp is None  # no APP_PASSWORD: the wizard's password is in password_hash
    assert check and version
    assert not (settings.backup_dir / backup.PRE_MIGRATE_DIR).exists()  # nothing to back up yet


def test_without_a_key_one_is_generated_once_and_kept(tmp_path: Path) -> None:
    data = tmp_path / "data"
    settings = make_settings(data, app_secret_key=None)
    first = boot.prepare(settings, CLOCK)
    key_file = data / "secret.key"
    assert key_file.read_text().strip() == first
    assert oct(key_file.stat().st_mode & 0o777) == "0o600"
    assert len(first) >= 48
    assert _reboot(data, app_secret_key=None) == first


def test_a_key_from_the_environment_wins(tmp_path: Path) -> None:
    data = tmp_path / "data"
    key = make_settings(data).app_secret_key
    assert key is not None
    assert boot.prepare(make_settings(data), CLOCK) == key.get_secret_value()
    assert not (data / "secret.key").exists()


def test_a_damaged_key_file_says_how_to_fix_it(tmp_path: Path) -> None:
    data = tmp_path / "data"
    data.mkdir()
    (data / "secret.key").write_text("short\n")
    with pytest.raises(boot.BootError) as caught:
        boot.prepare(make_settings(data, app_secret_key=None), CLOCK)
    assert caught.value.exit_code == boot.EXIT_DATA_DIR
    assert "delete it" in caught.value.message
    with pytest.raises(secretkey.SecretKeyError):
        secretkey.load_or_create(data / "secret.key")


def test_changing_app_password_signs_everyone_out(data_dir: Path) -> None:
    boot.prepare(make_settings(data_dir, app_password="the-first-passphrase"), CLOCK)
    before = _epoch(data_dir / "sunroom.db")
    _reboot(data_dir, app_password="a-brand-new-passphrase")
    assert _epoch(data_dir / "sunroom.db") == before + 1
    _reboot(data_dir, app_password="a-brand-new-passphrase")
    assert _epoch(data_dir / "sunroom.db") == before + 1  # unchanged: no sign-out


def test_changing_the_secret_key_signs_everyone_out_and_wipes_credentials(
    data_dir: Path,
) -> None:
    """Credentials encrypted under the old key can't be read: wipe every one (PLAN §8.2)."""
    db = data_dir / "sunroom.db"
    boot.prepare(make_settings(data_dir), CLOCK)
    with closing(sqlite3.connect(db)) as conn:
        # A plugin's table with credentials, as calendar_sync and screensaver will add.
        conn.execute("CREATE TABLE sample_accounts (id TEXT, status TEXT, credentials_enc TEXT)")
        conn.execute("INSERT INTO sample_accounts VALUES ('a1', 'connected', 'gAAAAA-sample')")
        conn.execute("CREATE TABLE sample_sources (id TEXT, credentials_enc TEXT)")
        conn.execute("INSERT INTO sample_sources VALUES ('s1', 'gAAAAA-sample')")
        conn.commit()
    before = _epoch(db)
    _reboot(data_dir, app_secret_key=OTHER_SECRET)
    assert _epoch(db) == before + 1
    with closing(sqlite3.connect(db)) as conn:
        assert conn.execute("SELECT status, credentials_enc FROM sample_accounts").fetchone() == (
            "needs_reconnect",
            None,
        )
        assert conn.execute("SELECT credentials_enc FROM sample_sources").fetchone() == (None,)


def test_every_real_credentials_table_is_wiped_when_the_key_changes(data_dir: Path) -> None:
    """The real schema (PLAN §15 M5): each table that keeps encrypted credentials today. A new
    one fails the first assert until it's added here, so nobody forgets what a key change does
    to it."""
    db = data_dir / "sunroom.db"
    boot.prepare(make_settings(data_dir), CLOCK)
    with closing(sqlite3.connect(db)) as conn:
        assert sorted(boot._credential_tables(conn)) == [  # pyright: ignore[reportPrivateUsage]
            ("photo_sources", False),
            ("sync_accounts", True),
        ]
        conn.execute(
            "INSERT INTO sync_accounts (id, provider, auth_mode, label, status, server_url,"
            " credentials_enc, config_json, allow_private, interval_s, consecutive_failures,"
            " version, created_at) VALUES ('a1', 'caldav', 'app_password', 'Sample', 'connected',"
            " 'caldav.example.com', 'gAAAAA-sample', '{}', 0, 1800, 0, 1, '2026-10-07 12:00:00')"
        )
        conn.execute(
            "INSERT INTO photo_sources (id, kind, label, config_json, credentials_enc,"
            " allow_private, enabled, items_seen, created_at) VALUES ('s1', 'immich', 'Sample',"
            " '{}', 'gAAAAA-sample', 0, 1, 0, '2026-10-07 12:00:00')"
        )
        conn.commit()
    _reboot(data_dir, app_secret_key=OTHER_SECRET)
    with closing(sqlite3.connect(db)) as conn:
        assert conn.execute("SELECT status, credentials_enc FROM sync_accounts").fetchone() == (
            "needs_reconnect",
            None,
        )
        assert conn.execute("SELECT credentials_enc FROM photo_sources").fetchone() == (None,)


def test_a_version_change_takes_a_pre_migration_backup_once(data_dir: Path) -> None:
    settings = make_settings(data_dir)
    boot.prepare(settings, CLOCK)  # the template DB has no last_boot_version yet
    folder = settings.backup_dir / backup.PRE_MIGRATE_DIR
    copies = list(folder.glob("*.db"))
    assert len(copies) == 1
    _reboot(data_dir)  # same version, nothing pending: no new copy
    assert list(folder.glob("*.db")) == copies


def test_unknown_revision_exits_65(data_dir: Path) -> None:
    with closing(sqlite3.connect(data_dir / "sunroom.db")) as conn:
        conn.execute("UPDATE alembic_version SET version_num = '209912312359'")
        conn.commit()
    with pytest.raises(boot.BootError) as caught:
        boot.prepare(make_settings(data_dir), CLOCK)
    assert caught.value.exit_code == boot.EXIT_UNKNOWN_REVISION


def test_failed_migration_exits_70_and_keeps_the_data(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = make_settings(tmp_path / "data")
    settings.data_dir.mkdir(parents=True)
    sqlite3.connect(settings.db_path).close()
    before = settings.db_path.read_bytes()

    def broken(db_path: Path) -> str:
        raise migrate.MigrationError("simulated")

    monkeypatch.setattr(migrate, "upgrade", broken)
    with pytest.raises(boot.BootError) as caught:
        boot.prepare(settings, CLOCK)
    assert caught.value.exit_code == boot.EXIT_MIGRATION
    assert settings.db_path.read_bytes() == before


def test_container_requires_a_mounted_volume(tmp_path: Path) -> None:
    settings = make_settings(tmp_path, sunroom_container=True)
    with pytest.raises(boot.BootError) as caught:
        boot.check_data_dir(settings, mounts=[boot.MountEntry("/", "overlay")])
    assert caught.value.exit_code == boot.EXIT_DATA_DIR
    assert "not a mounted volume" in caught.value.message


def test_network_filesystems_are_refused(tmp_path: Path) -> None:
    settings = make_settings(tmp_path, sunroom_container=True)
    mounts = [boot.MountEntry(str(tmp_path), "nfs4")]
    with pytest.raises(boot.BootError) as caught:
        boot.check_data_dir(settings, mounts=mounts)
    assert "nfs4" in caught.value.message
    allowed = make_settings(tmp_path, sunroom_container=True, data_dir_unsafe_fs_ok=True)
    boot.check_data_dir(allowed, mounts=mounts)


def test_unwritable_data_dir_explains_the_fix(tmp_path: Path) -> None:
    data = tmp_path / "data"
    data.mkdir()
    data.chmod(0o500)
    try:
        with pytest.raises(boot.BootError) as caught:
            boot.check_data_dir(make_settings(data))
    finally:
        data.chmod(0o700)
    assert caught.value.exit_code == boot.EXIT_DATA_DIR
    assert "chown" in caught.value.message


def test_mountinfo_parsing(tmp_path: Path) -> None:
    sample = tmp_path / "mountinfo"
    sample.write_text(
        "36 35 98:0 /mnt1 /data rw,noatime master:1 - ext4 /dev/root rw\n"
        "37 35 0:42 / /my\\040files rw - nfs4 server:/x rw\n"
    )
    entries = boot.read_mounts(sample)
    assert entries == [boot.MountEntry("/data", "ext4"), boot.MountEntry("/my files", "nfs4")]


def test_a_second_process_cannot_take_the_lock(tmp_path: Path) -> None:
    lock = tmp_path / ".lock"
    instance_lock.acquire(lock)
    script = textwrap.dedent(
        f"""
        import sys
        from pathlib import Path
        from sunroom.db import instance_lock
        try:
            instance_lock.acquire(Path({str(lock)!r}))
        except instance_lock.InstanceLockError:
            sys.exit(3)
        sys.exit(0)
        """
    )
    result = subprocess.run([sys.executable, "-c", script], check=False)  # noqa: S603
    assert result.returncode == 3
