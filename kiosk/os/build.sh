#!/usr/bin/env bash
# Builds Sunroom OS (docs/SUNROOM-OS.md): Raspberry Pi OS Trixie Lite, the desktop's core,
# Chromium, Docker and Sunroom Screen, with pi-gen at a pinned commit, in Docker. `just
# kiosk-image` runs it on a Mac (OrbStack is arm64, so no emulation), and
# .github/workflows/sunroom-os.yml on GitHub's arm64 runner. The image and its checksum land in
# kiosk/os/deploy/.
#
#   kiosk/os/build.sh WHEEL [--prepare-only]
#
# WHEEL is Sunroom Screen's wheel for this VERSION (`just kiosk-build`, or the Release's).
# --prepare-only assembles the pi-gen checkout (kiosk/os/.pi-gen) and stops before the build.

set -euo pipefail

PI_GEN_REPO="RPi-Distro/pi-gen"
PI_GEN_COMMIT="d346cd53562b3c6b4f94c9155175f814258c456d" # its arm64 branch, 2026-10-06
CONTAINER="sunroom-os-build"

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
WORK="$HERE/.pi-gen"
DEPLOY="$HERE/deploy"
VERSION=$(cat "$ROOT/VERSION")
NAME="sunroom-os-$VERSION-pi-arm64"

die() {
	printf '%s\n' "$@" >&2
	exit 1
}

wheel=${1:-}
[[ -f $wheel ]] || die "Usage: kiosk/os/build.sh WHEEL [--prepare-only] (the wheel: just kiosk-build)"
[[ $(basename "$wheel") == "sunroom_kiosk-$VERSION-py3-none-any.whl" ]] ||
	die "$wheel isn't Sunroom Screen $VERSION's wheel."
uv_version=$(sed -n 's/^UV_VERSION="\([^"]*\)".*/\1/p' "$ROOT/kiosk/install.sh")
[[ -n $uv_version ]] || die "kiosk/install.sh has no UV_VERSION."

# pi-gen at the pinned commit (a tarball of exactly that tree), fresh each time.
rm -rf "$WORK"
mkdir -p "$WORK"
curl -fsSL --retry 3 "https://codeload.github.com/$PI_GEN_REPO/tar.gz/$PI_GEN_COMMIT" |
	tar -xz -C "$WORK" --strip-components=1

# Our stage, and what it installs: kiosk/files rendered as kiosk/install.sh renders them, for the
# image's own user and the Sunroom version it ships beside.
cp -R "$HERE/stage-sunroom" "$WORK/stage-sunroom"
files="$WORK/stage-sunroom/01-sunroom/files"
mkdir -p "$files/kiosk" "$files/wheel" "$files/plymouth"
render() {
	sed -e "s|@VERSION@|$VERSION|g" \
		-e "s|@USER@|sunroom|g" \
		-e "s|@IMAGE@|scopexl/sunroom|g" \
		-e "s|@TAG@|$VERSION|g" \
		-e "s|@PORT@|8080|g" \
		-e "s|@TZ@|Etc/UTC|g" \
		-e "s|@ADVERTISED@|http://sunroom.local:8080|g" \
		-e "s|@HOME@|/home/sunroom|g" \
		-e "s|@NOTE@|Written by the Sunroom OS $VERSION image, announced once Sunroom runs here.|g" \
		"$1"
}
k="$ROOT/kiosk"
render "$k/files/sunroom-kiosk-root" >"$files/kiosk/sunroom-kiosk-root"
render "$k/files/sudoers/sunroom-kiosk" >"$files/kiosk/sudoers-sunroom-kiosk"
render "$k/files/udev/90-sunroom-kiosk-backlight.rules" >"$files/kiosk/90-sunroom-kiosk-backlight.rules"
render "$k/files/modules-load/sunroom-kiosk-i2c.conf" >"$files/kiosk/sunroom-kiosk-i2c.conf"
render "$k/files/NetworkManager/zz-sunroom-kiosk-wifi.conf" >"$files/kiosk/zz-sunroom-kiosk-wifi.conf"
render "$k/files/avahi/sunroom.service" >"$files/kiosk/sunroom.service"
render "$k/files/sunroom/docker-compose.yml" >"$files/kiosk/docker-compose.yml"
render "$k/files/sunroom/env" >"$files/kiosk/env"
render "$k/files/systemd/sunroom-kiosk.service" >"$files/kiosk/sunroom-kiosk.service"
render "$k/files/labwc/autostart-block" >"$files/kiosk/autostart-block"
cp "$k/update.sh" "$k/labwc-rule.py" "$files/kiosk/"
cp "$wheel" "$files/wheel/"
cp "$HERE/plymouth/sunroom.plymouth" "$HERE/plymouth/sunroom.script" "$files/plymouth/"
cp "$ROOT/frontend/public/icons/icon-192.png" "$files/plymouth/sunroom.png"
printf '%s\n' "$VERSION" >"$files/sunroom-os"
printf '%s\n' "$uv_version" >"$files/uv-version"

# Raspberry Pi OS Lite isn't exported on the way; the config, with this version and a password
# nobody keeps (pi-gen requires one; the stage locks the account).
touch "$WORK/stage2/SKIP_IMAGES"
password=$(LC_ALL=C tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 40 || true)
sed -e "s|@VERSION@|$VERSION|g" -e "s|@PASSWORD@|$password|g" "$HERE/config" >"$WORK/config"

if [[ ${2:-} == --prepare-only ]]; then
	printf 'Prepared %s for Sunroom OS %s.\n' "$WORK" "$VERSION"
	exit 0
fi

# pi-gen's own Docker build (privileged: it mounts loop devices). A build stopped halfway leaves
# its container behind; this one is ours, so it goes.
# The host's /dev too: the image's loop partitions appear only there (inside a Docker VM such as
# OrbStack, mkdosfs can't open /dev/loop0p1 without it).
docker=${DOCKER:-docker}
"$docker" rm -v "$CONTAINER" >/dev/null 2>&1 || true
(
	cd "$WORK"
	CONTAINER_NAME="$CONTAINER" GIT_HASH="$PI_GEN_COMMIT" \
		PIGEN_DOCKER_OPTS="${PIGEN_DOCKER_OPTS:---volume /dev:/dev}" ./build-docker.sh
)

mkdir -p "$DEPLOY"
cp "$WORK/deploy/$NAME.img.xz" "$DEPLOY/"
(
	cd "$DEPLOY"
	if command -v sha256sum >/dev/null; then sha256sum "$NAME.img.xz"; else shasum -a 256 "$NAME.img.xz"; fi
) >"$DEPLOY/$NAME.img.xz.sha256"
printf 'Built %s\n' "$DEPLOY/$NAME.img.xz"
