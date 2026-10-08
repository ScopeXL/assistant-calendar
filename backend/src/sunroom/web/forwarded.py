"""Forwarded headers from a trusted reverse proxy (PLAN §12.5, §13.4).

Only when the connection comes from an address in TRUSTED_PROXIES: ``X-Forwarded-For`` becomes
the client address, ``X-Forwarded-Proto`` the scheme (so cookies get ``Secure`` and the
``__Host-`` name), and ``X-Forwarded-Host``, if sent, the Host the Host rule and the CSRF check
see. From anywhere else the headers are ignored, so nobody can claim to be on https or to be
someone else. A pure ASGI middleware, run before everything else.
"""

from __future__ import annotations

import ipaddress

from starlette.types import ASGIApp, Receive, Scope, Send

Network = ipaddress.IPv4Network | ipaddress.IPv6Network


def _first(value: bytes) -> str:
    return value.decode("latin-1").split(",")[0].strip()


def _last_untrusted(value: bytes, trusted: tuple[Network, ...]) -> str | None:
    """X-Forwarded-For is appended by each hop: the client is the right-most untrusted entry."""
    hops = [part.strip() for part in value.decode("latin-1").split(",") if part.strip()]
    for hop in reversed(hops):
        try:
            address = ipaddress.ip_address(hop)
        except ValueError:
            return None
        if not any(address in network for network in trusted):
            return hop
    return hops[0] if hops else None


class ForwardedHeaders:
    def __init__(self, app: ASGIApp, *, trusted_proxies: tuple[str, ...]) -> None:
        self.app = app
        self.trusted = tuple(ipaddress.ip_network(entry, strict=False) for entry in trusted_proxies)

    def _is_trusted(self, scope: Scope) -> bool:
        client = scope.get("client")
        if not self.trusted or not client:
            return False
        try:
            address = ipaddress.ip_address(client[0])
        except ValueError:
            return False
        return any(address in network for network in self.trusted)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in {"http", "websocket"} and self._is_trusted(scope):
            headers: list[tuple[bytes, bytes]] = list(scope["headers"])
            found = {name: value for name, value in headers}
            proto = found.get(b"x-forwarded-proto")
            if proto:
                scheme = _first(proto).lower()
                if scheme in {"http", "https"}:
                    scope["scheme"] = (
                        scheme
                        if scope["type"] == "http"
                        else ("wss" if scheme == "https" else "ws")
                    )
            forwarded_for = found.get(b"x-forwarded-for")
            if forwarded_for:
                client = _last_untrusted(forwarded_for, self.trusted)
                if client:
                    scope["client"] = (client, 0)
            forwarded_host = found.get(b"x-forwarded-host")
            if forwarded_host:
                host = _first(forwarded_host).encode("latin-1")
                scope["headers"] = [(n, v) for n, v in headers if n != b"host"] + [(b"host", host)]
        await self.app(scope, receive, send)
