"""Exactly one process may own /data (PLAN §5.1; ADR 0001).

The lock is an advisory ``flock`` held for the life of the process; the kernel releases it when
the process exits, so a crash never leaves a stale lock behind.
"""

from __future__ import annotations

import fcntl
import os
from pathlib import Path


class InstanceLockError(Exception):
    pass


_held: dict[Path, int] = {}


def acquire(path: Path) -> None:
    path = path.resolve()
    if path in _held:
        return
    fd = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        raise InstanceLockError(
            "Another Sunroom process is already using this data folder. Run exactly one "
            "container (one replica, one worker) per data volume."
        ) from None
    _held[path] = fd


def release(path: Path) -> None:
    fd = _held.pop(path.resolve(), None)
    if fd is not None:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)
