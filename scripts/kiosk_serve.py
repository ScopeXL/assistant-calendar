#!/usr/bin/env python3
"""Try this checkout's installers before a release, on another computer or a virtual machine on
this network (docs/KIOSK.md, "Trying a change before a release"). `just kiosk-serve` builds
Sunroom Screen's wheel, then this serves it with the installers and prints one line per system:

  GET /install.sh      a few lines of bash: this checkout's kiosk folder and the wheel into a
                       temporary folder, then its install.sh with --agent-wheel and any options
  GET /install.ps1     the same for Windows: install.ps1 and the wheel, then -AgentWheel
  GET /kiosk.tar.gz    the kiosk files install.sh needs, as git tracks them, and the wheel
  GET /kiosk/...       install.ps1 and the wheel on their own

So a computer that runs it takes nothing from GitHub; uv, its Python and a browser still come
from their makers. Only what git tracks under kiosk/ is served, plus the wheel. Ctrl+C stops it.
"""

from __future__ import annotations

import io
import socket
import subprocess
import sys
import tarfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
KIOSK_FILES = (
    "kiosk/install.sh",
    "kiosk/install.ps1",
    "kiosk/labwc-rule.py",
    "kiosk/update.sh",
    "kiosk/uninstall.sh",
)

BASH = """#!/usr/bin/env bash
# Sunroom's installer from {base}, before a release (scripts/kiosk_serve.py): this checkout's
# kiosk folder and Sunroom Screen's wheel, then the installer from that copy.
set -euo pipefail
try_sunroom() {{
\tlocal dir
\tdir=$(mktemp -d)
\tcurl -fsSL "{base}/kiosk.tar.gz" | tar -xzf - -C "$dir"
\tbash "$dir/kiosk/install.sh" --agent-wheel "$dir/kiosk/agent/dist/{wheel}" "$@"
}}
try_sunroom "$@"
"""

POWERSHELL = """# Sunroom Screen's installer from {base}, before a release (scripts/kiosk_serve.py):
# this checkout's install.ps1 and Sunroom Screen's wheel, then the installer from that copy.
$sunroomTry = Join-Path ([IO.Path]::GetTempPath()) "sunroom-try"
$null = New-Item -ItemType Directory -Force -Path $sunroomTry
$tryScript = Join-Path $sunroomTry "install.ps1"
$tryWheel = Join-Path $sunroomTry "{wheel}"
$ProgressPreference = "SilentlyContinue"
Invoke-WebRequest -Uri "{base}/kiosk/install.ps1" -OutFile $tryScript -UseBasicParsing
Invoke-WebRequest -Uri "{base}/kiosk/agent/dist/{wheel}" -OutFile $tryWheel -UseBasicParsing
powershell -NoProfile -ExecutionPolicy Bypass -File $tryScript -AgentWheel $tryWheel @args
"""


def tracked(prefix: str) -> list[str]:
    listed = subprocess.run(
        ["git", "ls-files", "-z", "--", prefix], cwd=REPO, capture_output=True, check=True
    )
    return [name for name in listed.stdout.decode().split("\0") if name]


def tarball(wheel: Path) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for name in [*KIOSK_FILES, *tracked("kiosk/files")]:
            tar.add(REPO / name, arcname=name)
        tar.add(wheel, arcname=f"kiosk/agent/dist/{wheel.name}")
    return buffer.getvalue()


def this_address() -> str:
    """This computer's address on its network: the one its default route leaves from (a UDP
    socket's connect sends nothing)."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
        try:
            probe.connect(("192.0.2.1", 9))
            return str(probe.getsockname()[0])
        except OSError:
            return "127.0.0.1"


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    wheels = sorted((REPO / "kiosk/agent/dist").glob("sunroom_kiosk-*-py3-none-any.whl"))
    if not wheels:
        print("No Sunroom Screen wheel in kiosk/agent/dist: run `just kiosk-build` first.")
        return 1
    wheel = wheels[-1]
    base = f"http://{this_address()}:{port}"
    files: dict[str, tuple[bytes, str]] = {
        "/install.sh": (BASH.format(base=base, wheel=wheel.name).encode(), "text/plain"),
        "/install.ps1": (POWERSHELL.format(base=base, wheel=wheel.name).encode(), "text/plain"),
        "/kiosk.tar.gz": (tarball(wheel), "application/gzip"),
        "/kiosk/install.ps1": ((REPO / "kiosk/install.ps1").read_bytes(), "text/plain"),
        f"/kiosk/agent/dist/{wheel.name}": (wheel.read_bytes(), "application/octet-stream"),
    }

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            found = files.get(self.path.split("?", 1)[0])
            if found is None:
                self.send_error(404)
                return
            body, kind = found
            self.send_response(200)
            self.send_header("Content-Type", kind)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving this checkout's installers and {wheel.name} on port {port}.")
    print("If macOS asks whether Python may accept incoming connections, allow it.\n")
    print("On a Linux computer or a Mac (options go after `bash -s --`):")
    print(f"  curl -fsSL {base}/install.sh | bash")
    print("On Windows, in PowerShell:")
    print(f'  powershell -ExecutionPolicy Bypass -c "irm {base}/install.ps1 | iex"')
    print("\nA virtual machine on this Mac can use the same address. Ctrl+C stops it.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
