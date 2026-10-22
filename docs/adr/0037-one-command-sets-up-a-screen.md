# ADR 0037: One command sets up a screen

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

- The owner tried Sunroom Screen on Linux, Windows and macOS (in virtual machines) and found the
  installers too complicated: the commands needed options (`--display-only`, `--url`), and a
  Linux computer or a Mac needed a browser installed by hand first ("Sunroom Screen needs
  Chromium, Google Chrome or Microsoft Edge, and none is installed"). Their request of
  2026-10-22: **one simple terminal command that installs everything the screen needs and starts
  the screen alone**; options are for extra features, such as running Sunroom too; the default
  needs no options, no address and no other commands first.
- What already held: the screen finds Sunroom by itself (DNS-SD and the sweep of its own network,
  ADR 0035), so an address was already optional; `install.ps1` was already one command that
  needed nothing first (Edge comes with Windows) and started the screen; a Pi's packages,
  Chromium among them, were already installed by the installer. What didn't: a Pi's default was
  Sunroom and the screen (PLAN §13.1 path a, kept first-class by ADR 0018), and a Linux
  computer or a Mac had to bring its own browser and answer a question before the screen
  started.

## Decision

| Question | Decision |
|---|---|
| The default | **The kitchen screen alone, everywhere**: `install.sh` with no option on a Pi, another Linux computer or a Mac, as `install.ps1` on Windows. The screen finds Sunroom on the network or asks for its address on the screen; `--url` still skips the search. |
| Sunroom too | **`--with-sunroom`**, a Pi only (what no option meant before); `--server-only` unchanged. Both are refused elsewhere, pointing at Docker (DEPLOY.md). `--display-only` stays, as the explicit form: commands in older notes use it, and it still makes a Pi that runs Sunroom the screen alone. With `--with-sunroom` or `--server-only`, `--url` is refused. Not chosen: `--all-in-one` or `--server` (the family's word is Sunroom). A Pi's summary says how to add Sunroom ("No Sunroom yet? Run the installer again with --with-sunroom"). |
| A Pi set up before | **A Pi that runs Sunroom keeps it** when the installer runs again with no option: its install state says `all` or `server` (`STATE_MODE`, written by every installer since 0.1.0; read in a child bash by `previous_mode`), and the plan says so. `--url` or `--display-only` still make it the screen alone. So "run the installer again" (KIOSK.md, the 0.13.0 upgrade) never quietly leaves a household's Sunroom unmanaged. A first run that failed before it saved its state has no state, so it needs its option again. |
| The browser on Linux | **Installed when there's none the screen can use**, with sudo: the system's own Chromium where its package is the browser itself (Debian and Raspberry Pi OS with apt, Fedora with dnf, openSUSE with zypper, Arch with pacman), else **Google Chrome's own package from Google** (`dl.google.com/linux/direct/google-chrome-stable_current_<arch>.deb` or `.rpm`, for 64-bit Intel and ARM). That is Ubuntu, whose `chromium-browser` (version `1snap1`) only installs the snap, and a dnf system without Chromium. Google's package adds Google's software source, so the system updates Chrome with everything else. Chrome for ARM64 Linux has been on Google's download page since mid-2026; all four files answered on 2026-10-22. Anything else stops with a plain line ("install Chromium, then run this again"). |
| Snaps | **A snap's browser is never used**, by the installer or by Sunroom Screen (`browser.is_snap`): a path under `/snap`, or a script that runs one, as Ubuntu's `/usr/bin/chromium-browser` is. The snap's sandbox hides `~/.config/sunroom-kiosk/profile` and the policy in `/etc`, so before this, an Ubuntu with the Chromium snap was "found" and then failed. |
| The browser on a Mac | **Google Chrome from Google's universal disk image** when there's no Chrome, Chromium or Edge in `/Applications` or `~/Applications`. It's copied out with `ditto --noextattr --norsrc` (the image's HFS+ volume reports empty Finder information on every file, which fails `codesign --strict` on a copy that keeps it), then checked with `codesign --verify --deep --strict` against **Google's Developer ID** (`anchor apple generic and certificate leaf[subject.OU] = "EQHXZ8M8AV"`) before it moves into place. It goes into `/Applications` when this account may write there (an administrator's may, with no password), else `~/Applications`, where Sunroom Screen now looks too. Still no administrator, and no password. A copy that fails the check is never installed. |
| Starting the screen | **Linux and the Mac start it at the end, without asking**, when a desktop is signed in, as Windows already did. On Linux: the desktop this runs on, or the one systemd's user manager knows (GNOME and KDE put its address there at sign-in, so it works over ssh too); on a Mac, the signed-in session. The installer says how to close it before it's paired (`systemctl --user stop sunroom-kiosk`; `launchctl bootout`), since This Screen's Quit is reached only after pairing. Before, both asked, with No the default. A Pi still asks before it restarts: the restart is what turns its screen on. |
| Windows | **Unchanged** but for options: `irm … \| iex` takes none, so the documented form with options is a script block made from the same download (`& ([scriptblock]::Create((irm …))) -Url …`), and the goodbye prints that form for `-Uninstall` when it ran from a download (it printed `-File install.ps1`, a file such a run doesn't have). |
| Trying a change | **`just kiosk-serve`** (`scripts/kiosk_serve.py`) builds the wheel and serves this checkout's installers, kiosk files and wheel on the local network, with each system's one line (`curl … \| bash`, `irm … \| iex`), so a virtual machine or another computer tries a change before a release with nothing from GitHub but uv. |

## Consequences

- README, KIOSK.md, DEPLOY.md §5, PLAN §13 and HARDWARE.md (rows 14, 23, 34, and 36 and 37 for
  this change) say the new commands; ADR 0018's deployment is unchanged (its Pi was always
  `--display-only`, now the default).
- Checked in containers on 2026-10-22: Debian 13 and Ubuntu 24.04 (arm64, systemd, a user with
  sudo, Xvfb standing in for the desktop) ran the whole installer with no option. Each installed
  Chromium or Google Chrome, then Sunroom Screen, then started the screen, which opened its own
  pages in that browser (Ubuntu with its snap wrapper installed, passed over by both). Fedora 42
  and openSUSE Tumbleweed installed Chromium. On macOS, the Chrome step installed into a scratch
  folder, and a wrong Developer ID was refused with nothing left behind. `install.ps1`: Windows
  PowerShell's script analyzer (in PowerShell 7) and its dry run from a file, from a script block
  and from `iex`. Not checked: a real Pi with the new default, Arch, Windows itself, and a real
  desktop session starting the screen.
- On Linux the browser's policy is still written once, by the installer, for the address it was
  given; a screen that finds its Sunroom itself (no `--url`, now the default) asks once, on the
  screen, before Sunroom may reach Sunroom Screen (Chrome's Local Network Access), as before.
  A root helper like the Pi's would remove that prompt; it's a follow-up, not part of this.
