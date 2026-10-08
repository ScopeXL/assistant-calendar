"""First run (PLAN §12.1, §13.4): the public setup endpoint, once."""

from __future__ import annotations

from pathlib import Path

import httpx
from fastapi import FastAPI

from sunroom.app import create_app
from tests.support import BASE_URL, CSRF, PASSWORD, make_settings, run_setup, state_of


async def test_status_before_setup(client: httpx.AsyncClient) -> None:
    status = (await client.get("/api/setup/status")).json()
    assert status["setup_complete"] is False
    assert status["password_from_env"] is False
    assert status["server_timezone"] == "America/New_York"
    assert status["advertised_url"] == BASE_URL


async def test_setup_signs_in_the_phone_as_a_parent(
    app: FastAPI, client: httpx.AsyncClient
) -> None:
    response = await run_setup(client, household_name="The Riveras", timezone="Europe/Lisbon")
    assert response.status_code == 201, response.text
    session = response.json()
    assert session["household_name"] == "The Riveras"
    assert session["device_kind"] == "phone"
    assert session["is_parent"] is True
    assert "sunroom=v1." in response.headers["set-cookie"]
    assert (await client.get("/api/auth/session")).status_code == 200
    assert str(state_of(app).zone()) == "Europe/Lisbon"
    status = (await client.get("/api/setup/status")).json()
    assert status["setup_complete"] is True


async def test_setup_runs_once(client: httpx.AsyncClient, other: httpx.AsyncClient) -> None:
    assert (await run_setup(client)).status_code == 201
    again = await run_setup(other, password="another-long-passphrase")
    assert again.status_code == 410
    assert again.json()["error"]["code"] == "setup_done"
    # The first password stands; the second never took.
    assert (
        await other.post("/api/auth/login", json={"password": PASSWORD}, headers=CSRF)
    ).status_code == 200


async def test_a_short_password_says_what_to_do(client: httpx.AsyncClient) -> None:
    response = await run_setup(client, password="short")
    assert response.status_code == 422
    assert response.json()["error"]["message"].startswith("Use at least 12 characters")


async def test_an_unknown_time_zone_is_refused(client: httpx.AsyncClient) -> None:
    response = await run_setup(client, timezone="Mars/Base")
    assert response.status_code == 422
    assert response.json()["error"]["fields"] == ["timezone"]


async def test_sign_in_waits_for_setup(client: httpx.AsyncClient) -> None:
    response = await client.post("/api/auth/login", json={"password": PASSWORD}, headers=CSRF)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "setup_required"


async def test_with_app_password_setup_needs_that_password(data_dir: Path) -> None:
    """An unconfigured server can't be claimed by whoever opens it first (PLAN §17 risk 10)."""
    app = create_app(make_settings(data_dir, app_password="the-servers-own-passphrase"))
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as client:
            status = (await client.get("/api/setup/status")).json()
            assert status["password_from_env"] is True
            wrong = await run_setup(client, password="a-guess-at-the-password")
            assert wrong.status_code == 401
            right = await run_setup(client, password="the-servers-own-passphrase")
            assert right.status_code == 201
            assert (
                await client.post(
                    "/api/auth/login",
                    json={"password": "the-servers-own-passphrase"},
                    headers=CSRF,
                )
            ).status_code == 200
