"""household: backup policy

Revision ID: 202610161644
Revises: 202610161546
Create Date: 2026-10-16 16:44:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610161644'
down_revision: str | Sequence[str] | None = '202610161546'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Settings → Backup (ADR 0034): a household keeps what it had, a nightly copy with 14 daily
    # and 8 weekly kept, until it changes them.
    with op.batch_alter_table('household', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('backups_enabled', sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch_op.add_column(
            sa.Column('backups_keep_daily', sa.Integer(), nullable=False, server_default='14')
        )
        batch_op.add_column(
            sa.Column('backups_keep_weekly', sa.Integer(), nullable=False, server_default='8')
        )


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
