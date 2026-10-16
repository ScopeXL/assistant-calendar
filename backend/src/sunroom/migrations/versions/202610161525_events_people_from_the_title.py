"""events: people from the title

Revision ID: 202610161525
Revises: 202610161454
Create Date: 2026-10-16 15:25:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610161525'
down_revision: str | Sequence[str] | None = '202610161454'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # True while the title decides who an event is for (ADR 0034). A synced event with nobody on
    # it was never a hand choice (its calendar's owner was shown anyway), so the title may decide
    # for it from now on; everything else stays as it was until someone changes it.
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'people_from_title', sa.Boolean(), nullable=False, server_default=sa.false()
            )
        )
    op.execute(
        "UPDATE events SET people_from_title = 1"
        " WHERE source = 'sync' AND id NOT IN (SELECT event_id FROM event_members)"
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
