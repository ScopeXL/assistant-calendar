"""meals: meal entries and saved meals

Revision ID: 202610082053
Revises: 202610081921
Create Date: 2026-10-08 20:53:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610082053'
down_revision: str | Sequence[str] | None = '202610081921'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('saved_meals',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('text', sa.String(length=120), nullable=False),
    sa.Column('emoji', sa.String(length=16), nullable=True),
    sa.Column('recipe_url', sa.String(length=500), nullable=True),
    sa.Column('ingredients_json', sa.Text(), nullable=False),
    sa.Column('use_count', sa.Integer(), nullable=False),
    sa.Column('last_used_at', sa.DateTime(), nullable=True),
    sa.Column('created_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['members.id'], name=op.f('fk_saved_meals_created_by_member_id_members')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_saved_meals'))
    )
    op.create_table('meal_entries',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('day', sa.String(length=10), nullable=False),
    sa.Column('slot', sa.String(length=16), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('text', sa.String(length=120), nullable=False),
    sa.Column('emoji', sa.String(length=16), nullable=True),
    sa.Column('recipe_url', sa.String(length=500), nullable=True),
    sa.Column('note', sa.String(length=300), nullable=True),
    sa.Column('member_id', sa.String(length=36), nullable=True),
    sa.Column('saved_meal_id', sa.String(length=36), nullable=True),
    sa.Column('source_url', sa.String(length=500), nullable=True),
    sa.Column('created_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['members.id'], name=op.f('fk_meal_entries_created_by_member_id_members')),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_meal_entries_member_id_members')),
    sa.ForeignKeyConstraint(['saved_meal_id'], ['saved_meals.id'], name=op.f('fk_meal_entries_saved_meal_id_saved_meals')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_meal_entries'))
    )
    with op.batch_alter_table('meal_entries', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_meal_entries_day'), ['day'], unique=False)
        batch_op.create_index('uq_meal_entries_spot', ['day', 'slot', 'position'], unique=True, sqlite_where=sa.text('deleted_at IS NULL'))


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
