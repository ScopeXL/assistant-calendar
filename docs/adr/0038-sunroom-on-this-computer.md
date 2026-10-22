# ADR 0038: Sunroom on this computer

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

- With one command per computer (ADR 0037), the owner tried Sunroom Screen in virtual machines
  and asked for three things: a Linux screen that finds its Sunroom shouldn't show Chrome's "allow
  local network access" prompt; a word on the Chromium snap for Ubuntu; and Sunroom on any
  computer, chosen on the screen as the first thing it shows, between running Sunroom on this
  computer and using one that already runs elsewhere, each explained for someone who has never
  set up a server. `docs/M8.md` is the plan and the record; this ADR keeps its decisions.
- Before this, only a Sunroom OS screen could run Sunroom from the screen (Docker, set up by the
  image, M7 T16), a Pi could at install time (`--with-sunroom`, Docker), and the server shipped
  only as the Docker image. The backend already ran as a plain program on macOS and Linux in
  development; Windows needed a few changes.

## Decision

| Question | Decision |
|---|---|
| The Linux prompt | The installer puts the root helper on every Linux screen, and Sunroom Screen rewrites the browser's policy through it whenever the address changes, as on a Pi. |
| Ubuntu's browser | Google Chrome stays: the snap reads its policy from `/etc/chromium-browser/policies` only, its sandbox hides the screen's profile folder, and snapd shows a "close the app to update" notice on the screen for up to 14 days before updating a browser that never closes. |
| The first page | Two ways on, side by side: **On This Computer** (Run Sunroom Here) and **On Another Computer** (Find Your Sunroom), each saying what it is and when to choose it; Setting Up Sunroom shows the steps, and why a run stopped with Try Again. |
| How Sunroom runs on a computer | As a program for this user, installed by Sunroom Screen with uv from the release's server wheel (the backend with the built app inside) and constraints file, checked against `SHA256SUMS`; kept running by a systemd user service, a LaunchAgent, or on Windows by Sunroom Screen; kept awake while it runs. Docker stays for Sunroom OS, `--with-sunroom` on a Pi, and servers. |
| Which computers | 64-bit Linux and Raspberry Pi OS, Macs with Apple silicon, Windows (an x64 Python on ARM). Not Intel Macs, which `cryptography` (49 and later) no longer ships wheels for. |
| Releases and versions | The release's files gain the server wheel and its constraints. The repo's backend stays 0.0.0; the release workflow stamps the version into the wheel, and the server reads it from its package. |
| Updates and removal | Sunroom Screen keeps the program at its own version and Update Sunroom Too installs the newest; `sunroom-kiosk sunroom remove` takes it off, and the uninstallers ask before the family's data goes. |

## Consequences

- Packaging gains a third thing beside the image and Sunroom Screen: the server wheel. The
  backend gains a `computer` install kind and portable pieces for Windows (the instance lock, the
  restore's fsync, the restart after a restore, its messages and text files).
- A computer running Sunroom must stay on and reachable: the screen says so before it's chosen,
  and the program keeps the computer from sleeping while it runs. On Windows and macOS the first
  start may ask to let Sunroom accept connections; Setting Up Sunroom says to choose Allow.
- The backend's tests run in CI on Ubuntu only; Windows and macOS are checked by the owner's
  machines until CI runs them (a follow-up).
