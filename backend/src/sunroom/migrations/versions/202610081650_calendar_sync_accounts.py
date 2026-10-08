"""calendar_sync: accounts, their calendars, sync runs, sign-in states

Revision ID: 202610081650
Revises: 202610081454
Create Date: 2026-10-08 16:50:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610081650'
down_revision: str | Sequence[str] | None = '202610081454'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('oauth_states',
    sa.Column('state_hash', sa.String(length=64), nullable=False),
    sa.Column('provider', sa.String(length=16), nullable=False),
    sa.Column('code_verifier', sa.String(length=128), nullable=False),
    sa.Column('device_id', sa.String(length=36), nullable=True),
    sa.Column('account_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('used_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('state_hash', name=op.f('pk_oauth_states'))
    )
    op.create_table('sync_accounts',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('provider', sa.String(length=16), nullable=False),
    sa.Column('auth_mode', sa.String(length=16), nullable=False),
    sa.Column('label', sa.String(length=120), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('server_url', sa.String(length=500), nullable=True),
    sa.Column('username', sa.String(length=200), nullable=True),
    sa.Column('credentials_enc', sa.Text(), nullable=True),
    sa.Column('config_json', sa.Text(), nullable=False),
    sa.Column('allow_private', sa.Boolean(), nullable=False),
    sa.Column('owner_member_id', sa.String(length=36), nullable=True),
    sa.Column('interval_s', sa.Integer(), nullable=False),
    sa.Column('last_sync_at', sa.DateTime(), nullable=True),
    sa.Column('last_success_at', sa.DateTime(), nullable=True),
    sa.Column('next_sync_at', sa.DateTime(), nullable=True),
    sa.Column('last_error', sa.String(length=300), nullable=True),
    sa.Column('last_error_at', sa.DateTime(), nullable=True),
    sa.Column('consecutive_failures', sa.Integer(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('created_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['members.id'], name=op.f('fk_sync_accounts_created_by_member_id_members')),
    sa.ForeignKeyConstraint(['owner_member_id'], ['members.id'], name=op.f('fk_sync_accounts_owner_member_id_members')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_sync_accounts'))
    )
    op.create_table('remote_calendars',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('account_id', sa.String(length=36), nullable=False),
    sa.Column('remote_id', sa.String(length=500), nullable=False),
    sa.Column('name', sa.String(length=200), nullable=False),
    sa.Column('color_hint', sa.String(length=9), nullable=True),
    sa.Column('read_only', sa.Boolean(), nullable=False),
    sa.Column('mapped', sa.Boolean(), nullable=False),
    sa.Column('calendar_id', sa.String(length=36), nullable=True),
    sa.Column('sync_token', sa.Text(), nullable=True),
    sa.Column('ctag', sa.String(length=200), nullable=True),
    sa.Column('last_synced_at', sa.DateTime(), nullable=True),
    sa.Column('last_error', sa.String(length=300), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['sync_accounts.id'], name=op.f('fk_remote_calendars_account_id_sync_accounts')),
    sa.ForeignKeyConstraint(['calendar_id'], ['calendars.id'], name=op.f('fk_remote_calendars_calendar_id_calendars')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_remote_calendars')),
    sa.UniqueConstraint('account_id', 'remote_id', name=op.f('uq_remote_calendars_account_id'))
    )
    with op.batch_alter_table('remote_calendars', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_remote_calendars_account_id'), ['account_id'], unique=False)

    op.create_table('sync_runs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('account_id', sa.String(length=36), nullable=False),
    sa.Column('started_at', sa.DateTime(), nullable=False),
    sa.Column('finished_at', sa.DateTime(), nullable=True),
    sa.Column('outcome', sa.String(length=16), nullable=False),
    sa.Column('fetched', sa.Integer(), nullable=False),
    sa.Column('created', sa.Integer(), nullable=False),
    sa.Column('updated', sa.Integer(), nullable=False),
    sa.Column('deleted', sa.Integer(), nullable=False),
    sa.Column('pushed', sa.Integer(), nullable=False),
    sa.Column('error', sa.String(length=300), nullable=True),
    sa.Column('duration_ms', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['account_id'], ['sync_accounts.id'], name=op.f('fk_sync_runs_account_id_sync_accounts')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_sync_runs'))
    )
    with op.batch_alter_table('sync_runs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_sync_runs_account_id'), ['account_id'], unique=False)



def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
