"""household: display start

Revision ID: 202610131907
Revises: 202610121749
Create Date: 2026-10-13 19:07:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610131907'
down_revision: str | Sequence[str] | None = '202610121749'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('household', schema=None) as batch_op:
        batch_op.add_column(sa.Column('display_start', sa.String(length=8), nullable=False, server_default='last'))


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
