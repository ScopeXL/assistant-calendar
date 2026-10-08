"""Shared fixtures.

* The real environment is stripped for every test, so a developer's .env can never leak in.
* The schema comes from the real migrations: a template database is migrated once per session
  and each test gets a copy (never ``create_all``).
* Sockets are disabled (``--disable-socket``): outbound requests go through a fake resolver and
  httpx's MockTransport.
"""

from __future__ import annotations

import os
import shutil
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi import FastAPI

from sunroom.app import create_app
from sunroom.core.clock import FakeClock
from sunroom.core.config import Settings
from sunroom.db import instance_lock, migrate
from tests.support import BASE_URL, ENV_NAMES, ENV_PREFIXES, make_settings, run_setup, state_of


@pytest.fixture(autouse=True)
def _isolate_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in list(os.environ):
        upper = key.upper()
        if upper.startswith(ENV_PREFIXES) or upper in ENV_NAMES:
            monkeypatch.delenv(key, raising=False)


@pytest.fixture(autouse=True)
def _release_locks() -> Any:
    yield
    for path in list(instance_lock._held):  # pyright: ignore[reportPrivateUsage]
        instance_lock.release(path)


@pytest.fixture(scope="session")
def migrated_template(tmp_path_factory: pytest.TempPathFactory) -> Path:
    path = tmp_path_factory.mktemp("template") / "sunroom.db"
    migrate.upgrade(path)
    return path


@pytest.fixture
def data_dir(tmp_path: Path, migrated_template: Path) -> Path:
    directory = tmp_path / "data"
    directory.mkdir()
    shutil.copy(migrated_template, directory / "sunroom.db")
    return directory


@pytest.fixture
def settings(data_dir: Path) -> Settings:
    return make_settings(data_dir)


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(datetime(2026, 10, 7, 14, 0, tzinfo=UTC))


@pytest.fixture
async def app(settings: Settings, clock: FakeClock) -> AsyncIterator[FastAPI]:
    application = create_app(settings, clock=clock, ping_interval_s=0.05)
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as http:
        yield http


@pytest.fixture
async def other(app: FastAPI) -> AsyncIterator[httpx.AsyncClient]:
    """A second device (another phone, or the wall screen)."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as http:
        yield http


@pytest.fixture
async def parent(client: httpx.AsyncClient) -> httpx.AsyncClient:
    """Set up, signed in on the phone that ran setup (a parent's phone)."""
    response = await run_setup(client)
    assert response.status_code == 201, response.text
    return client


@pytest.fixture
def events(app: FastAPI) -> list[tuple[str, dict[str, Any]]]:
    """Every event published, in order (after commit, for those sent from a transaction)."""
    seen: list[tuple[str, dict[str, Any]]] = []
    state_of(app).hub.listeners.append(lambda kind, payload: seen.append((kind, payload)))
    return seen
