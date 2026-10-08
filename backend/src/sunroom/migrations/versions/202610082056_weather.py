"""weather: the forecast cache

Revision ID: 202610082056
Revises: 202610082055
Create Date: 2026-10-08 20:56:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610082056'
down_revision: str | Sequence[str] | None = '202610082055'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('weather_cache',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('latitude', sa.Float(), nullable=False),
    sa.Column('longitude', sa.Float(), nullable=False),
    sa.Column('units', sa.String(length=12), nullable=False),
    sa.Column('payload_json', sa.Text(), nullable=True),
    sa.Column('fetched_at', sa.DateTime(), nullable=True),
    sa.Column('expires_at', sa.DateTime(), nullable=True),
    sa.Column('last_error', sa.String(length=300), nullable=True),
    sa.Column('last_error_at', sa.DateTime(), nullable=True),
    sa.CheckConstraint('id = 1', name=op.f('ck_weather_cache_one_row')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_weather_cache'))
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
