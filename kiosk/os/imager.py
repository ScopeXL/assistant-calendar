#!/usr/bin/env python3
"""Raspberry Pi Imager's repository file for one Sunroom OS release (docs/SUNROOM-OS.md).

Imager → App Options → Content Repository → Use custom URL, with
https://github.com/ScopeXL/sunroom/releases/latest/download/imager.json, then lists
Sunroom OS: this release's image, its sizes, and the sha256 Imager checks as it writes the card.
Standard library only; the workflow runs it on the image it just built.

    python3 kiosk/os/imager.py VERSION IMAGE.img.xz OUT.json
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import lzma
import sys
from pathlib import Path
from typing import Any

REPO = "ScopeXL/sunroom"
ICON = f"https://raw.githubusercontent.com/{REPO}/main/frontend/public/icons/icon-192.png"
DESCRIPTION = (
    "The Sunroom kitchen screen: plug it in, join Wi-Fi, and find your family's Sunroom, "
    "or run it right on this screen."
)


def describe(version: str, image: Path, released: dt.date) -> dict[str, Any]:
    digest = hashlib.sha256()
    size = 0
    with lzma.open(image) as raw:
        for chunk in iter(lambda: raw.read(1 << 20), b""):
            digest.update(chunk)
            size += len(chunk)
    return {
        "os_list": [
            {
                "name": "Sunroom OS",
                "description": DESCRIPTION,
                "icon": ICON,
                "website": f"https://github.com/{REPO}",
                "url": f"https://github.com/{REPO}/releases/download/v{version}/{image.name}",
                "extract_size": size,
                "extract_sha256": digest.hexdigest(),
                "image_download_size": image.stat().st_size,
                "release_date": released.isoformat(),
                # Raspberry Pi OS Trixie's first start reads Imager's settings through cloud-init.
                "init_format": "cloudinit-rpi",
                "devices": ["pi5-64bit", "pi4-64bit"],
            }
        ]
    }


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    version, image, out = argv[0], Path(argv[1]), Path(argv[2])
    listing = describe(version, image, dt.datetime.now(dt.UTC).date())
    out.write_text(json.dumps(listing, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
