"""One row per registered plugin: on or off, and its settings (PLAN §6.4)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import UTCDateTime, utcnow


class PluginState(Base):
    __tablename__ = "plugin_state"

    plugin_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    # Spec-typed JSON, coerced against the plugin's ParamFields on every read and write. The one
    # place Sunroom stores a key-value blob: a plugin setting must not need a core migration.
    settings_json: Mapped[str] = mapped_column(Text, default="{}")
    settings_version: Mapped[int] = mapped_column(Integer, default=1)
    plugin_version: Mapped[str] = mapped_column(String(16), default="0.0.0")
    enabled_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    disabled_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
