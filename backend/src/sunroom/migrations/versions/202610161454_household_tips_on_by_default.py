"""household: tips on by default

Revision ID: 202610161454
Revises: 202610151730
Create Date: 2026-10-16 14:54:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610161454'
down_revision: str | Sequence[str] | None = '202610151730'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Tips are on by default from 0.12.0 (ADR 0034), and turned on once for every household, the
    # owner's wish; a household can turn them off again in Settings → Display → Show tips.
    with op.batch_alter_table('household', schema=None) as batch_op:
        batch_op.alter_column(
            'show_tips',
            existing_type=sa.Boolean(),
            existing_nullable=False,
            server_default=sa.true(),
        )
    op.execute("UPDATE household SET show_tips = 1")


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
