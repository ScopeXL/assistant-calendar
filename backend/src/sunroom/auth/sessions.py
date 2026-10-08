"""Per-device session cookies and the parent grant (PLAN §12.2, §12.3, §13.4).

Session cookie: ``v1.<device_id>.<epoch>.<issued_day>.<mac>``, 400 days (Chrome's cap), re-issued
on any request after 30 days, so a display that's always on never ages out. It is valid only when
the MAC verifies, the device exists and isn't revoked, and the epoch matches
``app_meta.auth_epoch`` (bumped by a password or secret-key change, or "sign out everywhere").

Parent grant: ``v1.<device_id>.<expires_unix>.<pin_epoch>.<mac>``, 10 minutes from a correct PIN,
not sliding. ``pin_epoch`` is derived from the stored PIN hash (salted afresh each time), so
setting or removing the PIN ends every grant.

The cookie's name follows the request's scheme: ``sunroom`` over plain HTTP (a LAN can't use the
``__Host-`` prefix, which needs Secure), ``__Host-sunroom`` with Secure over HTTPS. Both can exist
at once without one shadowing the other (PLAN §13.4).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime

from sunroom.core.crypto import KeyPurpose, b64url, constant_time_equal, derive_key, mac

VERSION = "v1"
MAX_AGE_SECONDS = 400 * 24 * 3600
REISSUE_AFTER_DAYS = 30
GRANT_SECONDS = 10 * 60


def session_cookie_name(https: bool) -> str:
    return "__Host-sunroom" if https else "sunroom"


def grant_cookie_name(https: bool) -> str:
    return "__Host-sunroom_parent" if https else "sunroom_parent"


@dataclass(frozen=True, slots=True)
class SessionToken:
    device_id: str
    epoch: int
    issued_day: int


@dataclass(frozen=True, slots=True)
class GrantToken:
    device_id: str
    expires_at: int  # unix seconds
    pin_epoch: int


def pin_epoch_of(pin_hash: str | None) -> int:
    if pin_hash is None:
        return 0
    return int(hashlib.sha256(pin_hash.encode()).hexdigest()[:12], 16)


def day_number(moment: datetime) -> int:
    return int(moment.timestamp() // 86400)


class SessionCodec:
    def __init__(self, secret: str) -> None:
        self._key = derive_key(secret, KeyPurpose.SESSION)

    def _mac(self, body: str) -> str:
        return b64url(mac(self._key, body.encode())[:16])

    def encode(self, token: SessionToken) -> str:
        body = f"{VERSION}.{token.device_id}.{token.epoch}.{token.issued_day}"
        return f"{body}.{self._mac(body)}"

    def decode(self, value: str | None) -> SessionToken | None:
        if not value or len(value) > 200:
            return None
        parts = value.split(".")
        if len(parts) != 5 or parts[0] != VERSION:
            return None
        body = ".".join(parts[:4])
        if not constant_time_equal(parts[4], self._mac(body)):
            return None
        try:
            return SessionToken(device_id=parts[1], epoch=int(parts[2]), issued_day=int(parts[3]))
        except ValueError:
            return None


class GrantCodec:
    def __init__(self, secret: str) -> None:
        self._key = derive_key(secret, KeyPurpose.PARENT_GRANT)

    def _mac(self, body: str) -> str:
        return b64url(mac(self._key, body.encode())[:16])

    def encode(self, token: GrantToken) -> str:
        body = f"{VERSION}.{token.device_id}.{token.expires_at}.{token.pin_epoch}"
        return f"{body}.{self._mac(body)}"

    def decode(self, value: str | None) -> GrantToken | None:
        if not value or len(value) > 200:
            return None
        parts = value.split(".")
        if len(parts) != 5 or parts[0] != VERSION:
            return None
        body = ".".join(parts[:4])
        if not constant_time_equal(parts[4], self._mac(body)):
            return None
        try:
            return GrantToken(parts[1], expires_at=int(parts[2]), pin_epoch=int(parts[3]))
        except ValueError:
            return None


@dataclass(frozen=True, slots=True)
class DeviceInfo:
    kind: str  # DeviceKind
    member_id: str | None
    is_kid_device: bool


@dataclass
class AuthState:
    """In-memory mirror of what makes a session valid, and of each device's kind and person.
    Correct only because exactly one process serves the API (PLAN §5.1)."""

    epoch: int
    devices: dict[str, DeviceInfo] = field(default_factory=dict[str, DeviceInfo])
    revoked_devices: set[str] = field(default_factory=set[str])
    last_seen_written: dict[str, datetime] = field(default_factory=dict[str, datetime])
    has_pin: bool = False
    pin_epoch: int = 0

    def is_valid(self, token: SessionToken) -> bool:
        return (
            token.epoch == self.epoch
            and token.device_id in self.devices
            and token.device_id not in self.revoked_devices
        )

    def live_device_ids(self) -> set[str]:
        return set(self.devices) - self.revoked_devices
