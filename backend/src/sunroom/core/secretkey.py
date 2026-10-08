"""The app's secret key (PLAN §14.2): APP_SECRET_KEY if set, else one generated on first boot.

A self-hoster never has to make one. The generated key lives at ``$DATA_DIR/secret.key``
(mode 0600) next to the database, so a restore of the whole volume keeps everyone signed in.
Losing it signs every device out and disconnects accounts (their credentials were encrypted
under it); the database itself survives.
"""

from __future__ import annotations

import os
import secrets
from pathlib import Path

from sunroom.core.config import Settings

KEY_BYTES = 48


class SecretKeyError(Exception):
    pass


def resolve(settings: Settings) -> str:
    """The key to use: from the environment, from the key file, or newly generated."""
    if settings.app_secret_key is not None:
        return settings.app_secret_key.get_secret_value()
    return load_or_create(settings.secret_key_path)


def load_or_create(path: Path) -> str:
    try:
        existing = path.read_text().strip()
    except FileNotFoundError:
        existing = ""
    except OSError as exc:
        raise SecretKeyError(f"{path.name} couldn't be read ({exc.strerror})") from None
    if existing:
        if len(existing) < 32:
            raise SecretKeyError(f"{path.name} is too short; delete it to generate a new one")
        return existing
    key = secrets.token_urlsafe(KEY_BYTES)
    # O_EXCL: if two processes raced (they can't, the instance lock is held), one would fail.
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as handle:
        handle.write(key + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    return key
