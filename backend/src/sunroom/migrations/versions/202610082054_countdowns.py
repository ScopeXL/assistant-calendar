"""countdowns: the countdowns table

Revision ID: 202610082054
Revises: 202610082053
Create Date: 2026-10-08 20:54:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610082054'
down_revision: str | Sequence[str] | None = '202610082053'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('countdowns',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=80), nullable=False),
    sa.Column('emoji', sa.String(length=16), nullable=True),
    sa.Column('color', sa.String(length=8), nullable=True),
    sa.Column('date', sa.String(length=10), nullable=False),
    sa.Column('time', sa.String(length=5), nullable=True),
    sa.Column('repeat_yearly', sa.Boolean(), nullable=False),
    sa.Column('member_id', sa.String(length=36), nullable=True),
    sa.Column('show_on_display', sa.Boolean(), nullable=False),
    sa.Column('created_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['members.id'], name=op.f('fk_countdowns_created_by_member_id_members')),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_countdowns_member_id_members')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_countdowns'))
    )
    with op.batch_alter_table('countdowns', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_countdowns_date'), ['date'], unique=False)


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
