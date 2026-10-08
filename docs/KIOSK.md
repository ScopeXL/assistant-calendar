# The kitchen screen on a Raspberry Pi

How `kiosk/install.sh` turns a Raspberry Pi into Sunroom's wall screen, what it changes, how the
screen sleeps and dims at night, and what to do when something looks wrong. The design is in
[PLAN §13](PLAN.md#13-setup-deployment-and-the-raspberry-pi-kiosk); what to buy, and the hardware
it has been tried on, is in [HARDWARE.md](HARDWARE.md).

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
- `--brightness auto|ddc|sysfs|none` picks how the screen is dimmed in the evening (see "Sleep
  and dimming" below); `auto` is right for most screens.
- `--no-screen-helper` leaves the screen itself on all night; the page still goes black or dim.
  It's for monitors whose touch stops working while the screen is off.
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
- Unless `--no-screen-helper`: the screen helper `~/.local/bin/sunroom-screen`, run by the user
  service `sunroom-screen.service`, which the desktop starts with the browser; and `wlopm` on
  labwc.
- For the brightness, depending on the screen: `ddcutil`, `i2c-dev` loaded at every start
  (`/etc/modules-load.d/sunroom-kiosk-i2c.conf`) and your user in the `i2c` group, for a monitor
  with DDC/CI; or a udev rule that lets the `video` group dim the backlight and switch it off
  (`/etc/udev/rules.d/90-sunroom-kiosk-backlight.rules`) and your user in `video`, for a panel
  with a backlight. Raspberry Pi OS's first user is usually in both groups already.
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

## Sleep and dimming

Set the times in Sunroom, on a phone or on the screen: **Settings → Display → Sleep**.

- **Sleep at night**, from and until a time. **While asleep** shows either a **Dim clock** (the
  time on black, with the screen turned down low) or **Screen off** (black, with the screen itself
  switched off).
- **Dim in the evening**: from a time until sleep starts, the screen is less bright (**A little**,
  **Half** or **Low**).
- **A tap wakes it** for 2 minutes, at full brightness.

The page does the part a browser can: the black screen, the dim clock, and on screens without the
helper a darker page in the evening. On the Pi, the screen helper (`sunroom-screen`) does the rest:
it asks Sunroom what the screen should be doing, switches the screen off and on, and sets its
brightness. A tap on the dark screen still reaches the page (most touch monitors keep their touch
working while the picture is off), the page tells Sunroom, and moments later the helper switches
the screen back on. The launcher opens `/display?dimmer=screen` when the helper sets the
brightness and `/display?dimmer=page` when it can't, so the page and the screen never both dim.

### How the brightness is set

The installer's `--brightness` decides; what it finds is saved in `~/.config/sunroom-kiosk/config`
and checked again each time the helper starts.

| `--brightness` | For | How |
|---|---|---|
| `auto` (the default) | Any screen | `sysfs` when the screen has a backlight the Pi controls, else `ddc` when the monitor answers, else `none` |
| `ddc` | HDMI monitors with DDC/CI (many 21–24" touch monitors) | `ddcutil` sets the monitor's own brightness over the HDMI cable |
| `sysfs` | Raspberry Pi Touch Display and other panels on the DSI connector | the backlight in `/sys/class/backlight`; at night only the backlight goes off, so the touch panel keeps working |
| `none` | Screens that misbehave with the others | the screen keeps its own brightness; the page darkens itself in the evening |

`~/.local/bin/sunroom-screen --method` prints what the helper uses here (`ddc`, `sysfs` or
`none`), and so does the first line of its log. Many monitors come with DDC/CI switched off: look
for "DDC/CI" in the monitor's own menu, turn it on, then run the installer again (it looks for
the monitor while installing, so leave the monitor on). `sudo ddcutil detect` shows whether the
Pi can reach it. Portable USB-C monitors rarely have DDC/CI, so they get `none`.

To switch the screen off, the helper uses `wlopm` on labwc (or `wlr-randr` when `wlopm` is
missing; a tap may not wake the screen then, so install it with `sudo apt install wlopm`), and
`xset dpms force off` on X11. With `sysfs`, only the backlight is switched off.

### When touch stops working while the screen is off

A few monitors switch their touch off together with the picture, so a tap can't wake them before
the morning. Run the installer again with `--no-screen-helper`: at night the page still goes black
or shows the dim clock, and the screen itself stays on (**Dim clock** suits these screens best).

### If Sunroom can't be reached

The helper tries again after 2 seconds, then waits longer each time, up to a minute. After about
half a minute without an answer it switches the screen on, and when it stops, or is removed, it
leaves the screen on at full brightness: a dark screen that can't wake up is worse than a lit one.
As soon as Sunroom answers again, the screen follows the schedule again.

### The helper's log

`journalctl --user -u sunroom-screen` has one line per change, for example:

```text
Following the screen's sleep times from http://localhost:8080; brightness through DDC/CI on I2C bus 20.
Brightness 40%: evening dim.
Screen off: sleep time.
Screen on: tapped awake for 2 minutes.
```

### A Pi set up with Sunroom 0.5.0 or earlier

Run the installer again with the options you used the first time (for example `--display-only
--url …`), then let it restart the Pi. It keeps what is already right, adds the screen helper and
its service, and finds the brightness method. `update.sh` alone doesn't add the helper: it updates
Sunroom, not the Pi's screen setup.

## Every day

- **Update Sunroom on the Pi:** `sudo /opt/sunroom/update.sh` (or `sudo /opt/sunroom/update.sh
  0.2.0` for exactly that version, which is also how to go back). Your family's data stays.
- **The screen's own log:** `journalctl --user -u sunroom-kiosk`; the screen helper's:
  `journalctl --user -u sunroom-screen`.
- **Restart the browser:** `systemctl --user restart sunroom-kiosk`; the helper:
  `systemctl --user restart sunroom-screen` (it switches the screen on while it restarts).
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

**The screen doesn't go dark at night.** Check the times and **While asleep** in Settings →
Display → Sleep (**Dim clock** keeps the screen on, turned down). Then read the helper's log: "No
answer from Sunroom" means the Pi can't reach the address in `~/.config/sunroom-kiosk/config`; a
line ending in "didn't work" names the command that failed.

**The evening dim makes the page darker but not the screen.** The helper found no way to set the
brightness (`sunroom-screen --method` says `none`). Turn on DDC/CI in the monitor's menu and run
the installer again, or keep the page's dimming.

**A tap doesn't wake the dark screen.** The monitor's touch sleeps with its picture: see "When
touch stops working while the screen is off" above.

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
