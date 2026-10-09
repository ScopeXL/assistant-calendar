"""Security headers, the Host rule, forwarded headers and serving the built SPA (PLAN §5.1,
§12.5, §13.4; ADR 0007, ADR 0017)."""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest

from sunroom.app import create_app
from sunroom.core.clock import FakeClock
from sunroom.web.headers import DEFAULT_CSP
from sunroom.web.hosts import HostRule, host_name
from tests.support import BASE_URL, make_settings, run_setup

INDEX = '<!doctype html><meta name="csp-nonce" content="__SUNROOM_CSP_NONCE__"><div id=root></div>'


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    root = tmp_path / "static"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text(INDEX)
    (root / "assets" / "app-abc123.js").write_text("console.log('hi')")
    (root / "sw.js").write_text("self.addEventListener('install', () => {})")
    (root / "manifest.webmanifest").write_text('{"name": "Sunroom"}')
    return root


@pytest.fixture
async def spa_client(data_dir: Path, static_dir: Path) -> AsyncIterator[httpx.AsyncClient]:
    app = create_app(make_settings(data_dir, sunroom_static_dir=str(static_dir)))
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as client:
            yield client


async def test_security_headers_on_api_responses(
    client: httpx.AsyncClient, clock: FakeClock
) -> None:
    response = await client.get("/api/version")
    assert response.headers["content-security-policy"] == DEFAULT_CSP
    assert "style-src 'self';" in DEFAULT_CSP
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "same-origin"
    assert response.headers["cross-origin-opener-policy"] == "same-origin"
    assert "screen-wake-lock=(self)" in response.headers["permissions-policy"]
    assert response.headers["cache-control"] == "no-store"
    # The server's time is the app's clock (the display shows it; tests move it).
    assert int(response.headers["x-server-time-ms"]) == int(clock.now().timestamp() * 1000)
    assert "strict-transport-security" not in response.headers


async def test_every_page_load_gets_a_fresh_style_nonce(spa_client: httpx.AsyncClient) -> None:
    nonces: list[str] = []
    for path in ("/", "/display", "/settings/family", "/index.html"):
        response = await spa_client.get(path)
        assert response.status_code == 200
        assert response.headers["cache-control"] == "no-cache"
        meta = re.search(r'name="csp-nonce" content="([^"]+)"', response.text)
        assert meta, response.text
        nonce = meta.group(1)
        assert f"style-src 'self' 'nonce-{nonce}';" in response.headers["content-security-policy"]
        assert "__SUNROOM_CSP_NONCE__" not in response.text
        nonces.append(nonce)
    assert len(set(nonces)) == len(nonces)


