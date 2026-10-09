"""household: the week layout and tips

Revision ID: 202610091752
Revises: 202610082231
Create Date: 2026-10-09 17:52:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610091752'
down_revision: str | Sequence[str] | None = '202610082231'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('household', schema=None) as batch_op:
        batch_op.add_column(sa.Column('display_week_layout', sa.String(length=8), nullable=False, server_default='agenda'))
        batch_op.add_column(sa.Column('show_tips', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
