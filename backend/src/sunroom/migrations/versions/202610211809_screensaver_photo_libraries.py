"""screensaver: photo libraries

Revision ID: 202610211809
Revises: 202610201813
Create Date: 2026-10-21 18:09:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610211809'
down_revision: str | Sequence[str] | None = '202610201813'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Photo libraries (ADR 0036, Immich first): a source's state (its key refused or wiped
    # by a new secret key: needs_reconnect), the people, albums and tags it offers, cached,
    # and which of its photos the picks want, with core's copy of each. The inbox stays
    # connected; nothing else changes for it.
    op.create_table('photo_source_items',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('source_id', sa.String(length=36), nullable=False),
    sa.Column('remote_id', sa.String(length=100), nullable=False),
    sa.Column('photo_id', sa.String(length=36), nullable=True),
    sa.Column('taken_at', sa.DateTime(), nullable=True),
    sa.Column('seen_at', sa.DateTime(), nullable=False),
    sa.Column('fetched_at', sa.DateTime(), nullable=True),
    sa.Column('dropped_at', sa.DateTime(), nullable=True),
    sa.Column('fetch_failures', sa.Integer(), server_default='0', nullable=False),
    sa.ForeignKeyConstraint(['source_id'], ['photo_sources.id'], name=op.f('fk_photo_source_items_source_id_photo_sources')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_photo_source_items')),
    sa.UniqueConstraint('source_id', 'remote_id', name=op.f('uq_photo_source_items_source_id'))
    )
    with op.batch_alter_table('photo_source_items', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_photo_source_items_source_id'), ['source_id'], unique=False)

    with op.batch_alter_table('photo_sources', schema=None) as batch_op:
        batch_op.add_column(sa.Column('status', sa.String(length=20), server_default='connected', nullable=False))
        batch_op.add_column(sa.Column('options_json', sa.Text(), server_default='{}', nullable=False))
        batch_op.add_column(sa.Column('options_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
