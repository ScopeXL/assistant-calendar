"""The agent's log: one plain line per thing that happened, on stderr (the journal keeps it on
Linux: ``journalctl --user -u sunroom-kiosk``), and the last 50 lines in memory for This
Screen's Help sheet. Nothing logged here may hold a password, a pair code or the household's
name; addresses and network names are fine.
"""

from __future__ import annotations

import logging
import sys
from collections import deque
from datetime import datetime

KEEP = 50
_recent: deque[str] = deque(maxlen=KEEP)


class _Recent(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        stamp = datetime.fromtimestamp(record.created).astimezone().strftime("%b %d %H:%M:%S")
        _recent.append(f"{stamp} {record.getMessage()}")


def setup(level: int = logging.INFO) -> None:
    root = logging.getLogger("sunroom_kiosk")
    if root.handlers:
        return
    root.setLevel(level)
    console = logging.StreamHandler(sys.stderr)
    console.setFormatter(logging.Formatter("%(message)s"))
    root.addHandler(console)
    root.addHandler(_Recent())
    root.propagate = False


def get(name: str) -> logging.Logger:
    return logging.getLogger(f"sunroom_kiosk.{name}")


def recent() -> list[str]:
    return list(_recent)
