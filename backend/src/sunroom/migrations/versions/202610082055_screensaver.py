"""screensaver: photo sources

Revision ID: 202610082055
Revises: 202610082054
Create Date: 2026-10-08 20:55:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610082055'
down_revision: str | Sequence[str] | None = '202610082054'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('photo_sources',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('kind', sa.String(length=12), nullable=False),
    sa.Column('label', sa.String(length=80), nullable=False),
    sa.Column('config_json', sa.Text(), nullable=False),
    sa.Column('credentials_enc', sa.Text(), nullable=True),
    sa.Column('allow_private', sa.Boolean(), nullable=False),
    sa.Column('enabled', sa.Boolean(), nullable=False),
    sa.Column('last_scan_at', sa.DateTime(), nullable=True),
    sa.Column('last_error', sa.String(length=300), nullable=True),
    sa.Column('items_seen', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_photo_sources'))
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
