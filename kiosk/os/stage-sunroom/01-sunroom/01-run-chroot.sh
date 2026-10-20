#!/bin/bash -e
# Sunroom OS, set up inside the image (docs/SUNROOM-OS.md): the screen's user, Sunroom Screen,
# the desktop, the start, and what runs at night.
U=$(getent passwd 1000 | cut -d: -f1)
H=$(getent passwd 1000 | cut -d: -f6)
as_user() { runuser -u "$U" -- env HOME="$H" "$@"; }

# The account only logs in to the desktop: no password anyone could type, and no sudo but the
# one rule for Sunroom Screen's root helper.
passwd -l "$U"
gpasswd -d "$U" sudo || true

# uv, pinned (kiosk/install.sh's version), for everyone; Sunroom Screen with it, for the screen.
curl -LsSf --retry 3 "https://astral.sh/uv/$(cat /usr/local/share/sunroom-kiosk/uv-version)/install.sh" |
	env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh
as_user /usr/local/bin/uv tool install --python 3.14 "$H"/.local/share/sunroom-kiosk/wheels/sunroom_kiosk-*.whl
as_user /usr/local/bin/uv cache clean

# The browser's policy, quiet from the first start (Sunroom Screen adds the address it shows).
install -d -m 0755 /etc/chromium/policies/managed
as_user "$H/.local/bin/sunroom-kiosk" policy >/etc/chromium/policies/managed/sunroom-kiosk.json

# labwc: the pointer hidden and touch as touch (the installer's rule).
as_user python3 "$H/.local/share/sunroom-kiosk/labwc-rule.py" --installer-version "$(cat /etc/sunroom-os)"

# The desktop logs in by itself and never blanks; the clock is set before anything relies on it.
SUDO_USER="$U" raspi-config nonint do_boot_behaviour B4
SUDO_USER="$U" raspi-config nonint do_blanking 1 || true
systemctl enable systemd-time-wait-sync.service

# Docker waits for Run It on This Screen; avahi announces a Sunroom only once one runs here.
systemctl enable docker.service avahi-daemon.service

# The sun mark while it starts (pi-gen's export makes the initramfs, with this theme in it).
plymouth-set-default-theme sunroom
if ! grep -q ' splash' /boot/firmware/cmdline.txt; then
	sed -i '1 s/$/ quiet splash plymouth.ignore-serial-consoles/' /boot/firmware/cmdline.txt
fi
