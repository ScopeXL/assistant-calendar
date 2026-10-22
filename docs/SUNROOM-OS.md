# Sunroom OS

A memory card image for a Raspberry Pi that becomes a Sunroom kitchen screen: write it with
Raspberry Pi Imager, put it in the Pi, plug in the screen and the power, and follow the screen.
No terminal, no installer, no keyboard. The design is in [M7](M7.md) and
[ADR 0035](adr/0035-m7-sunroom-screen.md); what the screen does every day is in
[KIOSK.md](KIOSK.md).

## What you need

- A Raspberry Pi 5 or Pi 4 (2 GB or more; 4 GB to run Sunroom on it too), a memory card of 16 GB
  or more (an A2 card, or a USB SSD), the official power supply.
- A touch screen: HDMI for the picture and its USB cable for touch. [HARDWARE.md](HARDWARE.md)
  helps you choose.
- [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on a computer.

## Writing the card

1. Download `sunroom-os-X.Y.Z-pi-arm64.img.xz` from the newest
   [release on GitHub](https://github.com/ScopeXL/sunroom/releases/latest) (and its
   `.sha256`, to check it if you like).
2. In Imager: **Choose Device** (your Pi), **Choose OS → Use custom** → the file you downloaded,
   **Choose Storage** → the card, **Next**.

Or let Imager list it: **App Options → Content Repository → Use custom URL**, with
`https://github.com/ScopeXL/sunroom/releases/latest/download/imager.json`. Sunroom OS
then shows in **Choose OS**, always the newest, and Imager checks the download as it writes.

Imager may offer its own settings (Wi-Fi, the name on the network, the time zone, a user and
SSH). Use them if they're offered: Sunroom OS reads them on its first start. Whether this Imager
applies them to an image that isn't Raspberry Pi's own is checked per Imager version
([HARDWARE.md](HARDWARE.md), row 24); without them, the screen asks for the Wi-Fi itself.

## The first start

It shows the Sunroom mark, then Sunroom Screen's **Welcome** (in about a minute and a half):

1. **Where will your family's Sunroom run?** Two ways, each explained (ADR 0038). With no
   network yet, either one first asks to **Connect to Wi-Fi**: pick yours and type its password on
   the screen's keyboard (a network cable skips this).
   - **On This Computer** → **Run Sunroom Here**: Sunroom runs on this Pi, and the family uses it
     from their phones. It downloads Sunroom (a few minutes), starts it, and shows Sunroom's own
     setup with a QR code for a phone.
   - **On Another Computer** → **Find Your Sunroom**: **On Your Network** lists each Sunroom it
     finds (tap **Use This Sunroom**), or **Somewhere Else** takes the address you were given
     (**Check Address**).
2. The screen shows a six-character code: on a phone signed in to Sunroom, open **More → Pair a
   display** and type it.

From then on the screen looks after itself: it sleeps and dims on the household's times, comes
back by itself after a power cut, and **Settings → This Screen** (with the parent PIN) restarts
it, changes its Wi-Fi or address, turns it, and updates it.

## What's on the card

- Raspberry Pi OS Trixie Lite (64-bit) with the desktop's core (labwc on Wayland), logging in by
  itself as `sunroom`, an account with no password and no `sudo`, and the screen never blanking.
- Chromium, run full screen by **Sunroom Screen** (installed with uv, the same program
  `kiosk/install.sh` installs), with a managed policy: no sign-in, password or translation
  prompts, and Sunroom's page may reach Sunroom Screen without asking.
- Sunroom Screen's one root helper (`/usr/local/sbin/sunroom-kiosk-root`) and the sudoers rule
  that allows only it: the browser's policy, the system's updates, and Run Sunroom Here.
- Docker and `/opt/sunroom` (Sunroom's compose file, `.env` and `update.sh`), idle until On This
  Computer starts it; avahi, which announces a Sunroom running here to other screens.
- `unattended-upgrades` for the system's own updates; Sunroom Screen updates itself overnight
  (This Screen → Updates says Install overnight) and restarts the screen in the night only when an
  update needs it.
- The log kept in memory (the card lasts longer), Wi-Fi power saving off, the clock set before
  anything relies on it, and the sun mark while it starts.
- No SSH, no VNC, no password anyone could type. `/etc/sunroom-os` holds the version.

## A shell, if you must

Sunroom OS has no way in by default. To have one, set a user and turn on SSH in Imager's settings
before writing the card (when this Imager applies them); you can then `ssh` in as that user. The
screen's own log: `journalctl --user -u sunroom-kiosk` as `sunroom` (`sudo -u sunroom
XDG_RUNTIME_DIR=/run/user/1000 journalctl --user -u sunroom-kiosk`). For a Pi you want to tinker
with, write Raspberry Pi OS instead and run `kiosk/install.sh` ([KIOSK.md](KIOSK.md)).

## Building it

Each release's image is built on GitHub by `.github/workflows/sunroom-os.yml` (about an hour, on
an arm64 runner) and attached to the release with its `.sha256` and `imager.json`.

To build one yourself on a Mac with OrbStack (or any arm64 machine with Docker): `just
kiosk-image`. It builds Sunroom Screen's wheel, then `kiosk/os/build.sh`, which fetches pi-gen at
its pinned commit (`kiosk/os/.pi-gen`), adds our stage (`kiosk/os/stage-sunroom`) with
`kiosk/files` rendered into it, and runs pi-gen's `build-docker.sh`. The image lands in
`kiosk/os/deploy/`. About an hour and 20 GB the first time.

What's where:

| Path | What |
|---|---|
| `kiosk/os/config` | pi-gen's settings: Trixie, the `sunroom` user, no SSH, cloud-init on, xz |
| `kiosk/os/stage-sunroom/00-packages` | Docker's apt source (its key checked against Docker's fingerprint), the packages |
| `kiosk/os/stage-sunroom/01-sunroom` | The files (`00-run.sh`), the setup inside the image (`01-run-chroot.sh`), and the check (`02-run-chroot.sh`): the units, Sunroom Screen and Chromium run, the policy parses, the compose file and sudoers check, the desktop logs in by itself, the account is locked |
| `kiosk/os/plymouth` | The start-up splash |
| `kiosk/os/imager.py` | Imager's repository file for a built image |

pi-gen requires a password for the first user when the first-boot rename is off: `build.sh`
makes a random one for each build and keeps it nowhere, and the stage locks the account.
