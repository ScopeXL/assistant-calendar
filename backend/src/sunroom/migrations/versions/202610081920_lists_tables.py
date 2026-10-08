"""lists: lists and their items

Revision ID: 202610081920
Revises: 202610081650
Create Date: 2026-10-08 19:20:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610081920'
down_revision: str | Sequence[str] | None = '202610081650'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('lists',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('icon', sa.String(length=32), nullable=True),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.Column('created_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['members.id'], name=op.f('fk_lists_created_by_member_id_members')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_lists'))
    )
    op.create_table('list_items',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('list_id', sa.String(length=36), nullable=False),
    sa.Column('text', sa.String(length=200), nullable=False),
    sa.Column('note', sa.String(length=500), nullable=True),
    sa.Column('quantity', sa.String(length=20), nullable=True),
    sa.Column('due_date', sa.String(length=10), nullable=True),
    sa.Column('assigned_member_id', sa.String(length=36), nullable=True),
    sa.Column('checked_at', sa.DateTime(), nullable=True),
    sa.Column('checked_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('created_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('cleared_at', sa.DateTime(), nullable=True),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['assigned_member_id'], ['members.id'], name=op.f('fk_list_items_assigned_member_id_members')),
    sa.ForeignKeyConstraint(['checked_by_member_id'], ['members.id'], name=op.f('fk_list_items_checked_by_member_id_members')),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['members.id'], name=op.f('fk_list_items_created_by_member_id_members')),
    sa.ForeignKeyConstraint(['list_id'], ['lists.id'], name=op.f('fk_list_items_list_id_lists')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_list_items'))
    )
    with op.batch_alter_table('list_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_list_items_due_date'), ['due_date'], unique=False)
        batch_op.create_index(batch_op.f('ix_list_items_list_id'), ['list_id'], unique=False)



def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
