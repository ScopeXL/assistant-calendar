"""Forwarded headers from a reverse proxy on the home network (PLAN §12.5, §13.4, ADR 0034).

There is no proxy setting. A connection from the home network (loopback, link-local, the private
ranges and Tailscale's 100.64.0.0/10) is believed when it says, as a reverse proxy does, which
scheme the browser used (``X-Forwarded-Proto``: https gives cookies ``Secure`` and the
``__Host-`` name), who the browser was (``X-Forwarded-For``: the right-most hop outside those
ranges, else the left-most) and, if sent, the Host it asked for (``X-Forwarded-Host``, which the
Host rule and the CSRF check then see). A connection from the internet is never believed, so
nobody out there can claim to be on https or to be someone else.

On a home network every connection the container sees comes from a private address (phones on
the published port with their own address, a proxy on the host through Docker's gateway,
Tailscale through the same), which is why every documented setup works with nothing set. What
that accepts (ADR 0034): any device at home can claim another client address, which games only
the per-address sign-in limit (the global cap holds), or https for itself, which changes nothing
for anyone else. A pure ASGI middleware, run before everything else.
"""

from __future__ import annotations

import ipaddress

from starlette.types import ASGIApp, Receive, Scope, Send

# Explicit ranges rather than ``is_private``, which counts documentation and test ranges in too
# and differs between Python versions. 100.64.0.0/10 is carrier-grade NAT, which is Tailscale's:
# a proxy on another tailnet machine reaches Sunroom from there, and it's never the open internet.
HOME_NETWORKS = tuple(
    ipaddress.ip_network(network)
    for network in (
        "127.0.0.0/8",
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "169.254.0.0/16",
        "100.64.0.0/10",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
    )
)


def from_home_network(address: str) -> bool:
    """Whether an address is loopback, link-local, private or Tailscale's (an IPv4 address
    mapped into IPv6 counts as itself)."""
    try:
        parsed = ipaddress.ip_address(address)
    except ValueError:
        return False
    if isinstance(parsed, ipaddress.IPv6Address) and parsed.ipv4_mapped is not None:
        parsed = parsed.ipv4_mapped
    return any(parsed in network for network in HOME_NETWORKS)


def _first(value: bytes) -> str:
    return value.decode("latin-1").split(",")[0].strip()


def _client_of(value: bytes) -> str | None:
    """X-Forwarded-For is appended by each hop: the browser is the right-most hop outside the
    home network, or the left-most when every hop is at home. Anything that isn't an address
    leaves the connection's own."""
    hops = [part.strip() for part in value.decode("latin-1").split(",") if part.strip()]
    for hop in reversed(hops):
        try:
            ipaddress.ip_address(hop)
        except ValueError:
            return None
        if not from_home_network(hop):
            return hop
    return hops[0] if hops else None


class ForwardedHeaders:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        client = scope.get("client")
        if scope["type"] in {"http", "websocket"} and client and from_home_network(client[0]):
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
                browser = _client_of(forwarded_for)
                if browser:
                    scope["client"] = (browser, 0)
            forwarded_host = found.get(b"x-forwarded-host")
            if forwarded_host:
                host = _first(forwarded_host).encode("latin-1")
                scope["headers"] = [(n, v) for n, v in headers if n != b"host"] + [(b"host", host)]
        await self.app(scope, receive, send)
