#!/usr/bin/env python3
"""Release helpers used by the deploy skill (docs/PLAN.md §14.5, docs/RELEASING.md).

  release.py bump patch|minor|major   VERSION, the installers' versions (install.sh,
                                      install.ps1), Sunroom Screen's version (its pyproject.toml
                                      and uv.lock), CHANGELOG section + links, released.lock
  release.py tag [--trailer TEXT]     commit the release files, tag vX.Y.Z, push atomically
  release.py github                   the tag's GitHub Release, its CHANGELOG section as the
                                      notes (the release-assets workflow uploads its files)

`tag` refuses unless the only changes since `just preflight` are the release files. If its push
fails after the commit and tag are made, run `tag` again: it pushes them and never re-tags.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import NoReturn

REPO = Path(__file__).resolve().parent.parent
VERSION_FILE = REPO / "VERSION"
CHANGELOG = REPO / "CHANGELOG.md"
MIGRATIONS = REPO / "backend" / "src" / "sunroom" / "migrations"
LOCK = MIGRATIONS / "released.lock"
STAMP = REPO / ".git" / "sunroom-preflight"
# The Pi installer is fetched from main, so it carries the released version (check_release_meta).
KIOSK_INSTALLER = REPO / "kiosk" / "install.sh"
KIOSK_VERSION = re.compile(r'^KIOSK_VERSION="[^"]*"', re.MULTILINE)
# The Windows installer is fetched from main too.
KIOSK_INSTALLER_WINDOWS = REPO / "kiosk" / "install.ps1"
KIOSK_VERSION_WINDOWS = re.compile(r'^(\s*)\$KioskVersion = "[^"]*"', re.MULTILINE)
# Sunroom Screen's wheel is named for its version, and its updates compare versions, so it
# carries VERSION too: in its pyproject.toml and in its own entry of uv.lock (`uv sync --locked`).
AGENT_PYPROJECT = REPO / "kiosk" / "agent" / "pyproject.toml"
AGENT_LOCK = REPO / "kiosk" / "agent" / "uv.lock"
AGENT_VERSION = re.compile(r'^(\[project\]\n(?:(?!\[).*\n)*?version = )"[^"]*"', re.MULTILINE)
AGENT_LOCK_VERSION = re.compile(r'^(name = "sunroom-kiosk"\nversion = )"[^"]*"', re.MULTILINE)
RELEASE_FILES = {
    "VERSION",
    "CHANGELOG.md",
    "backend/src/sunroom/migrations/released.lock",
    "kiosk/install.sh",
    "kiosk/install.ps1",
    "kiosk/agent/pyproject.toml",
    "kiosk/agent/uv.lock",
}
GITHUB = "https://github.com/ScopeXL/assistant-calendar"
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=REPO, capture_output=True, text=True, check=True
    ).stdout.strip()


def fail(message: str) -> NoReturn:
    print(f"release: {message}", file=sys.stderr)
    raise SystemExit(1)


def current_version() -> str:
    version = VERSION_FILE.read_text().strip()
    if not SEMVER.match(version):
        fail(f"VERSION is not X.Y.Z: {version!r}")
    return version


def next_version(version: str, level: str) -> str:
    match = SEMVER.match(version)
    assert match
    major, minor, patch = (int(part) for part in match.groups())
    if level == "major":
        return f"{major + 1}.0.0"
    if level == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def unreleased_body(text: str) -> tuple[int, int, str]:
    start = text.index("## [Unreleased]")
    after = text.index("\n", start) + 1
    next_heading = text.find("\n## [", after)
    links = text.find("\n[Unreleased]:", after)
    ends = [pos for pos in (next_heading, links) if pos != -1]
    end = min(ends) if ends else len(text)
    return after, end, text[after:end]


def bump(level: str) -> None:
    old = current_version()
    new = next_version(old, level)
    text = CHANGELOG.read_text()
    after, end, body = unreleased_body(text)
    if not re.search(r"^- ", body, re.MULTILINE):
        fail("CHANGELOG [Unreleased] has no entries; write the release notes first.")
    today = dt.date.today().isoformat()
    text = text[:after] + f"\n## [{new}] - {today}\n" + body.rstrip("\n") + "\n" + text[end:]
    text = re.sub(r"^\[Unreleased\]: .*\n?", "", text, flags=re.MULTILINE).rstrip("\n") + "\n"
    first_release = old == "0.0.0"
    compare = f"{GITHUB}/releases/tag/v{new}" if first_release else f"{GITHUB}/compare/v{old}...v{new}"
    text += f"\n[Unreleased]: {GITHUB}/compare/v{new}...HEAD\n[{new}]: {compare}\n"
    text = re.sub(r"\n{3,}", "\n\n", text)
    CHANGELOG.write_text(text)
    VERSION_FILE.write_text(new + "\n")
    installer = KIOSK_INSTALLER.read_text()
    if not KIOSK_VERSION.search(installer):
        fail("kiosk/install.sh has no KIOSK_VERSION line")
    KIOSK_INSTALLER.write_text(KIOSK_VERSION.sub(f'KIOSK_VERSION="{new}"', installer, count=1))
    windows = KIOSK_INSTALLER_WINDOWS.read_text()
    if not KIOSK_VERSION_WINDOWS.search(windows):
        fail("kiosk/install.ps1 has no $KioskVersion line")
    KIOSK_INSTALLER_WINDOWS.write_text(
        KIOSK_VERSION_WINDOWS.sub(
            lambda found: f'{found.group(1)}$KioskVersion = "{new}"', windows, count=1
        )
    )
    for path, pattern in ((AGENT_PYPROJECT, AGENT_VERSION), (AGENT_LOCK, AGENT_LOCK_VERSION)):
        text = path.read_text()
        if not pattern.search(text):
            fail(f"{path.relative_to(REPO)} has no Sunroom Screen version line")
        path.write_text(pattern.sub(lambda found: f'{found.group(1)}"{new}"', text, count=1))
    locked = {
        line.split()[0]
        for line in LOCK.read_text().splitlines()
        if line.strip() and not line.startswith("#")
    }
    added = []
    for path in sorted((MIGRATIONS / "versions").glob("*.py")):
        revision = path.name.split("_", 1)[0]
        if revision not in locked:
            digest = hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()
            added.append(f"{revision} {digest}")
    if added:
        with LOCK.open("a") as handle:
            handle.write("\n".join(added) + "\n")
    print(f"Bumped {old} -> {new}. Locked {len(added)} migration(s). Review CHANGELOG.md.")


def release_notes(version: str) -> str:
    text = CHANGELOG.read_text()
    start = text.index(f"## [{version}]")
    after = text.index("\n", start) + 1
    end = text.find("\n## [", after)
    links = text.find("\n[Unreleased]:", after)
    ends = [pos for pos in (end, links) if pos != -1]
    return text[after : min(ends) if ends else len(text)].strip()


def tag(trailer: str | None) -> None:
    # The deploy skill runs this without a terminal: fail rather than wait for a password prompt.
    os.environ["GIT_TERMINAL_PROMPT"] = "0"
    if not STAMP.is_file():
        fail("run `just preflight` first")
    stamped_tree = STAMP.read_text().strip()
    changed = set(git("diff", "--name-only", stamped_tree).splitlines())
    untracked = set(git("ls-files", "--others", "--exclude-standard").splitlines())
    unexpected = (changed | untracked) - RELEASE_FILES
    if unexpected:
        fail("files changed since preflight: " + ", ".join(sorted(unexpected)))
    if git("rev-parse", "--abbrev-ref", "HEAD") != "main":
        fail("releases are tagged on main")
    version = current_version()
    name = f"v{version}"
    if git("tag", "--list", name):
        resume(name)
        return
    git("add", *sorted(p for p in RELEASE_FILES if (REPO / p).exists()))
    message = f"Release {name}"
    if trailer:
        message += f"\n\n{trailer}"
    git("commit", "-m", message)
    git("tag", "-a", name, "-m", f"Sunroom {name}\n\n{release_notes(version)}")
    push(name)


def resume(name: str) -> None:
    """Push a release that an earlier run committed and tagged but couldn't push."""
    if git("status", "--porcelain"):
        fail(f"{name} is already tagged here; commit or discuss the uncommitted changes first")
    if on_github(name):
        fail(f"{name} is already on GitHub; carry on with `just smoke-image {name}`")
    if git("log", "-1", "--format=%s", name) != f"Release {name}":
        fail(f"tag {name} exists but isn't on a release commit")
    if subprocess.run(["git", "merge-base", "--is-ancestor", name, "HEAD"], cwd=REPO).returncode:
        fail(f"tag {name} isn't on main")
    print(f"{name} was committed and tagged earlier but never pushed. Pushing it now.", flush=True)
    push(name)


