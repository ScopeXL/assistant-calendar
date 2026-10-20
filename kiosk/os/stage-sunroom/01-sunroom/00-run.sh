#!/bin/bash -e
# Sunroom OS's files (docs/SUNROOM-OS.md): kiosk/files as kiosk/os/build.sh rendered them into
# files/kiosk, Sunroom Screen's wheel, the sun mark, and the image's own settings.
K=files/kiosk
H="${ROOTFS_DIR}/home/${FIRST_USER_NAME}"

# Root's: the helper and the one sudo rule that lets the screen's user run it, the screen's
# brightness and Wi-Fi settings, Sunroom itself for Run It on This Screen, and its announcement.
install -D -m 0755 "$K/sunroom-kiosk-root" "${ROOTFS_DIR}/usr/local/sbin/sunroom-kiosk-root"
install -D -m 0440 "$K/sudoers-sunroom-kiosk" "${ROOTFS_DIR}/etc/sudoers.d/sunroom-kiosk"
install -D -m 0644 "$K/90-sunroom-kiosk-backlight.rules" "${ROOTFS_DIR}/etc/udev/rules.d/90-sunroom-kiosk-backlight.rules"
install -D -m 0644 "$K/sunroom-kiosk-i2c.conf" "${ROOTFS_DIR}/etc/modules-load.d/sunroom-kiosk-i2c.conf"
install -D -m 0644 "$K/zz-sunroom-kiosk-wifi.conf" "${ROOTFS_DIR}/etc/NetworkManager/conf.d/zz-sunroom-kiosk-wifi.conf"
install -D -m 0644 "$K/sunroom.service" "${ROOTFS_DIR}/usr/local/share/sunroom-kiosk/sunroom.service"
install -D -m 0644 files/uv-version "${ROOTFS_DIR}/usr/local/share/sunroom-kiosk/uv-version"
install -D -m 0644 "$K/docker-compose.yml" "${ROOTFS_DIR}/opt/sunroom/docker-compose.yml"
install -D -m 0600 "$K/env" "${ROOTFS_DIR}/opt/sunroom/.env"
install -D -m 0755 "$K/update.sh" "${ROOTFS_DIR}/opt/sunroom/update.sh"
install -D -m 0644 files/sunroom-os "${ROOTFS_DIR}/etc/sunroom-os"
install -D -m 0644 files/journald-sunroom-os.conf "${ROOTFS_DIR}/etc/systemd/journald.conf.d/sunroom-os.conf"
install -D -m 0644 files/52sunroom-os-unattended-upgrades "${ROOTFS_DIR}/etc/apt/apt.conf.d/52sunroom-os-unattended-upgrades"
install -D -m 0644 files/21sunroom-os-auto-upgrades "${ROOTFS_DIR}/etc/apt/apt.conf.d/21sunroom-os-auto-upgrades"
install -d -m 0755 "${ROOTFS_DIR}/usr/share/plymouth/themes/sunroom"
install -m 0644 files/plymouth/* "${ROOTFS_DIR}/usr/share/plymouth/themes/sunroom/"

# The screen's user's own (the first user, uid 1000): Sunroom Screen's unit, the desktop's
# autostart that starts it, labwc's pointer and touch rule, and the wheel it's installed from.
for dir in .config .config/systemd .config/systemd/user .config/labwc .local .local/share \
	.local/share/sunroom-kiosk .local/share/sunroom-kiosk/wheels .local/state; do
	install -d -o 1000 -g 1000 -m 0755 "${H}/${dir}"
done
install -o 1000 -g 1000 -m 0644 "$K/sunroom-kiosk.service" "${H}/.config/systemd/user/sunroom-kiosk.service"
install -o 1000 -g 1000 -m 0644 "$K/autostart-block" "${H}/.config/labwc/autostart"
install -o 1000 -g 1000 -m 0755 "$K/labwc-rule.py" "${H}/.local/share/sunroom-kiosk/labwc-rule.py"
install -o 1000 -g 1000 -m 0644 files/wheel/*.whl "${H}/.local/share/sunroom-kiosk/wheels/"
