"""Signed-in devices, and the one-time codes that pair a screen or add a phone (ADR 0006)."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from sunroom.db.base import Base
from sunroom.db.types import UTCDateTime, new_id, utcnow


class DeviceKind(StrEnum):
    PHONE = "phone"  # also laptops and tablets signed in by a person
    KIOSK = "kiosk"  # a paired wall display (the user sees "screen")


class PairedVia(StrEnum):
    PASSWORD = "password"  # noqa: S105 - a label, not a password
    CODE = "code"  # a code from a signed-in phone ("Add a phone")
    KIOSK_CODE = "kiosk_code"  # the display's own code, typed on a parent's phone
    SETUP = "setup"  # the device that ran the setup wizard


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    label: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(8), default=DeviceKind.PHONE)  # never changes
    # Phones: who's using it. Kiosks: always NULL (Everyone); a tap picks a person per action.
    member_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("members.id", ondelete="SET NULL"), default=None
    )
    is_kid_device: Mapped[bool] = mapped_column(Boolean, default=False)
    paired_via: Mapped[str] = mapped_column(String(12), default=PairedVia.PASSWORD)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)


class JoinCode(Base):
    """A six-character code, single use, for 10 minutes, stored as an HMAC (PLAN §10.1).

    ``kind = phone``: a signed-in device shows it so a new phone can sign in ("Add a phone").
    ``kind = kiosk``: the wall display shows it and a parent types it on their phone; the display
    holds a poll token (stored hashed) and long-polls until the code is claimed (auth/kiosk.py).
    """

    __tablename__ = "join_codes"

    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(8), default=DeviceKind.PHONE)
    created_by_device_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="CASCADE"), default=None, index=True
    )
    poll_token_hash: Mapped[str | None] = mapped_column(String(64), default=None, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime(), index=True)
    used_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), default=None)
    used_by_device_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="SET NULL"), default=None
    )
