"""household: the evening dim and the update check

Revision ID: 202610082231
Revises: 202610082056
Create Date: 2026-10-08 22:31:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610082231'
down_revision: str | Sequence[str] | None = '202610082056'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('household', schema=None) as batch_op:
        batch_op.add_column(sa.Column('dim_from', sa.String(length=5), nullable=True))
        batch_op.add_column(sa.Column('dim_level', sa.Integer(), nullable=False, server_default='40'))
        batch_op.add_column(sa.Column('update_check', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
