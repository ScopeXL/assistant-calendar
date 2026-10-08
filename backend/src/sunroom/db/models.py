"""Imports every model so Base.metadata is complete (Alembic, export and tests rely on it).

Add each new feature's models module here, plugins' included (PLAN §5.3): a plugin's tables
exist whether or not it is enabled (PLAN §6.4).
"""

from __future__ import annotations

from sunroom.auth import models as auth_models
from sunroom.calendar import models as calendar_models
from sunroom.db.base import Base
from sunroom.household import models as household_models
from sunroom.photos import models as photos_models
from sunroom.plugins import models as plugins_models
from sunroom.plugins.calendar_sync import models as calendar_sync_models
from sunroom.plugins.chores import models as chores_models
from sunroom.plugins.lists import models as lists_models

__all__ = [
    "Base",
    "auth_models",
    "calendar_models",
    "calendar_sync_models",
    "chores_models",
    "household_models",
    "lists_models",
    "photos_models",
    "plugins_models",
]
