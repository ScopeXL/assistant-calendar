# ADR 0027: The wall, polished: one screen state, who dims, the update check, Download everything

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

- M5 (PLAN §15) finishes the wall: the Pi's screen sleeps and dims on the household's schedule,
  Sunroom can say when a new version is out, a family can take everything (photos included) off
  the server and put it back, and the portrait band and the M3 motion leftovers get their polish.
- Three parts have to agree about the screen: the server (the schedule), the page (Night, the
  evening dim) and, on a Pi, `kiosk/sunroom-screen`, which switches the panel itself. The panel
  can be dimmed twice (the page's veil over a monitor already turned down), and a dark screen
  must never be left with no way back.
- The update check sends a request off the server, so it has to be the household's choice.

## Decision

| Question | Decision |
|---|---|
| The screen's state | One rule, `domain/screen.py`: daytime on at 100; the evening dim on at its level; asleep off with Screen off, or on at 20 with the dim clock; tapped awake on at 100. The server works it out and serves it at `GET /api/display/state`, public and non-sensitive, with an etag over everything but the server's time |
| How the helper hears | A long-poll with the etag (`?wait=55&etag=`), not the SSE stream: a few lines of standard-library Python, simple through proxies and reconnects. A 30-second tick wakes the waiters only when the etag changes; `settings.changed` and a wake do too |
| Tap to wake | The page posts `POST /api/display/wake` (a kiosk's cookie only), which sets `awake_until` 2 minutes on, so the helper lights the panel. It lives in memory: a restart forgets it, which only means the screen sleeps again |
| Who dims | The launcher asks `sunroom-screen --method` and opens `/display?dimmer=screen` when the helper sets the panel's brightness (DDC/CI or a backlight), else `?dimmer=page`. The page keeps the choice in localStorage and draws its veil only with `page` |
| The evening dim | Only with a sleep time: it runs from its own time until sleep starts. Three levels (60, 40, 20%), default 40. There are no wake-minutes or restart-hour settings: a wake is 2 minutes, and the browser's nightly restart is the kiosk's 04:00 timer |
| A dark screen always comes back | The helper switches the screen on after five failed polls in a row (about 30 s) and when it stops, at full brightness (a DDC monitor keeps its setting). Never `xset -dpms`, which lights a sleeping screen; DPMS stays on with every timeout off. On a panel with a backlight, sleep switches only `bl_power`, which keeps its touch working |
| The update check | Off by default; `SUNROOM_UPDATE_CHECK=0` pins it off. An hourly tick asks GitHub's latest-release API through the guarded client once 24 hours have passed. The answer lives in memory, not a table, so a restart asks again. How to update is worded by `SUNROOM_INSTALL_KIND`. The server never updates itself |
| Download everything | One zip streamed as it's written: a worker thread writes 64 KB chunks with at most 8 waiting, so a slow phone holds the worker back instead of filling a Pi's memory. It holds a fresh verified database copy, the photo store's files and a manifest, never `photos/inbox`, `.orphans` or `secret.key`. The copy sits in `backups/.download/` only until it's in the zip, and goes however the download ends |
| Restore | It stays a command-line step with the server stopped (docs/RESTORE.md): a running server can't safely swap its own database, so there's no Restore button. It checks everything before it moves anything (the zip's names and manifest, `quick_check`, a revision this image knows), keeps the current files as `sunroom.pre-restore.<time>.db…`, and keeps photos already in place |
| Portrait's band | 28rem, three columns: the calendar's lines, then the plugins' blocks flowing through two CSS columns. Each Today block gets a `band` prop and makes itself compact there (Coming up shows one, Tonight one line, To do without its detail line) |
| "+2" flies | The Web Animations API on a fixed element, which the CSP allows (no inline styles), to the person's avatar in the Today panel, else their column's. With nowhere on screen to land it rises from the row as in M3; with Reduce Motion nothing flies |
| A long press | 500 ms held still (10 px of movement makes it a scroll), and the click its release makes is swallowed. Only a shortcut: Change list stays a button in the list's header |
| The outbound audit | `tests/test_ssrf_audit.py` pins the modules that may touch the network directly, the one place the guarded client is made, that no code passes a literal `allow_private=True`, and that outside plugins only the update check uses it. `test_boot.py` lists every table with a `credentials_enc` column, so a new one has to say what a key change does to it |

## Consequences

- `household` gains `dim_from`, `dim_level` and `update_check` (migration
  `202610082231_household_dim_and_update_check`). The display state has no `restart_at`
  (PLAN §13.5 updated).
- A Pi set up before 0.6.0 gets the helper by running the installer again; `update.sh` updates
  Sunroom, not the Pi's screen setup (docs/KIOSK.md says so).
- Whether labwc delivers a tap while `wlopm` has the output off, `ddcutil`'s output on Pi OS, and
  `bl_power` on the Touch Display 2 are checked only on real hardware: docs/HARDWARE.md's matrix
  waits for the owner. So does Google sign-in over a `.ts.net` address, which the owner deferred.
- A zip restored onto a new volume brings everything back except connected calendars' sign-ins,
  which ask to be connected again, unless `APP_SECRET_KEY` is the same.
- `inspect-backup` reads `.db` files only; `restore` checks a zip itself. The `.ics` export of
  PLAN §14.4 is still to come.
