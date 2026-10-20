"""app_meta: instance_id

Revision ID: 202610201813
Revises: 202610161644
Create Date: 2026-10-20 18:13:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610201813'
down_revision: str | Sequence[str] | None = '202610161644'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # This Sunroom's own id (ADR 0035): GET /api/discover hands it to screens, which find the same
    # Sunroom again when its address changes. Made here for the one app_meta row, so it travels
    # with every backup from now on; boot makes one too if a row ever lacks it.
    with op.batch_alter_table('app_meta', schema=None) as batch_op:
        batch_op.add_column(sa.Column('instance_id', sa.String(length=36), nullable=True))
    op.execute(
        sa.text("UPDATE app_meta SET instance_id = :id WHERE instance_id IS NULL").bindparams(
            id=str(uuid.uuid7())
        )
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
