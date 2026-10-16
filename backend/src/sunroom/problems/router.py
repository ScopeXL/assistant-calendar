"""GET /api/problems: what needs a parent (ADR 0034)."""

from __future__ import annotations

from fastapi import APIRouter

from sunroom.auth.deps import ActorDep
from sunroom.problems import service
from sunroom.problems.schemas import ProblemsOut
from sunroom.state import StateDep

router = APIRouter(prefix="/api", tags=["problems"])


@router.get("/problems")
async def list_problems(state: StateDep, actor: ActorDep) -> ProblemsOut:
    """Needs Attention: every problem, each with a sentence and the page that fixes it. Anyone
    signed in or paired may read the sentences; the quiet details are a parent's."""
    return ProblemsOut(problems=await service.collect(state, actor))
