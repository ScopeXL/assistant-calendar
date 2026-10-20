#!/bin/bash -e
# Sunroom OS's own check (docs/M7.md T17): what its first start relies on is here, and runs.
U=$(getent passwd 1000 | cut -d: -f1)
H=$(getent passwd 1000 | cut -d: -f6)
fail() {
	echo "Sunroom OS check failed: $*" >&2
	exit 1
}

test -f /etc/sunroom-os || fail "no /etc/sunroom-os"
test -f "$H/.config/systemd/user/sunroom-kiosk.service" || fail "no Sunroom Screen unit"
grep -q 'restart sunroom-kiosk.service' "$H/.config/labwc/autostart" || fail "the desktop doesn't start Sunroom Screen"
runuser -u "$U" -- env HOME="$H" "$H/.local/bin/sunroom-kiosk" --version || fail "Sunroom Screen doesn't run"
chromium --version || fail "Chromium doesn't run"
python3 -c 'import json; json.load(open("/etc/chromium/policies/managed/sunroom-kiosk.json"))' ||
	fail "the browser's policy isn't JSON"
visudo -cqf /etc/sudoers.d/sunroom-kiosk || fail "the sudoers rule doesn't check"
docker compose --project-directory /opt/sunroom -f /opt/sunroom/docker-compose.yml config --quiet ||
	fail "Sunroom's compose file doesn't check"
test "$(systemctl get-default)" = graphical.target || fail "it doesn't start the desktop"
grep -q "^autologin-user=$U$" /etc/lightdm/lightdm.conf || fail "the desktop doesn't log in by itself"
passwd -S "$U" | grep -q " L " || fail "the account isn't locked"
systemctl is-enabled --quiet docker.service || fail "Docker isn't enabled"
echo "Sunroom OS check: all good."
