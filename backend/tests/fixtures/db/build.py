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


KIDS = "00000000-0000-7000-8000-000000000401"  # the "Kids' activities" calendar
SOCCER = "00000000-0000-7000-8000-000000000501"  # weekly, with one moved occurrence
SOCCER_MOVED = "00000000-0000-7000-8000-000000000502"
PAJAMAS = "00000000-0000-7000-8000-000000000503"  # all-day
VET = "00000000-0000-7000-8000-000000000504"  # removed, in Recently removed
SCHOOL = "00000000-0000-7000-8000-000000000402"  # a synced calendar, from a calendar address
FIELD_TRIP = "00000000-0000-7000-8000-000000000505"  # a synced event in it
FEED = "00000000-0000-7000-8000-000000000701"  # the calendar address's account
FEED_CALENDAR = "00000000-0000-7000-8000-000000000702"  # the account's one calendar


def _v0_2_0() -> list[Statement]:
    """0.2.0: 0.1.0's household plus a second calendar, a weekly event with a moved
    occurrence, people and a reminder, an all-day event, a removed event and its revision."""
    timed = (
        "INSERT INTO events (id, calendar_id, parent_event_id, recurrence_id, title, description,"
        " location, all_day, start_utc, end_utc, tzid, start_date, end_date, floating, rrule,"
        " rdates_json, exdates_json, window_start_utc, window_end_utc, status, color, source,"
        " remote_uid, remote_id, etag, remote_updated_at, remote_sequence, pending_push,"
        " pending_delete, raw_ical, version, created_by_member_id, created_at, updated_at,"
        " deleted_at) VALUES "
    )
    return [
        *_v0_1_0(),
        "INSERT INTO calendars (id, name, color, kind, owner_member_id, read_only,"
        " visible_on_display, version, remote_ref, sort, created_at, updated_at, deleted_at)"
        f" VALUES ('{KIDS}', 'Kids'' activities', 'iris', 'local', '{KID}', 0, 1, 3, NULL, 1,"
        " '2026-10-08 12:00:00', '2026-10-08 12:00:00', NULL)",
        timed + f"('{SOCCER}', '{KIDS}', NULL, NULL, 'Soccer practice', '', 'Field 3', 0,"
        " '2026-09-29 20:00:00', '2026-09-29 21:00:00', 'America/New_York', NULL, NULL, 0,"
        " 'FREQ=WEEKLY;BYDAY=TU,TH', '[]', '[\"2026-10-13T16:00:00\"]',"
        " '2026-09-29 20:00:00', '9999-12-31 00:00:00', 'confirmed', NULL, 'local', NULL, NULL,"
        f" NULL, NULL, NULL, 0, 0, NULL, 2, '{PARENT}', '2026-10-08 12:01:00',"
        " '2026-10-08 12:05:00', NULL)",
        timed
        + f"('{SOCCER_MOVED}', '{KIDS}', '{SOCCER}', '2026-10-08T16:00:00', 'Soccer practice',"
        " '', 'Field 3', 0, '2026-10-08 21:00:00', '2026-10-08 22:00:00', 'America/New_York',"
        " NULL, NULL, 0, NULL, '[]', '[]', '2026-10-08 21:00:00', '2026-10-08 22:00:00',"
        " 'confirmed', NULL, 'local', NULL, NULL, NULL, NULL, NULL, 0, 0, NULL, 1,"
        f" '{PARENT}', '2026-10-08 12:05:00', '2026-10-08 12:05:00', NULL)",
        timed + f"('{PAJAMAS}', '{KIDS}', NULL, NULL, 'Pajama day', '', '', 1, NULL, NULL, NULL,"
        " '2026-10-09', '2026-10-10', 0, NULL, '[]', '[]', '2026-10-09 00:00:00',"
        " '2026-10-11 00:00:00', 'confirmed', 'rose', 'local', NULL, NULL, NULL, NULL, NULL, 0,"
        f" 0, NULL, 1, '{PARENT}', '2026-10-08 12:02:00', '2026-10-08 12:02:00', NULL)",
        timed + f"('{VET}', '{KIDS}', NULL, NULL, 'Vet', '', '', 0, '2026-10-07 13:00:00',"
        " '2026-10-07 13:30:00', 'America/New_York', NULL, NULL, 0, NULL, '[]', '[]',"
        " '2026-10-07 13:00:00', '2026-10-07 13:30:00', 'confirmed', NULL, 'local', NULL, NULL,"
        f" NULL, NULL, NULL, 0, 0, NULL, 2, '{PARENT}', '2026-10-08 12:03:00',"
        " '2026-10-08 12:04:00', '2026-10-08 12:04:00')",
        "INSERT INTO event_members (event_id, member_id) VALUES "
        f"('{SOCCER}', '{KID}'), ('{SOCCER_MOVED}', '{KID}'), ('{VET}', '{PARENT}')",
        f"INSERT INTO event_reminders (event_id, minutes_before) VALUES ('{SOCCER}', 30)",
        "INSERT INTO event_revisions (id, series_id, action, before_json, created_ids_json,"
        " device_id, member_id, created_at, undone_at) VALUES"
        f" ('00000000-0000-7000-8000-000000000601', '{VET}', 'delete', '[]', '[]',"
        f" '{PHONE}', '{PARENT}', '2026-10-08 12:04:00', NULL)",
    ]


