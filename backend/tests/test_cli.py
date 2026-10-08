from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


def run(args: list[str], env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    clean = {k: v for k, v in os.environ.items() if not k.startswith(("APP_", "SUNROOM_"))}
    return subprocess.run(  # noqa: S603
        [sys.executable, "-m", "sunroom", *args],
        env=clean | env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_no_configuration_at_all_is_fine() -> None:
    """A self-hoster sets nothing: the key is generated and the password chosen in the wizard."""
    result = run(["check-config"], {})
    assert result.returncode == 0, result.stderr
    assert "Configuration OK." in result.stdout


def test_bad_configuration_exits_78_and_names_only() -> None:
    secret = "short-and-secret"
    result = run(["check-config"], {"APP_SECRET_KEY": secret, "TZ": "Mars/Base"})
    assert result.returncode == 78
    assert "APP_SECRET_KEY must be at least 32 characters" in result.stderr
    assert "TZ must be an IANA time zone" in result.stderr
    assert secret not in result.stderr + result.stdout


def test_openapi_is_deterministic_and_version_free(tmp_path: Path) -> None:
    first, second = tmp_path / "a.json", tmp_path / "b.json"
    assert run(["openapi", "--out", str(first)], {}).returncode == 0
    assert run(["openapi", "--out", str(second)], {}).returncode == 0
    assert first.read_text() == second.read_text()
    schema = json.loads(first.read_text())
    assert schema["info"]["version"] == "0"
    assert "/api/auth/login" in schema["paths"]
    assert "/api/setup" in schema["paths"]
    assert not any(path.startswith("/api/_test") for path in schema["paths"])
