"""The Host rule (PLAN §13.4, ADR 0017), instead of a configured base URL.

A kitchen app is reached as ``sunroom.local``, an IP, ``localhost`` on the Pi and maybe an HTTPS
name, all at once, so no single address can be configured. Every request's Host must instead be
one a household would use:

* ``localhost`` (and ``*.localhost``), or any IP literal;
* this container's own host name, or any single-label name (``sunroom``, ``nas``);
* a name ending in ``.local``, ``.lan``, ``.home``, ``.home.arpa``, ``.internal`` or ``.ts.net``;
* a name in APP_ALLOWED_HOSTS (exact, or ``*.example.com`` for any name under it).

Anything else gets 421 with the fix spelled out. This is what stops DNS rebinding: a web page on
``evil.example`` that resolves its name to the server's LAN address still sends
``Host: evil.example``, which is refused, even before setup has a password.
"""

from __future__ import annotations

import ipaddress
import json
import socket
from collections.abc import Callable

from starlette.datastructures import Headers
from starlette.types import ASGIApp, Receive, Scope, Send

LAN_SUFFIXES = (".local", ".lan", ".home", ".home.arpa", ".internal", ".ts.net", ".localhost")


def host_name(host_header: str) -> str:
    """The name in a Host header, lowercased, without the port or IPv6 brackets."""
    host = host_header.strip().lower()
    if host.startswith("["):
        return host[1 : host.find("]")] if "]" in host else host
    if host.count(":") == 1:
        host = host.split(":", 1)[0]
    return host.rstrip(".")


def is_ip_literal(name: str) -> bool:
    try:
        ipaddress.ip_address(name)
    except ValueError:
        return False
    return True


class HostRule:
    def __init__(
        self,
        allowed: tuple[str, ...],
        *,
        container_hostname: str | None = None,
    ) -> None:
        self.exact = {name for name in allowed if not name.startswith("*.")}
        self.suffixes = tuple(name[1:] for name in allowed if name.startswith("*."))
        own = container_hostname if container_hostname is not None else socket.gethostname()
        self.own = own.lower().rstrip(".")

    def allows(self, name: str) -> bool:
        if not name:
            return False
        if name == "localhost" or is_ip_literal(name) or name == self.own:
            return True
        if "." not in name:
            return True
        if name.endswith(LAN_SUFFIXES):
            return True
        return name in self.exact or name.endswith(self.suffixes)


class HostGuard:
    """Refuses requests whose Host the rule doesn't allow; notes the ones it does."""

    def __init__(
        self,
        app: ASGIApp,
        *,
        rule: HostRule,
        note: Callable[[str], None] | None = None,
    ) -> None:
        self.app = app
        self.rule = rule
        self.note = note

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return
        header = Headers(scope=scope).get("host", "")
        name = host_name(header)
        if self.rule.allows(name):
            if self.note is not None and scope.get("path") != "/api/health":
                self.note(header.strip().lower())
            await self.app(scope, receive, send)
            return
        shown = name[:80] or "(none)"
        message = (
            f"Sunroom doesn't answer to the address {shown}. If that's your own name for it, "
            "add it to APP_ALLOWED_HOSTS (for example calendar.example.com) and restart."
        )
        if str(scope.get("path", "")).startswith("/api/"):
            body = json.dumps({"error": {"code": "unknown_host", "message": message}}).encode()
            content_type = b"application/json"
        else:
            body = message.encode()
            content_type = b"text/plain; charset=utf-8"
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        await send(
            {
                "type": "http.response.start",
                "status": 421,
                "headers": [
                    (b"content-type", content_type),
                    (b"content-length", str(len(body)).encode()),
                    (b"cache-control", b"no-store"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
