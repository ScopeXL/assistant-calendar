# ADR 0040: The screen keeps its pairing: Edge without its kiosk mode, cookies written at once

- **Status:** Accepted
- **Date:** 2026-10-23

## Context

- The owner paired kitchen screens in virtual machines before the next deploy. On Windows the
  screen asked to be paired again after every restart. A Mac asked once, after its first restart
  following the pairing, and kept it from then on. Debian never asked.
- A screen's pairing is Sunroom's session cookie in the browser's profile (ADR 0006), which
  Sunroom Screen keeps in its own folder (ADR 0035).
- What Chromium does with a new cookie, tried with Google Chrome 155 on a throwaway profile: it
  writes cookies to disk every 30 seconds, or as soon as more than 512 changes are waiting, or
  when it is closed through DevTools (`Browser.close`). A cookie set a second before a SIGTERM
  was lost, though Chrome exited cleanly; so was one set a second before a kill. One set 35
  seconds before a kill was kept. Systems that shut down a browser directly (systemd's SIGTERM,
  Windows ending its session, a Mac logging out) most likely take the same quick way.
- Three causes in Sunroom Screen, found in the code and Microsoft's documentation:
  - On Windows the screen ran Edge in its kiosk mode (`--kiosk --edge-kiosk-type=fullscreen`).
    Microsoft's "Configure Microsoft Edge kiosk mode" says both of its kiosk types run an
    InPrivate session, and plain `--kiosk` opens one too, so Edge forgot the pairing, the
    remembered view and the offline copy every time it closed. That includes every restart and
    the browser's nightly restart.
  - Every close the agent made sent SIGTERM, and on Windows `TerminateProcess`, so none of them
    wrote a fresh cookie.
  - uvicorn waits for every open connection before it runs the app's shutdown, with no limit by
    default, and the wall page's event stream to the agent never ends by itself. So the agent
    never got to close the browser when the system stopped it (launchd's SIGTERM at a Mac's
    restart, `launchctl kickstart -k` for an update). launchd then killed both after 20 seconds.
  - Linux most likely kept its pairings because the owner's restarts there came after the
    30-second write: systemd's own SIGTERM reaches the browser too, which writes nothing new.

## Decision

| Question | Decision |
|---|---|
| Edge | Never in its kiosk mode, on any system. It runs on the screen's own profile with `--start-fullscreen`, and the watchdog puts its window back to full screen when someone leaves it (F11, Esc, a minimize), through the DevTools protocol. Chromium and Chrome keep `--kiosk`. |
| Edge's own prompts | Where Sunroom Screen writes the browser's policy itself (Windows' registry, a Mac's preferences), Edge also gets `HideFirstRunExperience`, `PromotionalTabsEnabled: false` and `ShowRecommendationsEnabled: false`, so no welcome page or full-tab "what's new" covers the wall. Linux's root helper keeps its own list, unchanged. |
| A fresh pairing | Written to disk at once. Right after the wall pairs (with a code, the household password, or setting Sunroom up itself), its page asks Sunroom Screen (`POST /api/screen/keep-pairing`). Sunroom Screen then sets 600 throwaway cookies through DevTools, on `flush.invalid` (a name no page can use), each gone a minute later. That's more than Chromium lets wait, so it writes them all, the pairing included, there and then. |
| Closing the browser | Through DevTools' `Browser.close` first, which writes the cookies. Then the system's way (SIGTERM, or `taskkill` without `/F` on Windows), and forced only after 10 seconds. |
| Stopping the agent | Its server ends the pages' event streams the moment it is asked to stop, with a 3-second limit on anything still open, and the agent closes the browser first. On Linux the unit's stop goes to the agent alone (`KillMode=mixed`), so it closes the browser itself. |

## Consequences

- A screen keeps its pairing, its remembered view and its offline copy across restarts, updates
  and Quit on every system, including a restart straight after pairing. Only a power cut in
  the second it takes to pair can still lose it.
- Writing the pairing at once relies on Chromium's 512 (net's `SQLitePersistentCookieStore`).
  If that changes, a fresh pairing falls back to the 30-second write, and the 600 cookies still
  do nothing a page can see.
- Edge isn't locked down the way its kiosk mode was (F11 or Esc leave full screen), so the
  watchdog brings it back within half a minute. That's fine for a computer someone signs in to,
  which has Quit Sunroom Screen anyway.
- Linux screens set up before this keep their old unit until the install command runs again.
- Changes part of ADR 0035 (Edge's kiosk mode on Windows, from M7 batch 2).
