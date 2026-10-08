"""chores: chores, completions, stars, rewards and routines

Revision ID: 202610081921
Revises: 202610081920
Create Date: 2026-10-08 19:21:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610081921'
down_revision: str | Sequence[str] | None = '202610081920'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('rewards',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=80), nullable=False),
    sa.Column('cost_points', sa.Integer(), nullable=False),
    sa.Column('icon', sa.String(length=32), nullable=True),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_rewards'))
    )
    op.create_table('chores',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=80), nullable=False),
    sa.Column('description', sa.String(length=500), nullable=True),
    sa.Column('icon', sa.String(length=32), nullable=True),
    sa.Column('points', sa.Integer(), nullable=False),
    sa.Column('rrule', sa.String(length=500), nullable=True),
    sa.Column('start_date', sa.String(length=10), nullable=False),
    sa.Column('due_time', sa.String(length=5), nullable=True),
    sa.Column('assignee_mode', sa.String(length=8), nullable=False),
    sa.Column('assignee_member_ids_json', sa.Text(), nullable=False),
    sa.Column('rotation_index', sa.Integer(), nullable=False),
    sa.Column('requires_approval', sa.Boolean(), nullable=True),
    sa.Column('skipped_dates_json', sa.Text(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('created_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['members.id'], name=op.f('fk_chores_created_by_member_id_members')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_chores'))
    )
    op.create_table('point_adjustments',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('member_id', sa.String(length=36), nullable=False),
    sa.Column('points', sa.Integer(), nullable=False),
    sa.Column('reason', sa.String(length=120), nullable=False),
    sa.Column('by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['by_member_id'], ['members.id'], name=op.f('fk_point_adjustments_by_member_id_members')),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_point_adjustments_member_id_members')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_point_adjustments'))
    )
    with op.batch_alter_table('point_adjustments', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_point_adjustments_member_id'), ['member_id'], unique=False)

    op.create_table('redemptions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('reward_id', sa.String(length=36), nullable=False),
    sa.Column('member_id', sa.String(length=36), nullable=False),
    sa.Column('cost_points', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('requested_at', sa.DateTime(), nullable=False),
    sa.Column('decided_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('decided_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['decided_by_member_id'], ['members.id'], name=op.f('fk_redemptions_decided_by_member_id_members')),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_redemptions_member_id_members')),
    sa.ForeignKeyConstraint(['reward_id'], ['rewards.id'], name=op.f('fk_redemptions_reward_id_rewards')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_redemptions'))
    )
    with op.batch_alter_table('redemptions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_redemptions_member_id'), ['member_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_redemptions_reward_id'), ['reward_id'], unique=False)

    op.create_table('routines',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=80), nullable=False),
    sa.Column('member_id', sa.String(length=36), nullable=True),
    sa.Column('days_json', sa.Text(), nullable=False),
    sa.Column('window_start', sa.String(length=5), nullable=False),
    sa.Column('window_end', sa.String(length=5), nullable=False),
    sa.Column('icon', sa.String(length=32), nullable=True),
    sa.Column('points', sa.Integer(), nullable=False),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_routines_member_id_members')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_routines'))
    )
    op.create_table('chore_completions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('chore_id', sa.String(length=36), nullable=False),
    sa.Column('due_date', sa.String(length=10), nullable=False),
    sa.Column('member_id', sa.String(length=36), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=False),
    sa.Column('completed_by_device_id', sa.String(length=36), nullable=True),
    sa.Column('points_awarded', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('approved_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('approved_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['approved_by_member_id'], ['members.id'], name=op.f('fk_chore_completions_approved_by_member_id_members')),
    sa.ForeignKeyConstraint(['chore_id'], ['chores.id'], name=op.f('fk_chore_completions_chore_id_chores')),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_chore_completions_member_id_members')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_chore_completions')),
    sa.UniqueConstraint('chore_id', 'due_date', 'member_id', name=op.f('uq_chore_completions_chore_id'))
    )
    with op.batch_alter_table('chore_completions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_chore_completions_chore_id'), ['chore_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_chore_completions_due_date'), ['due_date'], unique=False)

    op.create_table('routine_finishes',
    sa.Column('routine_id', sa.String(length=36), nullable=False),
    sa.Column('member_id', sa.String(length=36), nullable=False),
    sa.Column('day', sa.String(length=10), nullable=False),
    sa.Column('finished_at', sa.DateTime(), nullable=False),
    sa.Column('points_awarded', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_routine_finishes_member_id_members')),
    sa.ForeignKeyConstraint(['routine_id'], ['routines.id'], name=op.f('fk_routine_finishes_routine_id_routines')),
    sa.PrimaryKeyConstraint('routine_id', 'member_id', 'day', name=op.f('pk_routine_finishes'))
    )
    op.create_table('routine_steps',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('routine_id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=80), nullable=False),
    sa.Column('icon', sa.String(length=32), nullable=True),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['routine_id'], ['routines.id'], name=op.f('fk_routine_steps_routine_id_routines')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_routine_steps'))
    )
    with op.batch_alter_table('routine_steps', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_routine_steps_routine_id'), ['routine_id'], unique=False)

    op.create_table('routine_checks',
    sa.Column('routine_step_id', sa.String(length=36), nullable=False),
    sa.Column('member_id', sa.String(length=36), nullable=False),
    sa.Column('day', sa.String(length=10), nullable=False),
    sa.Column('checked_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_routine_checks_member_id_members')),
    sa.ForeignKeyConstraint(['routine_step_id'], ['routine_steps.id'], name=op.f('fk_routine_checks_routine_step_id_routine_steps')),
    sa.PrimaryKeyConstraint('routine_step_id', 'member_id', 'day', name=op.f('pk_routine_checks'))
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
