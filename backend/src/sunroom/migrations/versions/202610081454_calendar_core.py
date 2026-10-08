"""calendar core: calendars, events, people, reminders, revisions

Revision ID: 202610081454
Revises: 202610071800
Create Date: 2026-10-08 14:54:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = '202610081454'
down_revision: str | Sequence[str] | None = '202610071800'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('event_revisions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('series_id', sa.String(length=36), nullable=False),
    sa.Column('action', sa.String(length=10), nullable=False),
    sa.Column('before_json', sa.Text(), nullable=False),
    sa.Column('created_ids_json', sa.Text(), nullable=False),
    sa.Column('device_id', sa.String(length=36), nullable=True),
    sa.Column('member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('undone_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_event_revisions'))
    )
    with op.batch_alter_table('event_revisions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_event_revisions_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_event_revisions_series_id'), ['series_id'], unique=False)

    op.create_table('calendars',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('color', sa.String(length=8), nullable=False),
    sa.Column('kind', sa.String(length=8), nullable=False),
    sa.Column('owner_member_id', sa.String(length=36), nullable=True),
    sa.Column('read_only', sa.Boolean(), nullable=False),
    sa.Column('visible_on_display', sa.Boolean(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('remote_ref', sa.String(length=500), nullable=True),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['owner_member_id'], ['members.id'], name=op.f('fk_calendars_owner_member_id_members')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_calendars'))
    )
    op.create_table('events',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('calendar_id', sa.String(length=36), nullable=False),
    sa.Column('parent_event_id', sa.String(length=36), nullable=True),
    sa.Column('recurrence_id', sa.String(length=19), nullable=True),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('location', sa.String(length=300), nullable=False),
    sa.Column('all_day', sa.Boolean(), nullable=False),
    sa.Column('start_utc', sa.DateTime(), nullable=True),
    sa.Column('end_utc', sa.DateTime(), nullable=True),
    sa.Column('tzid', sa.String(length=64), nullable=True),
    sa.Column('start_date', sa.String(length=10), nullable=True),
    sa.Column('end_date', sa.String(length=10), nullable=True),
    sa.Column('floating', sa.Boolean(), nullable=False),
    sa.Column('rrule', sa.String(length=500), nullable=True),
    sa.Column('rdates_json', sa.Text(), nullable=False),
    sa.Column('exdates_json', sa.Text(), nullable=False),
    sa.Column('window_start_utc', sa.DateTime(), nullable=False),
    sa.Column('window_end_utc', sa.DateTime(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('color', sa.String(length=8), nullable=True),
    sa.Column('source', sa.String(length=8), nullable=False),
    sa.Column('remote_uid', sa.String(length=500), nullable=True),
    sa.Column('remote_id', sa.String(length=500), nullable=True),
    sa.Column('etag', sa.String(length=200), nullable=True),
    sa.Column('remote_updated_at', sa.DateTime(), nullable=True),
    sa.Column('remote_sequence', sa.Integer(), nullable=True),
    sa.Column('pending_push', sa.Boolean(), nullable=False),
    sa.Column('pending_delete', sa.Boolean(), nullable=False),
    sa.Column('raw_ical', sa.Text(), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('created_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.CheckConstraint('(all_day = 0 AND start_utc IS NOT NULL AND end_utc IS NOT NULL AND tzid IS NOT NULL AND start_date IS NULL AND end_date IS NULL) OR (all_day = 1 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_utc IS NULL AND end_utc IS NULL)', name=op.f('ck_events_one_timing')),
    sa.CheckConstraint('recurrence_id IS NULL OR parent_event_id IS NOT NULL', name=op.f('ck_events_override_has_parent')),
    sa.ForeignKeyConstraint(['calendar_id'], ['calendars.id'], name=op.f('fk_events_calendar_id_calendars')),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['members.id'], name=op.f('fk_events_created_by_member_id_members')),
    sa.ForeignKeyConstraint(['parent_event_id'], ['events.id'], name=op.f('fk_events_parent_event_id_events')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_events')),
    sa.UniqueConstraint('calendar_id', 'remote_uid', 'recurrence_id', name=op.f('uq_events_calendar_id'))
    )
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_events_parent_event_id'), ['parent_event_id'], unique=False)
        batch_op.create_index('ix_events_range', ['calendar_id', 'window_start_utc', 'window_end_utc'], unique=False)

    op.create_table('event_members',
    sa.Column('event_id', sa.String(length=36), nullable=False),
    sa.Column('member_id', sa.String(length=36), nullable=False),
    sa.ForeignKeyConstraint(['event_id'], ['events.id'], name=op.f('fk_event_members_event_id_events'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_event_members_member_id_members')),
    sa.PrimaryKeyConstraint('event_id', 'member_id', name=op.f('pk_event_members'))
    )
    op.create_table('event_reminders',
    sa.Column('event_id', sa.String(length=36), nullable=False),
    sa.Column('minutes_before', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['event_id'], ['events.id'], name=op.f('fk_event_reminders_event_id_events'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('event_id', 'minutes_before', name=op.f('pk_event_reminders'))
    )
    with op.batch_alter_table('household', schema=None) as batch_op:
        batch_op.add_column(sa.Column('default_calendar_id', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(batch_op.f('fk_household_default_calendar_id_calendars'), 'calendars', ['default_calendar_id'], ['id'])

    # Every household starts with its own calendar, Home, where quick add puts events.
    home = str(uuid.uuid7())
    now = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")
    op.get_bind().execute(
        sa.text(
            "INSERT INTO calendars (id, name, color, kind, owner_member_id, read_only, "
            "visible_on_display, version, remote_ref, sort, created_at, updated_at, deleted_at) "
            "VALUES (:id, 'Home', 'sky', 'local', NULL, 0, 1, 1, NULL, 0, :now, :now, NULL)"
        ),
        {"id": home, "now": now},
    )
    op.get_bind().execute(
        sa.text("UPDATE household SET default_calendar_id = :id WHERE id = 1"), {"id": home}
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
