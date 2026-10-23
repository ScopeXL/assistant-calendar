"""The agent's server (app.AgentServer), for real on a free local port: asked to stop while a
screen page holds its event stream open, it ends the stream and reaches the app's own shutdown
at once, where the agent closes its browser (ADR 0040). Plain uvicorn waited for the stream
forever, and the system killed the agent, and the browser with it, before it wrote its cookies."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.responses import StreamingResponse

from sunroom_kiosk.app import SHUTDOWN_GRACE_S, AgentServer
from sunroom_kiosk.events import EventHub


async def test_a_stop_with_a_page_listening_reaches_the_apps_shutdown_at_once() -> None:
    hub = EventHub()
    shut_down = asyncio.Event()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
        yield
        shut_down.set()

    app = FastAPI(lifespan=lifespan)

    @app.get("/events")
    async def events() -> StreamingResponse:  # pyright: ignore[reportUnusedFunction]
        return StreamingResponse(hub.stream(), media_type="text/event-stream")

    server = AgentServer(app, hub=hub, port=0)
    serving = asyncio.create_task(server.serve())
    for _ in range(500):
        await asyncio.sleep(0.01)
        if server.started:
            break
    port = server.servers[0].sockets[0].getsockname()[1]

    async def listen() -> None:
        async with (
            httpx.AsyncClient(timeout=10.0) as client,
            client.stream("GET", f"http://127.0.0.1:{port}/events") as response,
        ):
            async for _ in response.aiter_bytes():
                pass

    listening = asyncio.create_task(listen())
    for _ in range(500):
        await asyncio.sleep(0.01)
        if hub.listeners:
            break
    server.should_exit = True  # what SIGTERM does
    # Well inside the grace: the stream was ended, not cut when the grace ran out.
    await asyncio.wait_for(shut_down.wait(), SHUTDOWN_GRACE_S - 1)
    await asyncio.wait_for(serving, 5)
    await asyncio.wait_for(listening, 5)  # the page saw its stream end
