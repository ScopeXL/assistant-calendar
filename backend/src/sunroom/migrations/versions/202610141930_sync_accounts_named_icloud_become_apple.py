"""sync: accounts named iCloud become Apple

Revision ID: 202610141930
Revises: 202610131907
Create Date: 2026-10-14 19:30:00 UTC

Forward-only: never edit this file once it is listed in released.lock.

The family reads "Apple" everywhere since 0.10.0 (ADR 0032), and an account connected before
then was named "iCloud · ana@…" as it connected. Only that name changes: the word at the start
of a CalDAV account's label, alone or before " · ". A label someone typed themselves keeps
anything else it says.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610141930'
down_revision: str | Sequence[str] | None = '202610131907'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE sync_accounts SET label = 'Apple' || substr(label, 7) "
            "WHERE provider = 'caldav' AND (label = 'iCloud' OR label LIKE 'iCloud · %')"
        )
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
