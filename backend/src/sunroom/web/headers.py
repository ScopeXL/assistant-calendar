"""Security and caching headers on every response (PLAN §12.5).

A strict Content Security Policy everywhere. The one change from Dinner Bell (ADR 0007): the
page itself (index.html, web/spa.py) is served with a fresh nonce in ``style-src``, which the
app hands to ``<MotionConfig nonce>``, so the animation library's few ``<style>`` blocks are
allowed and nothing else's are. Every other response gets the same policy without a nonce.

A pure ASGI middleware (not BaseHTTPMiddleware) so streaming responses (SSE) pass untouched.
"""

from __future__ import annotations

import time
from collections.abc import Callable

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self'{nonce}; "
    "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; "
    "worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; "
    "object-src 'none'"
)
PERMISSIONS = "camera=(self), screen-wake-lock=(self), microphone=(), geolocation=()"


def csp(nonce: str | None = None) -> str:
    return _CSP.format(nonce=f" 'nonce-{nonce}'" if nonce else "")


DEFAULT_CSP = csp()


def _wall_ms() -> int:
    return int(time.time() * 1000)


class SecurityHeaders:
    def __init__(self, app: ASGIApp, *, now_ms: Callable[[], int] = _wall_ms) -> None:
        self.app = app
        # The app's clock: the display shows the server's time (PLAN §13.10), and test runs
        # move it.
        self.now_ms = now_ms

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope["path"]
        https = scope.get("scheme") == "https"

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                if "content-security-policy" not in headers:
                    headers["Content-Security-Policy"] = DEFAULT_CSP
                headers["X-Content-Type-Options"] = "nosniff"
                headers["Referrer-Policy"] = "same-origin"
                headers["Permissions-Policy"] = PERMISSIONS
                headers["Cross-Origin-Opener-Policy"] = "same-origin"
                if https:
                    headers["Strict-Transport-Security"] = "max-age=31536000"
                if path.startswith("/api/"):
                    if "cache-control" not in headers:
                        headers["Cache-Control"] = "no-store"
                    headers["X-Server-Time-Ms"] = str(self.now_ms())
                elif path.startswith("/assets/") and message["status"] == 200:
                    headers["Cache-Control"] = "public, max-age=31536000, immutable"
            await send(message)

        await self.app(scope, receive, send_with_headers)
