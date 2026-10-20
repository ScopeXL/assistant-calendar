"""The agent's event stream, ``GET /api/screen/events`` (server-sent events).

Events: ``state`` (the whole ScreenStateOut, whenever any of it changes), ``update.progress``
and ``run.progress`` ({percent, step}), ``discovery.found`` (a ScreenFoundOut) and
``discovery.done`` while a scan runs, and ``toast`` ({message}) for something the screen's
pages should say. A comment every 15 s keeps the connection open through anything in between.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

from pydantic import BaseModel

PING_S = 15.0
QUEUE_MAX = 100


def frame(event: str, data: Any) -> bytes:
    body = data.model_dump(mode="json") if isinstance(data, BaseModel) else data
    return f"event: {event}\ndata: {json.dumps(body, separators=(',', ':'))}\n\n".encode()


class EventHub:
    def __init__(self, ping_s: float = PING_S) -> None:
        self.ping_s = ping_s
        self._queues: set[asyncio.Queue[bytes | None]] = set()

    @property
    def listeners(self) -> int:
        return len(self._queues)

    def publish(self, event: str, data: Any) -> None:
        message = frame(event, data)
        for queue in list(self._queues):
            if queue.qsize() >= QUEUE_MAX:
                continue  # a reader that stopped reading: it catches up from the next state
            queue.put_nowait(message)

    def close(self) -> None:
        for queue in list(self._queues):
            queue.put_nowait(None)

    async def stream(self, first: bytes | None = None) -> AsyncGenerator[bytes]:
        queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._queues.add(queue)
        try:
            yield b"retry: 2000\n\n"
            if first is not None:
                yield first
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=self.ping_s)
                except TimeoutError:
                    yield b": ping\n\n"
                    continue
                if message is None:
                    return
                yield message
        finally:
            self._queues.discard(queue)
