"""CSRF defence for the JSON API (PLAN §12.5, §13.4).

Every mutating /api request must carry ``X-Sunroom: 1``: another site can't add that header
without CORS, which Sunroom never grants. As a second layer, an ``Origin`` header, when present,
must equal ``scheme://Host`` exactly (``null`` is refused); without one, a browser's
``Sec-Fetch-Site`` must say ``same-origin`` or ``none``. Requests that send neither (scripts,
the tests) rely on the custom header alone.
"""

from __future__ import annotations

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from sunroom.core.errors import envelope
from sunroom.core.logging import get_logger

MUTATING = frozenset({"POST", "PUT", "PATCH", "DELETE"})
HEADER = "x-sunroom"
log = get_logger(__name__)


def _refuse(code: str, message: str) -> JSONResponse:
    return JSONResponse(envelope(code, message), status_code=403)


class CSRFGuard:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self._warned = False

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "http"
            and scope["method"] in MUTATING
            and str(scope["path"]).startswith("/api/")
        ):
            response = self._check(scope)
            if response is not None:
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)

    def _check(self, scope: Scope) -> JSONResponse | None:
        headers = Headers(scope=scope)
        blocked = _refuse(
            "csrf", "This request was blocked for safety. Reload the page and try again."
        )
        if headers.get(HEADER) != "1":
            return blocked
        origin = headers.get("origin")
        host = headers.get("host", "").strip().lower()
        expected = f"{scope['scheme']}://{host}"
        if origin is not None:
            origin = origin.strip().lower()
            if origin == expected:
                return None
            if scope["scheme"] == "http" and origin == f"https://{host}":
                # The browser is on https, but no trusted proxy said so (PLAN §13.4).
                if not self._warned:
                    self._warned = True
                    log.warning("csrf.proxy_not_trusted", fix="set TRUSTED_PROXIES")
                return _refuse(
                    "proxy_not_trusted",
                    "Sunroom is behind an https address but doesn't trust the proxy yet. Set "
                    "TRUSTED_PROXIES to the proxy's address and restart (docs/DEPLOY.md).",
                )
            return blocked
        fetch_site = headers.get("sec-fetch-site")
        if fetch_site is not None and fetch_site not in {"same-origin", "none"}:
            return blocked
        return None
