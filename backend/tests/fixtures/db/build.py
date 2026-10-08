"""Build a synthetic fixture database for a released migration revision (CLAUDE.md rule 3).

Every release adds `tests/fixtures/db/<revision>.sql`: the schema at that release plus a few
synthetic rows in every table. `tests/test_migrations.py` replays each file and migrates it to
head, so a new migration can't break a real household's data.

    cd backend && uv run python -m tests.fixtures.db.build 202610071800

Only synthetic values: "Sample Family", "Sample Parent", made-up ids and hashes.
Seeds never change once their file is committed; a new release adds a new entry.
"""

# Only this file's own constant ids are interpolated into the seed SQL.
# ruff: noqa: S608

from __future__ import annotations

import sqlite3
import sys
import tempfile
from collections.abc import Callable
from pathlib import Path

from alembic import command

from sunroom.db import migrate

HERE = Path(__file__).parent

# A statement, or a statement with `?` parameters.
Statement = str | tuple[str, tuple[object, ...]]

PARENT = "00000000-0000-7000-8000-000000000001"  # Sample Parent
KID = "00000000-0000-7000-8000-000000000002"  # Sample Kid
GUEST = "00000000-0000-7000-8000-000000000003"  # Sample Guest, removed
PHONE = "00000000-0000-7000-8000-0000000000d1"
SCREEN = "00000000-0000-7000-8000-0000000000d2"
AVATAR = "00000000-0000-7000-8000-000000000201"


def _v0_1_0() -> list[Statement]:
    """0.1.0: a set-up household with two people and a removed one, a phone and a paired
    screen, an expired code, an avatar, an allowlist entry and a plugin row."""
    return [
        "UPDATE household SET name = 'Sample Family', timezone = 'America/New_York', "
        "week_starts_on = 6, onboarded_at = '2026-10-07 12:00:00', "
        "updated_at = '2026-10-07 12:00:00' WHERE id = 1",
        "UPDATE app_meta SET password_hash = 'scrypt$sample$sample', last_boot_version = '0.1.0' "
        "WHERE id = 1",
        "INSERT INTO photos (id, kind, source_key, original_name, taken_at, width, height, bytes, "
        "sha256, created_at, hidden, deleted_at) VALUES "
        f"('{AVATAR}', 'avatar', 'upload', 'sample.jpg', NULL, 512, 512, 2048, "
        f"'{'0' * 63}1', '2026-10-07 12:05:00', 0, NULL)",
        "INSERT INTO members (id, name, role, color, avatar_photo_id, birthday, sort, "
        "created_at, archived_at) VALUES "
        f"('{PARENT}', 'Sample Parent', 'parent', 'sky', '{AVATAR}', NULL, 0, "
        "'2026-10-07 12:01:00', NULL), "
        f"('{KID}', 'Sample Kid', 'kid', 'berry', NULL, '2018-05-04', 1, "
        "'2026-10-07 12:02:00', NULL), "
        f"('{GUEST}', 'Sample Guest', 'parent', 'moss', NULL, NULL, 2, "
        "'2026-10-07 12:03:00', '2026-10-07 13:00:00')",
        "INSERT INTO devices (id, label, kind, member_id, is_kid_device, paired_via, created_at, "
        "last_seen_at, revoked_at) VALUES "
        f"('{PHONE}', 'iPhone, Safari', 'phone', '{PARENT}', 0, 'password', "
        "'2026-10-07 12:00:00', '2026-10-07 12:30:00', NULL), "
        f"('{SCREEN}', 'Kitchen screen', 'kiosk', NULL, 0, 'kiosk_code', "
        "'2026-10-07 12:10:00', '2026-10-07 12:40:00', NULL)",
        "INSERT INTO join_codes (code_hash, kind, created_by_device_id, poll_token_hash, "
        "created_at, expires_at, used_at, used_by_device_id) VALUES "
        f"('{'0' * 63}2', 'kiosk', NULL, '{'0' * 63}3', '2026-10-07 12:09:00', "
        f"'2026-10-07 12:19:00', '2026-10-07 12:10:00', '{SCREEN}')",
        "INSERT INTO network_allowlist (id, target, label, created_by_member_id, created_at) "
        "VALUES ('00000000-0000-7000-8000-000000000301', '192.168.1.20/32', 'Sample NAS', "
        f"'{PARENT}', '2026-10-07 12:20:00')",
        "INSERT INTO plugin_state (plugin_id, enabled, settings_json, settings_version, "
        "plugin_version, enabled_at, disabled_at, updated_at) VALUES "
        "('sample', 0, '{}', 1, '1.0.0', NULL, NULL, '2026-10-07 12:00:00')",
    ]


# Synthetic rows to insert, per released revision (the tables that exist at that revision).
SEEDS: dict[str, Callable[[], list[Statement]]] = {
    "202610071800": _v0_1_0,
}


def build(revision: str) -> Path:
    if revision not in SEEDS:
        raise SystemExit(f"add synthetic rows for {revision} to SEEDS first")
    out = HERE / f"{revision}.sql"
    with tempfile.TemporaryDirectory() as tmp:
        db = Path(tmp) / "sunroom.db"
        engine = migrate.migration_engine(db)
        try:
            with engine.connect() as conn, conn.begin():
                config = migrate.alembic_config()
                config.attributes["connection"] = conn
                command.upgrade(config, revision)
                for statement in SEEDS[revision]():
                    if isinstance(statement, str):
                        conn.exec_driver_sql(statement)
                    else:
                        conn.exec_driver_sql(*statement)
        finally:
            engine.dispose()
        conn = sqlite3.connect(db)
        try:
            dump = "\n".join(conn.iterdump()) + "\n"
        finally:
            conn.close()
    out.write_text(dump)
    return out


if __name__ == "__main__":
    for name in sys.argv[1:]:
        print(f"wrote {build(name).relative_to(Path.cwd())}")