def _v0_3_0() -> list[Statement]:
    """0.3.0: 0.2.0's household plus a calendar address mapped to the kid (a synced calendar
    holding one synced event), the account's last sync run, and a sign-in nobody finished."""
    return [
        *_v0_2_0(),
        "INSERT INTO calendars (id, name, color, kind, owner_member_id, read_only,"
        " visible_on_display, version, remote_ref, sort, created_at, updated_at, deleted_at)"
        f" VALUES ('{SCHOOL}', 'School', 'olive', 'sync', '{KID}', 1, 1, 1,"
        " 'a calendar address', 1000, '2026-10-08 18:00:00', '2026-10-08 18:00:00', NULL)",
        "INSERT INTO events (id, calendar_id, parent_event_id, recurrence_id, title, description,"
        " location, all_day, start_utc, end_utc, tzid, start_date, end_date, floating, rrule,"
        " rdates_json, exdates_json, window_start_utc, window_end_utc, status, color, source,"
        " remote_uid, remote_id, etag, remote_updated_at, remote_sequence, pending_push,"
        " pending_delete, raw_ical, version, created_by_member_id, created_at, updated_at,"
        f" deleted_at) VALUES ('{FIELD_TRIP}', '{SCHOOL}', NULL, NULL, 'Field trip', '',"
        " 'Sample Farm', 0, '2026-10-15 13:00:00', '2026-10-15 17:00:00', 'America/New_York',"
        " NULL, NULL, 0, NULL, '[]', '[]', '2026-10-15 13:00:00', '2026-10-15 17:00:00',"
        " 'confirmed', NULL, 'sync', 'field-trip@school.example.com', NULL, NULL,"
        " '2026-10-08 17:00:00', 0, 0, 0, NULL, 1, NULL, '2026-10-08 18:00:00',"
        " '2026-10-08 18:00:00', NULL)",
        "INSERT INTO sync_accounts (id, provider, auth_mode, label, status, server_url, username,"
        " credentials_enc, config_json, allow_private, owner_member_id, interval_s, last_sync_at,"
        " last_success_at, next_sync_at, last_error, last_error_at, consecutive_failures,"
        " version, created_by_member_id, created_at, deleted_at) VALUES"
        f" ('{FEED}', 'ics', 'none', 'School', 'connected', 'school.example.com/school.ics',"
        f" NULL, 'sample-ciphertext', '{{}}', 0, '{KID}', 1800, '2026-10-08 18:30:00',"
        " '2026-10-08 18:30:00', '2026-10-08 19:00:00', NULL, NULL, 0, 1,"
        f" '{PARENT}', '2026-10-08 18:00:00', NULL)",
        "INSERT INTO remote_calendars (id, account_id, remote_id, name, color_hint, read_only,"
        " mapped, calendar_id, sync_token, ctag, last_synced_at, last_error, created_at) VALUES"
        f" ('{FEED_CALENDAR}', '{FEED}', 'feed-000000000000000000000001', 'School', NULL, 1, 1,"
        f" '{SCHOOL}', '{{\"etag\": \"\\\"1\\\"\"}}', NULL, '2026-10-08 18:30:00', NULL,"
        " '2026-10-08 18:00:00')",
        "INSERT INTO sync_runs (id, account_id, started_at, finished_at, outcome, fetched,"
        " created, updated, deleted, pushed, error, duration_ms) VALUES"
        f" ('00000000-0000-7000-8000-000000000801', '{FEED}', '2026-10-08 18:30:00',"
        " '2026-10-08 18:30:01', 'ok', 1, 0, 0, 0, 0, NULL, 140)",
        "INSERT INTO oauth_states (state_hash, provider, code_verifier, device_id, account_id,"
        f" created_at, expires_at, used_at) VALUES ('{'0' * 63}4', 'google', 'sample-verifier',"
        f" '{PHONE}', NULL, '2026-10-08 18:40:00', '2026-10-08 18:50:00', NULL)",
        "INSERT INTO plugin_state (plugin_id, enabled, settings_json, settings_version, "
        "plugin_version, enabled_at, disabled_at, updated_at) VALUES "
        "('calendar_sync', 1, '{\"google_client_id\": null, \"google_client_secret\": null}',"
        " 1, '1.0.0', '2026-10-08 18:00:00', NULL, '2026-10-08 18:00:00')",
    ]


# Synthetic rows to insert, per released revision (the tables that exist at that revision).
SEEDS: dict[str, Callable[[], list[Statement]]] = {
    "202610071800": _v0_1_0,
    "202610081454": _v0_2_0,
    "202610081650": _v0_3_0,
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
