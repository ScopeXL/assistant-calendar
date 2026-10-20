#!/bin/bash -e
# Sunroom OS's stage starts from Raspberry Pi OS Lite (stage2).
if [ ! -d "${ROOTFS_DIR}" ]; then
	copy_previous
fi
