"""household: default reminder; events: reminders off

Revision ID: 202610161546
Revises: 202610161525
Create Date: 2026-10-16 15:46:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610161546'
down_revision: str | Sequence[str] | None = '202610161525'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Three states for an event's reminders (ADR 0034): its own rows, explicitly none
    # (reminders_off), or the household's Default reminder, which starts as none.
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('reminders_off', sa.Boolean(), nullable=False, server_default=sa.false())
        )
    with op.batch_alter_table('household', schema=None) as batch_op:
        batch_op.add_column(sa.Column('default_reminder_minutes', sa.Integer(), nullable=True))


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
