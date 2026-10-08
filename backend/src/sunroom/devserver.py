"""Factory for ``sunroom serve --reload`` (development only).

Each reloaded worker runs the same startup checks as production before creating the app.
"""

from __future__ import annotations

from fastapi import FastAPI

from sunroom.app import create_app
from sunroom.boot import prepare
from sunroom.core.clock import SystemClock
from sunroom.core.config import load_settings
from sunroom.core.logging import configure_logging


def create() -> FastAPI:
    settings = load_settings()
    configure_logging(settings.log_level, secret_literals=settings.secret_literals())
    secret = prepare(settings, SystemClock())
    configure_logging(settings.log_level, secret_literals=[*settings.secret_literals(), secret])
    return create_app(settings, secret=secret)
