"""household: rolling week

Revision ID: 202610151730
Revises: 202610141930
Create Date: 2026-10-15 17:30:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610151730'
down_revision: str | Sequence[str] | None = '202610141930'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('household', schema=None) as batch_op:
        batch_op.add_column(sa.Column('display_rolling_week', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