async def test_unknown_api_paths_are_json_404s(spa_client: httpx.AsyncClient) -> None:
    response = await spa_client.get("/api/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


async def test_hashed_assets_are_immutable_and_missing_ones_404(
    spa_client: httpx.AsyncClient,
) -> None:
    response = await spa_client.get("/assets/app-abc123.js")
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
    missing = await spa_client.get("/assets/gone-123.js")
    assert missing.status_code == 404
    assert "id=root" not in missing.text


async def test_top_level_files_are_served_without_caching(spa_client: httpx.AsyncClient) -> None:
    worker = await spa_client.get("/sw.js")
    assert worker.headers["cache-control"] == "no-cache"
    manifest = await spa_client.get("/manifest.webmanifest")
    assert manifest.headers["content-type"].startswith("application/manifest+json")


async def test_path_traversal_falls_back_to_index(spa_client: httpx.AsyncClient) -> None:
    response = await spa_client.get("/..%2F..%2Fetc%2Fpasswd")
    assert response.status_code in {200, 404}
    assert "root:" not in response.text


async def test_the_photos_room_is_the_app_and_only_the_files_under_it_are_reserved(
    spa_client: httpx.AsyncClient,
) -> None:
    # The wall's code opens /photos on a phone that may never have loaded the app.
    room = await spa_client.get("/photos")
    assert room.status_code == 200
    assert "id=root" in room.text
    missing = await spa_client.get("/photos/nope")
    assert missing.status_code == 404
    assert "id=root" not in missing.text


async def test_photos_need_a_session(spa_client: httpx.AsyncClient) -> None:
    path = "/photos/avatars/01890000-0000-7000-8000-000000000000.webp"
    assert (await spa_client.get(path)).status_code == 401
    await run_setup(spa_client)
    assert (await spa_client.get(path)).status_code == 404
    sneaky = await spa_client.get("/photos/avatars/..%2F..%2Fsunroom.db")
    assert sneaky.status_code == 404
    assert b"SQLite" not in sneaky.content


# ---- the Host rule (ADR 0017) ----------------------------------------------------------------


@pytest.mark.parametrize(
    "host",
    [
        "localhost",
        "localhost:8080",
        "127.0.0.1:8080",
        "192.168.1.20:8080",
        "[::1]:8080",
        "sunroom",
        "sunroom.local",
        "kitchen.lan",
        "nas.home.arpa",
        "sunroom.tail1234.ts.net",
        "calendar.example.com",
        "ha.example.org",
    ],
)
def test_lan_names_and_listed_names_pass(host: str) -> None:
    rule = HostRule(("calendar.example.com", "*.example.org"), container_hostname="abc123")
    assert rule.allows(host_name(host))


@pytest.mark.parametrize("host", ["evil.example", "example.org", "sunroom.local.evil.example", ""])
def test_other_names_dont(host: str) -> None:
    rule = HostRule(("calendar.example.com", "*.example.org"), container_hostname="abc123")
    assert not rule.allows(host_name(host))


async def test_a_foreign_host_gets_421_with_the_fix(client: httpx.AsyncClient) -> None:
    api = await client.get("/api/version", headers={"host": "evil.example"})
    assert api.status_code == 421
    assert api.json()["error"]["code"] == "unknown_host"
    assert "APP_ALLOWED_HOSTS" in api.json()["error"]["message"]
    page = await client.get("/", headers={"host": "evil.example"})
    assert page.status_code == 421
    assert page.headers["content-type"].startswith("text/plain")
    setup = await client.post(
        "/api/setup",
        json={"password": "x" * 20, "household_name": "x", "timezone": "UTC"},
        headers={"host": "evil.example", "x-sunroom": "1"},
    )
    assert setup.status_code == 421  # DNS rebinding can't claim an unconfigured server


async def test_addresses_this_server_was_reached_at_are_remembered(
    parent: httpx.AsyncClient,
) -> None:
    await parent.get("/api/version", headers={"host": "sunroom.local:8080"})
    await parent.get("/api/version", headers={"host": "127.0.0.1:8080"})
    diagnostics = (await parent.get("/api/admin/diagnostics")).json()
    # Loopback names (this request's localhost too) only work on the server itself.
    assert diagnostics["recent_addresses"] == ["sunroom.local:8080"]


# ---- forwarded headers (PLAN §13.4) --------------------------------------------------------


async def test_forwarded_headers_count_only_from_trusted_proxies(data_dir: Path) -> None:
    trusted = create_app(make_settings(data_dir, trusted_proxies="127.0.0.0/8"))
    async with trusted.router.lifespan_context(trusted):
        transport = httpx.ASGITransport(app=trusted, client=("127.0.0.1", 4000))
        async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as client:
            await run_setup(client)
            response = await client.get(
                "/api/admin/diagnostics",
                headers={
                    "x-forwarded-proto": "https",
                    "x-forwarded-for": "198.51.100.7, 127.0.0.1",
                    "x-forwarded-host": "calendar.example.com",
                },
            )
            # The forwarded Host is what the Host rule checks, and it isn't allowed here.
            assert response.status_code == 421
    untrusted = create_app(make_settings(data_dir))
    async with untrusted.router.lifespan_context(untrusted):
        transport = httpx.ASGITransport(app=untrusted, client=("127.0.0.1", 4000))
        async with httpx.AsyncClient(transport=transport, base_url=BASE_URL) as client:
            await client.post(
                "/api/auth/login",
                json={"password": "test-household-passphrase"},
                headers={"x-sunroom": "1"},
            )
            response = await client.get(
                "/api/admin/diagnostics",
                headers={"x-forwarded-proto": "https", "x-forwarded-for": "198.51.100.7"},
            )
            body = response.json()
            assert body["client"]["scheme"] == "http"
            assert body["client"]["resolved_ip"] == "127.0.0.1"


async def test_a_trusted_proxy_sets_scheme_client_and_host(data_dir: Path) -> None:
    app = create_app(
        make_settings(
            data_dir, trusted_proxies="127.0.0.0/8", app_allowed_hosts="calendar.example.com"
        )
    )
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 4000))
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://sunroom:8080",
            headers={
                "x-forwarded-proto": "https",
                "x-forwarded-for": "198.51.100.7",
                "x-forwarded-host": "calendar.example.com",
            },
        ) as client:
            setup = await run_setup(client)
            cookie = setup.headers["set-cookie"].split(";")[0]
            assert cookie.startswith("__Host-sunroom=")
            # httpx won't send a Secure cookie over the test transport's plain HTTP: by hand.
            client.cookies.clear()
            body = (await client.get("/api/admin/diagnostics", headers={"cookie": cookie})).json()
    assert body["client"]["scheme"] == "https"
    assert body["client"]["resolved_ip"] == "198.51.100.7"
    assert body["client"]["host"] == "calendar.example.com"
