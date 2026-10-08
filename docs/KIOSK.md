# The kitchen screen on a Raspberry Pi

How `kiosk/install.sh` turns a Raspberry Pi into Sunroom's wall screen, what it changes, and
what to do when something looks wrong. The design is in [PLAN §13](PLAN.md#13-setup-deployment-and-the-raspberry-pi-kiosk);
screen sleep and dimming (the `sunroom-screen` helper) arrive in M5, which also adds the hardware
test results.

## What you need

- A Raspberry Pi 4 or 5 with Raspberry Pi OS (64-bit) **with desktop**, Bookworm or Trixie,
  written with Raspberry Pi Imager. In Imager's settings, set the hostname (for example
  `sunroom`), your user, Wi-Fi, the time zone, and turn on SSH.
- A touch screen: HDMI for the picture and a USB cable for touch (without it, the picture shows
  but taps do nothing).
- The official power supply. Don't power a portable monitor from the Pi's USB ports.

## Install

Sign in to the Pi (at its desktop, or `ssh` in) and run one of these as your normal user, not
root; it asks for `sudo` itself.

| You want | Command |
|---|---|
| Sunroom and the screen on this Pi | `curl -fsSL https://raw.githubusercontent.com/ScopeXL/assistant-calendar/main/kiosk/install.sh \| bash` |
| Only the screen; Sunroom runs elsewhere | the same, then `\| bash -s -- --display-only --url https://calendar.example.com` (or `http://192.168.1.20:8080`) |
| Only Sunroom, no screen (Pi OS Lite) | the same with `--server-only` |

Use the address you open on a phone for `--url`. The installer finishes by printing the phone
address (and a QR code), then offers to restart. After the restart the screen shows a
six-character code: on a phone signed in to Sunroom, open **More → Pair a display** and type it.

Other options (`--help` lists them all):

- `--rotate 90|180|270` turns the picture for a screen mounted on its side (90 = left, 180 = upside
  down, 270 = right). Raspberry Pi's own **Screen Configuration** tool works too.
- `--force-hdmi 1920x1080` keeps the HDMI output on at that size even when the monitor is off at
  startup (see "Blank after a restart" below).
- `--output HDMI-A-2` picks the connector when two are in use.
- `--version X.Y.Z` installs that Sunroom version instead of the newest.
- `--x11` uses the older X11 desktop instead of labwc.

Running the installer again is safe: it keeps what is already right and replaces only its own
files. Its log is `~/.local/state/sunroom-kiosk/install.log`.

## What it changes

- Installs `chromium`, `curl`, `jq`, `qrencode` and the screen tools for the desktop (`wlr-randr`
  on labwc, `x11-xserver-utils` and `unclutter` on X11) when they are missing.
- Without `--display-only`: Docker (from `get.docker.com`), and Sunroom in
  `/opt/sunroom/docker-compose.yml` with its data in the `sunroom_data` volume, optional settings
  in `/opt/sunroom/.env`, and `/opt/sunroom/update.sh`.
- Logs in to the desktop by itself and turns off screen blanking (`raspi-config`).
- The launcher `~/.local/bin/sunroom-kiosk`, run by the user service `sunroom-kiosk.service`
  (restarted 3 seconds after any exit), and a timer that restarts the browser at about 04:00 to
  give back memory. Its settings are in `~/.config/sunroom-kiosk/config`; the browser profile,
  which holds the screen's pairing, is in `~/.config/sunroom-kiosk/profile`.
- On labwc: a block between `# >>> sunroom-kiosk` and `# <<< sunroom-kiosk <<<` in
  `~/.config/labwc/autostart`, and a window rule in `~/.config/labwc/rc.xml` that hides the
  pointer and gives Chromium real touch events (a copy from before is kept as
  `rc.xml.sunroom-backup`). On X11: `~/.config/autostart/sunroom-kiosk.desktop`.
- Turns off Wi-Fi power saving (`/etc/NetworkManager/conf.d/zz-sunroom-kiosk-wifi.conf`), which
  otherwise drops live updates.
- Turns on `systemd-time-wait-sync`, so the clock is set from the internet before it's relied on.
  The launcher also waits up to a minute for it, and the screen shows the server's time anyway.
- With `--force-hdmi`: two options in the kernel command line (`cmdline.txt`), with the original
  kept beside it.

`~/.local/state/sunroom-kiosk/install-state` records the changes to shared files, so the
uninstaller can put them back.

## Every day

- **Update Sunroom on the Pi:** `sudo /opt/sunroom/update.sh` (or `sudo /opt/sunroom/update.sh
  0.2.0` for exactly that version, which is also how to go back). Your family's data stays.
- **The screen's own log:** `journalctl --user -u sunroom-kiosk`.
- **Restart the browser:** `systemctl --user restart sunroom-kiosk`.
- **Remove the screen setup:** `bash ~/.local/share/sunroom-kiosk/uninstall.sh`. It asks before
  deleting the browser profile (and with it the pairing). `--purge` also deletes Sunroom and all
  its data from the Pi.

## When something looks wrong

**The desktop picture stays for more than two minutes.** The launcher waits for Sunroom to
answer. On a Pi that runs Sunroom, `sudo docker logs sunroom` says why it isn't up; with
`--display-only`, open the `--url` address on a phone. The launcher's log names the address it is
waiting for.

**The screen shows a code again.** Its sign-in was ended: a new household password, a new secret
key, a restore, or **Unpair** in Settings → Phones & screens. Pair it again from a phone.

**Taps land in the wrong place on a turned screen.** Touch doesn't always follow a rotated
output. Add a calibration matrix for touch devices to `~/.config/labwc/rc.xml`, inside
`<openbox_config>` (or `<labwc_config>`), then restart the Pi:

```xml
<libinput>
  <device category="touch">
    <calibrationMatrix>0 -1 1 1 0 0</calibrationMatrix>
  </device>
</libinput>
```

That matrix is for `--rotate 90`; if taps come out mirrored, use `0 1 0 -1 0 1` instead (the one
for 270). For 180 it is `-1 0 1 0 -1 1`.

**The rotation doesn't stick.** If you once saved a layout in Raspberry Pi's **Screen
Configuration**, the desktop may apply it after the installer's rotation. Set the rotation there
instead, and run the installer with `--rotate 0`.

**Blank after a restart, or the screen wakes right after going dark.** Some monitors that are off
when the Pi starts are never detected. Run the installer again with `--force-hdmi 1920x1080` (use
your screen's size).

**The pointer stays visible.** labwc hides it from version 0.8.4; bring the Pi up to date with
`sudo apt update && sudo apt full-upgrade`. On X11, `unclutter` hides it.

**`sunroom.local` doesn't open on a phone.** Use the numbered address the installer printed.
Phones on a VPN or on mobile data can't see `.local` names, and some routers block them.

**"This Pi's desktop uses Wayfire".** Older Bookworm images start Wayfire; the installer prints
the one line that switches to labwc.

**A keyboard is plugged in.** Alt+F4 closes the browser; it comes back by itself within a few
seconds. It's best not to leave a keyboard attached.
