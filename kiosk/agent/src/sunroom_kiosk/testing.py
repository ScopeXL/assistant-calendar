"""Test-only routes, with ``--fake`` (the e2e runs and ``just kiosk-dev``): put the pretend
screen back as it started before each test, or change what it pretends to be. Never mounted on a
real screen."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from sunroom_kiosk.state import Agent

router = APIRouter(prefix="/api/screen/_test", include_in_schema=False)


class FakeIn(BaseModel):
    kind: Literal["pi", "desktop"] | None = None
    wired: bool | None = None


def _agent(request: Request) -> Agent:
    agent: Agent = request.app.state.agent
    return agent


@router.post("/reset", status_code=204)
async def reset(request: Request) -> None:
    await _agent(request).reset_fake()


@router.post("/fake", status_code=204)
async def fake(body: FakeIn, request: Request) -> None:
    await _agent(request).change_fake(kind=body.kind, wired=body.wired)
