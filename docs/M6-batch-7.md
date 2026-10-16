# M6, batch 7: control a screen from a device, and a photo frame

Two of the owner's notes of 2026-10-15 were marked optional, and the owner chose to keep them
out of batch 6 (`docs/M6-batch-6.md`, 0.12.0). This file designs them for the session that builds
them after 0.12.0 is on the wall, from a read of the code at `30ba6fd` (v0.11.0); batch 6 moves a
few things it names (the Devices page's group names, the `kiosk.command` plumbing stays as it
is). Build it as a batch 6-shaped set of tasks with the same two-tier gate; the release is a minor.

## The owner's notes

- "Add a feature to 'remotely control' paired screens from a device. Since screens could be
  located anywhere, we need a simple way to 'control' the screen from a device. Paired screens
  adjust when settings are changed, but that can be confusing and doesn't help if they want to
  zoom in the week view, or open an event. Is there a way to simulate the paired screen on their
  device and copy tap commands to the paired screen? Not an overly complicated solution that is
  hard to maintain. Propose options that would work for people who are not tech savvy."
- "Photos & Screensaver: a setting to treat the screensaver like a photo frame. If enabled, no
  clock and what's next, and use settings to mimic no backlight coming from the device. Like Dim
  in the evening, except it uses the current time to pick the best percentage to make the photo
  look like a piece of art. Propose changes to accomplish this, since the device has no camera or
  sensor for the room's light."

## What exists

- **Commands to a screen.** `POST /api/kiosk/command` (`household/router.py:228-231`, a parent)
  takes `command: reload | wake | screensaver | show_event` (+ `event_key`) and `hub.publish
  ("kiosk.command", …)`, which goes to **every** connection (`events/hub.py` has no per-device
  send; `StreamConnection.device_id` exists, used only by `drop_devices`). The client passes it
  to `receiveKioskCommand` (`lib/live.ts:31`, `shell/kioskCommands.ts`); `DisplayShell.tsx
  :270-283` acts on `reload` and `wake`, `Saver.tsx:66-67` on `screensaver`; **nothing handles
  `show_event`**, and only `screensaver` has a sender (`features/screensaver/data.ts:147-151`).
  Laptops in the display shell act on commands too. Every client knows its own `session
  .device_id`. A command is a positioned frame, so a screen reconnecting from an older position
  can get one late.
- **What a screen holds.** `lib/displayState.ts`: `view`, `weekOffset`, `day`, `monthOffset`,
  `panelShown`, `railCollapsed`, `weekLayout`, `hoursZoom`, `people`, `panel`; the room is the
  URL; `backToNow()`; `HouseholdChoices`.
- **Devices.** `features/settings/DevicesPage.tsx` lists each device with an icon, label, "Used
  by", "last used"; Unpair, Sign Out, Child's Device, Pair a Display, Add a Device; no rename in
  the UI (the API has `PATCH {label}`), no online state (diagnostics has only a count).
- **The screensaver.** `features/screensaver/Saver.tsx`: photos `object-contain`, crossfading; a
  band with the clock, the date and the plugins' corners; "Up next"; settings in `plugin_state`
  (`plugins/screensaver/plugin.py:27-58`: `start_after`, `every`, `show_clock`, `shuffle`);
  mounted at `z-[57]`.
- **Brightness.** `domain/screen.py:55-67`: day → on at 100; the evening dim (`dim_from`,
  `dim_level` 60/40/20, household columns) → on at the level; sleep (`sleep_from`, `sleep_to`,
  `sleep_mode`) → off, or on at 20 with the dim clock; awake (a tap) → 100 for 2 minutes. `GET
  /api/display/state?wait=55&etag=` (public, long-polled by `kiosk/sunroom-screen`, which sets
  the backlight through sysfs or `ddcutil`, or switches the panel off); the page draws a veil
  only when the launcher said `?dimmer=page` (`lib/dimmer.ts`; `DisplayShell.tsx:64, 396-402`,
  `VEIL = {60: opacity-30, 40: opacity-45, 20: opacity-60}`); `POST /api/display/wake` (a kiosk's
  cookie). The sun: `lib/sun.ts` in the browser only (the Auto theme and the tint); the backend
  has no sunrise maths (the weather plugin fetches sunrise from Open-Meteo, which core can't read:
  hard rule 7). Night: `shell/Night.tsx` at `z-[60]`.

## Remote control: the options, and the one to build

1. **"Show it on the screen" commands (recommended).** A phone or computer sends a short, named
   command to *one* chosen screen; the screen does what a tap there would do. No mirror, nothing
   to keep in sync, nothing new to draw on the phone but one sheet of big buttons. The pieces
   exist: `kiosk.command` gains a `device_id`, screens ignore commands for other screens (the hub
   stays a broadcast; filtering on the client is the smallest change), and the handlers grow.
   Cost: one task.
2. **A live mirror** (the phone draws a copy of the screen and forwards taps). Needs a state
   channel both ways (every room's state, not only the calendar's), a wall-sized layout squeezed
   onto a phone (the wall is 1920 px of 24 px type; a phone is 390), every interaction mapped to a
   message, and latency that makes dragging and zooming feel wrong. A second UI to maintain
   forever, for a family app. Not recommended.
3. **Nothing new**: Settings already reach every screen. Doesn't answer "open this event" or
   "zoom in", which the owner asked for.

Option 1 is built as:

### T1 Control a screen from a device

