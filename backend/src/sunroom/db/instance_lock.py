"""Exactly one process may own the data folder (PLAN §5.1; ADR 0001).

The lock is held for the life of the process, and the system releases it when the process exits,
so a crash never leaves a stale lock behind: an advisory ``flock`` on Linux and macOS, and on
Windows, where Sunroom runs as a program for a computer's user (ADR 0038), a lock on the file's
first byte (``msvcrt.locking``).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

if sys.platform == "win32":
    import msvcrt
else:
    import fcntl


class InstanceLockError(Exception):
    pass


_held: dict[Path, int] = {}


def _lock(fd: int) -> bool:
    """Lock ``fd`` for this process; False when another process holds it."""
    if sys.platform == "win32":
        os.lseek(fd, 0, os.SEEK_SET)
        try:
            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
        except OSError:
            return False
        return True
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return False
    return True


def _unlock(fd: int) -> None:
    if sys.platform == "win32":
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
    else:
        fcntl.flock(fd, fcntl.LOCK_UN)


def acquire(path: Path) -> None:
    path = path.resolve()
    if path in _held:
        return
    fd = os.open(path, os.O_RDWR | os.O_CREAT, 0o600)
    if not _lock(fd):
        os.close(fd)
        raise InstanceLockError(
            "Another Sunroom process is already using this data folder. Run exactly one "
            "container (one replica, one worker) per data volume, or one Sunroom per folder."
        )
    _held[path] = fd


def release(path: Path) -> None:
    fd = _held.pop(path.resolve(), None)
    if fd is not None:
        _unlock(fd)
        os.close(fd)
