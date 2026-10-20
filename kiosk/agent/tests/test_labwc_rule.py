"""kiosk/labwc-rule.py, loaded from its file: the pointer rule and real touch it always added, and
since 0.13.0 touch following a turned picture (``--rotate N``): mapped to the output when its
name is known, else a calibration matrix, never both, and all of it taken out by ``--remove``.
Each run on a temporary rc.xml. Synthetic data only."""

from __future__ import annotations

import importlib.machinery
import importlib.util
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from types import ModuleType
from typing import Any

SCRIPT = Path(__file__).resolve().parents[2] / "labwc-rule.py"


def _load() -> ModuleType:
    loader = importlib.machinery.SourceFileLoader("labwc_rule", str(SCRIPT))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    assert spec is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[loader.name] = module
    loader.exec_module(module)
    return module


rule: Any = _load()


def run(tmp_path: Path, *args: str) -> ET.Element:
    rc = tmp_path / "rc.xml"
    code = rule.main(
        [
            "--rc",
            str(rc),
            "--system-rc",
            str(tmp_path / "missing-system-rc.xml"),
            "--state",
            str(tmp_path / "state.json"),
            *args,
        ]
    )
    assert code == 0
    return ET.parse(rc).getroot()  # noqa: S314 - the test's own file


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def default_touch(root: ET.Element) -> ET.Element:
    return next(c for c in root if local(c.tag) == "touch" and "deviceName" not in c.attrib)


def matrix(root: ET.Element) -> str | None:
    for node in root.iter():
        if local(node.tag) == "calibrationMatrix":
            return (node.text or "").strip()
    return None


def test_with_the_output_named_touch_maps_to_it(tmp_path: Path) -> None:
    root = run(tmp_path, "--rotate", "90", "--output", "HDMI-A-1")
    assert default_touch(root).get("mapToOutput") == "HDMI-A-1"
    assert default_touch(root).get("mouseEmulation") == "no"
    assert matrix(root) is None  # never turned twice


def test_without_an_output_a_matrix_turns_touch(tmp_path: Path) -> None:
    root = run(tmp_path, "--rotate", "90")
    assert matrix(root) == "0 -1 1 1 0 0"
    assert "mapToOutput" not in default_touch(root).attrib
    root = run(tmp_path, "--rotate", "270")
    assert matrix(root) == "0 1 0 -1 0 1"
    assert sum(1 for c in root if local(c.tag) == "libinput") == 1  # replaced, not added
    root = run(tmp_path, "--rotate", "180")
    assert matrix(root) == "-1 0 1 0 -1 1"
    root = run(tmp_path, "--rotate", "0")
    assert matrix(root) is None


def test_landscape_again_unmaps_touch(tmp_path: Path) -> None:
    run(tmp_path, "--rotate", "90", "--output", "HDMI-A-1")
    root = run(tmp_path, "--rotate", "0", "--output", "HDMI-A-1")
    assert "mapToOutput" not in default_touch(root).attrib


def test_a_second_run_changes_nothing(tmp_path: Path) -> None:
    run(tmp_path, "--rotate", "90")
    first = (tmp_path / "rc.xml").read_text()
    run(tmp_path, "--rotate", "90")
    assert (tmp_path / "rc.xml").read_text() == first


def test_remove_takes_the_turning_out_too(tmp_path: Path) -> None:
    rc = tmp_path / "rc.xml"
    rc.write_text(
        '<?xml version="1.0"?>\n<openbox_config xmlns="http://openbox.org/3.4/rc">\n'
        '  <keyboard><keybind key="W-Return"/></keyboard>\n</openbox_config>\n'
    )
    run(tmp_path, "--rotate", "90")
    rc.write_text(rc.read_text().replace("W-Return", "W-Enter"))  # the user changes something
    assert rule.main(["--rc", str(rc), "--state", str(tmp_path / "state.json"), "--remove"]) == 0
    root = ET.parse(rc).getroot()  # noqa: S314 - the test's own file
    assert matrix(root) is None
    assert not any(local(c.tag) == "touch" for c in root)
    assert "W-Enter" in rc.read_text()
