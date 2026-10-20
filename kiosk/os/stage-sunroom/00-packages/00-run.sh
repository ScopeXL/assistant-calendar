#!/bin/bash -e
# Docker's own apt source, for Run It on This Screen (docker-ce and its compose plugin). Its key
# is fetched here, outside the image, and refused unless it is Docker's published release key.
KEY="${ROOTFS_DIR}/etc/apt/keyrings/docker.asc"
install -m 0755 -d "${ROOTFS_DIR}/etc/apt/keyrings"
curl -fsSL --retry 3 https://download.docker.com/linux/debian/gpg -o "${KEY}"
gpg --show-keys --with-colons "${KEY}" | grep -q '^fpr:::::::::9DC858229FC7DD38854AE2D88D81803C0EBFCD88:$'
chmod a+r "${KEY}"
install -m 0644 files/docker.sources "${ROOTFS_DIR}/etc/apt/sources.list.d/docker.sources"