def on_github(name: str) -> bool:
    listed = subprocess.run(
        ["git", "ls-remote", "--tags", "origin", f"refs/tags/{name}"],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    if listed.returncode:
        fail(f"can't reach GitHub ({listed.stderr.strip()}); see docs/RELEASING.md")
    return bool(listed.stdout.strip())


def push(name: str) -> None:
    if subprocess.run(["git", "push", "--atomic", "origin", "main", name], cwd=REPO).returncode:
        fail(
            f"{name} is committed and tagged on this machine, but the push failed (git's message "
            'is above; for access problems see docs/RELEASING.md, "Pushing to GitHub"). Fix it, '
            "then run `just release-tag` again: it pushes the same commit and tag."
        )
    STAMP.unlink()
    print(f"Tagged and pushed {name}.")


def gh(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["gh", *args], cwd=REPO, capture_output=True, text=True)


def github() -> None:
    """The GitHub Release for VERSION's tag, with its CHANGELOG section as the notes. Nothing is
    uploaded from here: the release-assets workflow builds the files on GitHub and adds them (it
    makes a draft of its own when no Release turns up within 10 minutes; this publishes it)."""
    version = current_version()
    name = f"v{version}"
    if not on_github(name):
        fail(f"{name} isn't on GitHub yet; run `just release-tag` first")
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as handle:
        handle.write(release_notes(version) + "\n")
    notes = handle.name
    try:
        draft = gh("release", "view", name, "--json", "isDraft", "--jq", ".isDraft")
        if draft.returncode == 0 and draft.stdout.strip() == "false":
            print(f"The GitHub Release {name} is already published.")
        elif draft.returncode == 0:
            made = gh("release", "edit", name, "--draft=false", "--title", name, "--notes-file", notes)
            if made.returncode:
                fail(f"couldn't publish the draft Release {name}: {made.stderr.strip()}")
            print(f"Published the draft GitHub Release {name}.")
        else:
            made = gh(
                "release", "create", name, "--verify-tag", "--title", name, "--notes-file", notes
            )
            if made.returncode:
                fail(
                    f"couldn't make the GitHub Release {name}: {made.stderr.strip()} "
                    '(is `gh auth status` signed in? docs/RELEASING.md, "One-time setup")'
                )
            print(f"Made the GitHub Release {name}; release-assets.yml adds its files.")
    finally:
        os.unlink(notes)
    url = gh("release", "view", name, "--json", "url", "--jq", ".url").stdout.strip()
    print(f"Release: {url or f'{GITHUB}/releases/tag/{name}'}")


def main() -> None:
    parser = argparse.ArgumentParser(prog="release.py")
    sub = parser.add_subparsers(dest="command", required=True)
    bump_parser = sub.add_parser("bump")
    bump_parser.add_argument("level", choices=["patch", "minor", "major"])
    tag_parser = sub.add_parser("tag")
    tag_parser.add_argument("--trailer")
    sub.add_parser("github")
    args = parser.parse_args()
    if args.command == "bump":
        bump(args.level)
    elif args.command == "github":
        github()
    else:
        tag(args.trailer)


if __name__ == "__main__":
    main()
