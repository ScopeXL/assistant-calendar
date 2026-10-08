"""Pair codes (PLAN §10.1, UX §11): one mechanism pairs a wall screen and adds a phone.

* Six characters from an alphabet without look-alikes (no 0, O, 1, I or L): about 29 bits.
  Wrong codes count against the sign-in limits (5 tries per 15 minutes per address, 50 an hour
  in all), so nobody can guess one in its 10 minutes.
* Single use, for 10 minutes.
* Stored as an HMAC under their own key, so a copy of the database gives away no live code.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy import and_, delete, or_
from sqlalchemy.ext.asyncio import AsyncSession

from sunroom.auth.models import JoinCode
from sunroom.core.crypto import KeyPurpose, derive_key, mac

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LENGTH = 6
CODE_TTL = timedelta(minutes=10)


def new_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))


def new_poll_token() -> str:
    return secrets.token_urlsafe(32)


def normalize(text: str) -> str | None:
    """What someone typed, as a code: any case, spaces and dashes ignored. None if it can't be."""
    code = "".join(text.split()).replace("-", "").upper()
    if len(code) != LENGTH or any(char not in ALPHABET for char in code):
        return None
    return code


def display(code: str) -> str:
    """ "7K4 M9X": two groups of three are easier to read across a room and to type."""
    return f"{code[:3]} {code[3:]}"


def code_hash(secret: str, code: str) -> str:
    return mac(derive_key(secret, KeyPurpose.JOIN_CODE), code.encode()).hex()


def poll_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def prune(session: AsyncSession, now: datetime) -> None:
    """Expired codes, and used ones with nothing left to hand over, have nothing left to do. A
    screen's code that was claimed stays until the screen collects its sign-in (its poll token
    is cleared then) or the code expires."""
    await session.execute(
        delete(JoinCode).where(
            or_(
                JoinCode.expires_at <= now,
                and_(JoinCode.used_at.is_not(None), JoinCode.poll_token_hash.is_(None)),
            )
        )
    )
