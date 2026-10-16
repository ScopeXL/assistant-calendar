"""What Needs Attention lists (ADR 0034)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ProblemOut(BaseModel):
    id: str  # stable per cause: "sync:<account id>", "backup:failed"
    title: str  # one sentence in the family's words
    detail: str | None  # a quiet second line, for parents only
    since: datetime | None
    page: str | None  # the Settings page that fixes it
    source: str  # "core", or the plugin's id


class ProblemsOut(BaseModel):
    problems: list[ProblemOut]