- Backend: `KioskCommandIn` gains `device_id: str | None` (a paired screen's id; None = every
  screen, as today) and the commands `go_home`, `view` (`week | today | people | month`), `zoom`
  (`in | out | fit`), `show_event` (`event_key`, handled now), `screensaver` (on), `back` (end the
  screensaver, back to the calendar), `refresh` (= `reload`), `wake`; the hub frame carries
  `device_id`; `GET /api/auth/devices` (or wherever the Devices page reads) adds `online: bool`
  from the hub's connections per device (`events/hub.py` knows each connection's `device_id`), so
  the sheet can say "Kitchen screen · on" or "not connected right now".
- Frontend: `shell/kioskCommands.ts` drops frames whose `device_id` isn't this screen's;
  `DisplayShell` handles `go_home` (`navigate(home)` + `backToNow()`), `view` (`updateDisplay
  ({view})`), `zoom` (the same calls `ZoomControl`'s buttons make: find them in
  `features/calendar/ZoomControl.tsx` / `hours.ts`), `show_event` (navigate to the calendar and
  open the event's sheet by key: the sheet opener `EventSheet` takes; the week moves to the
  event's week first), `back` (`Saver` closes, as a tap does). The **Control** sheet: from
  Settings → Devices, each paired screen's row gains **Control** (devices only), opening a sheet
  titled with the screen's name: rows of big secondary buttons: **This Week · Today · People ·
  Month** (a Segmented of views), **Zoom In · Zoom Out · Fit the Day**, **Show the Photos · Back
  to the Calendar**, **Refresh**; a line "Changes show on the screen within a second."; each tap
  posts and toasts nothing (the screen answering is the feedback; a screen that isn't connected
  shows "Kitchen screen isn't connected right now." and the buttons disabled). From an event's
  sheet on a phone: **Show on the Screen** (one paired screen) or **Show on…** (a picker of
  screens) posting `show_event`. Not built: a "where is the screen now" readback (commands are
  fire-and-forget; the owner can ask later for a state echo over the hub, `display.state` with the
  room and view, which `displayState.ts` could publish on change).
- Tests: backend (a command with a device id reaches the hub with it; `online` per device);
  frontend (the filter; each handler); e2e (two wall contexts paired as two screens; a phone sends
  `view: people` to one; only that one shows People; `show_event` opens the sheet).
- Docs: UX §4 Devices row and a "Control a screen" flow in §6; PLAN §11.1 and §12.3; an ADR.

## The photo frame

The screensaver as a picture on the wall: no clock, no "Up next", the photo alone on a dark
matte, and the panel's light turned down to what a print would reflect at that hour, so it stops
reading as a glowing screen. Without a light sensor, the time of day is the only signal, and the
household's sun times are already known (the location); the curve below is a guess the family can
tune with two numbers.

### T2 Photo frame

- **Settings** (household columns, so core's screen rule can read them; the screensaver plugin's
  own settings can't cross into core, hard rule 7): `frame_mode: bool` (off), `frame_day_level:
  int` (the brightness at midday, 30–100, default 60), `frame_night_level: int` (at dusk and dawn,
  10–60, default 25); the evening dim and sleep stay as they are and win when they apply. Settings
  → Display → Screensaver: `Switch` **Photo frame**, hint "Photos alone, without the clock or what's
  next, and the screen turns its light down to what a picture on the wall would reflect: brightest
  at midday, dimmest at dusk and dawn, then Dim in the evening and Sleep as usual."; while on, two
  rows **Light at midday** and **Light at dusk** (Segmented 30/45/60/80/100 and 10/25/40/60, or a
  Stepper by 5). One migration.
- **The curve**, `domain/screen.py`: a new reason `frame` when the screensaver is showing and
  frame mode is on: `brightness = night + (day − night) × sin(π × t)` where `t` is the fraction of
  daylight elapsed (0 at sunrise, 1 at sunset; `domain/sun.py` ported from `lib/sun.ts`: the
  standard sunrise equation with a −0.833° horizon, from the household's latitude, longitude and
  zone; 7:00–19:00 without a location), clamped to the night level outside daylight; the evening
  dim (`dim_from`) and sleep override it as today. The page tells the server when the saver is on:
  `POST /api/display/saver {on: true | false}` (a kiosk's cookie, like `/wake`), which flips
  `state.screen.saver_on` and nudges the `ScreenWatch` so the Pi's helper long-poll answers at
  once; a tap that ends the saver posts `false`. `GET /api/display/state` gains the reason and the
  level; `kiosk/sunroom-screen` needs no change (it applies whatever brightness it's given); the
  page's veil (`?dimmer=page`) maps the level to an opacity the way `VEIL` does, in steps of 5.
- **The saver**: with frame mode on, no band and no Up next; the photo `object-contain` on
  `bg-night` (uncropped, UX §10); the crossfade as today; the date and the clock never drawn; the
  "Add photos…" line still shows when there are no photos (a frame with no picture is a black
  screen, a dead end for a child).
- Tests: `domain/sun.py` against `lib/sun.ts`'s cases (the same dates and places); the curve at
  sunrise, noon, sunset, night, and with the evening dim; the `/saver` route; the state's etag
  changing; e2e (`screensaver.spec.ts`: frame mode on → the saver shows no clock; the display
  state says `frame` with a level between the two settings at the test's noon).
- Docs: UX §4 Display row (Screensaver), §10 checklist line (the screensaver's photo), PLAN §13.5
  (the rule), the ADR.

### T3 Wrap up

The full gate, the ADR, PLAN §15, UX, CLAUDE.md's status line, GOTCHAS, CHANGELOG, this file's
boxes and "As built", the report.
