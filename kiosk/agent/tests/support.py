"""What the agent's tests share: the pretend Sunroom servers discovery and the health checks
talk to (httpx.MockTransport, by base address), and the addresses they use. Synthetic data only."""

from __future__ import annotations

import json
from typing import Any

import httpx

PORT = 7800
AGENT = f"http://127.0.0.1:{PORT}"
SUNROOM = "http://192.168.1.20:8080"
SUNROOM_ID = "00000000-0000-7000-8000-0000000000e1"
CHANGE = {"X-Sunroom-Screen": "1"}


class FakeSunrooms:
    """Pretend servers by base address: a new one (``/api/discover``), an older one (only
    ``/api/setup/status``), something else, and nothing at all for every other address."""

    def __init__(self) -> None:
        self.new: dict[str, dict[str, Any]] = {
            SUNROOM: {
                "sunroom": True,
                "id": SUNROOM_ID,
                "version": "0.13.0",
                "setup_complete": True,
                "name": "The Sample Family",
                "url": None,
            }
        }
        self.older: dict[str, str] = {}  # base -> version
        self.other: set[str] = set()  # answers, but isn't a Sunroom
        self.healthy: set[str] = {SUNROOM}
        self.asked: list[str] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        base = f"{request.url.scheme}://{request.url.netloc.decode()}"
        path = request.url.path
        self.asked.append(f"{base}{path}")
        if base in self.new:
            if path == "/api/discover":
                return httpx.Response(200, json=self.new[base])
            if path == "/api/health":
                ok = base in self.healthy
                return httpx.Response(200 if ok else 503, json={"status": "ok" if ok else "x"})
            return httpx.Response(404, json={"error": {"code": "not_found"}})
        if base in self.older:
            if path == "/api/setup/status":
                body = {
                    "setup_complete": True,
                    "password_from_env": False,
                    "server_timezone": None,
                    "advertised_url": base,
                    "version": self.older[base],
                }
                return httpx.Response(200, content=json.dumps(body).encode())
            if path == "/api/health":
                return httpx.Response(200, json={"status": "ok"})
            return httpx.Response(404, json={"detail": "Not Found"})
        if base in self.other:
            return httpx.Response(200, text="<html>Sample router page</html>")
        raise httpx.ConnectError("nothing answers there", request=request)

    def client(self, connect: float = 0.3) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self))
