# ADR 0030: The owner's third notes (M6, batch 3)

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

- Sunroom 0.8.0 went on the owner's wall and phones, and a day later they sent a third set of
  notes, most of them about the header, the rail and the Add panel, with a request to audit the
  whole UI for clutter. `docs/M6-batch-3.md` turns them into tasks and records the decisions; this
  ADR keeps the ones that change an earlier decision or that a later session would otherwise have
  to rediscover (PLAN §15, M6 → 0.9.0).

## Decision

| Question | Decision |
|---|---|
| The live icon | A header draws it only while something is wrong: reconnecting, checking every 30 seconds, or offline. Connected draws nothing and keeps no room for itself, on the wall's header and the phone's Calendar header alike (this supersedes ADR 0028's "one icon in the corner, always"). About → Connection keeps the icon with its words in every state. The 2-second settle stays, so a room switch on the kiosk never flashes it. The page's root carries the stream's raw status (`html[data-stream]`, set in `lib/live`), which is how an end-to-end test knows a screen is hearing updates now that there's no icon to look for |
| The pointer | The page hides it, not the Pi: `lib/pointer` marks the root `data-pointer="hidden"` three seconds after the last mouse move and at once on a touch or a pen, on the kiosk's shell and on the screens before pairing (`/display`); a mouse move brings it back. A laptop in the display shell keeps its pointer. labwc's `HideCursor` rule (0.8.4) and `unclutter` stay for the moments before the page loads. The mark is on the root, not the shell, because the Add panel, the PIN pad and the keyboard are drawn beside the shell; the root remembers that it was hidden, because the kiosk remounts its shell on a room switch and the pointer would flash back each time; and a pointermove that goes nowhere is ignored, because Chromium sends one whenever the page changes under a resting pointer |
| Remembering the view | Per screen, in that browser's `localStorage`, not on the server: the board's view, which week, day or month, the people filter, the Week layout and zoom, the Today panel and the rail (`sunroom.display.view`, versioned and checked field by field), and the room the screen is in (`sunroom.display.room`). The display's store starts from it, so the remembered view is the first paint, before the server has answered. Every change is written, the idle reset too, and that is the design: the 2-minute and 5-minute rules are untouched, a screen that sat idle comes back home because that's what it was showing, and a screen refreshed mid-use comes back where it was. Never the open panel (drafts are a separate idea) and never Settings (its PIN grant may be gone) |
| When it starts | A household setting, `display_start`: **Where it left off** (`last`, the default) or **The home view** (`home`). With `home` a screen keeps nothing at all, rather than keeping it and ignoring it: the next start then has nothing to draw before the setting is known, so there's no flash of the old view. The first start after the setting changed while a screen was off is the one time that can happen. The setting is read once per page load (a module flag, since the kiosk remounts its shell between `/display` and the rooms); changed while a screen is in use it doesn't move the screen, it only starts or stops the keeping |
| The room at a restart | The Pi's launcher and its nightly restart always open `/display`, so a page that opens at home goes to the remembered room, once. A reload in place keeps its address and needs nothing. A remembered room whose feature was since turned off goes home by the rule every room address already follows |
| The city search | "Your city" (it was "Your town"), searching as you type: from 2 characters, 350 ms after the last key, with the last answer kept on screen until the next arrives so the list doesn't blink. The places are listed under the field in the page's flow, never a floating list: the wall's keyboard and a phone's sheet both need the page to make room for them. No Search button. A plain labelled field over a list of buttons, with a live status line, rather than an ARIA combobox: the rows are ordinary buttons to a screen reader and to the tests, and on a laptop the arrow keys still walk from the field into the list. The limit rises from 10 to 30 searches a minute per device, since one name is now a few searches. Open-Meteo matches 2 characters exactly and 3 or more loosely, so an empty answer reads "Keep typing…" under 3 and "Nothing by that name. Try the nearest city." from 3 |

## Consequences

- `household` gains `display_start` (default `last`): one migration for the batch,
  `202610131907_household_display_start`, tested against the 0.8.0 fixture database.
- An end-to-end test that waits for a screen to hear live updates reads `html[data-stream="live"]`
  (`hearsLive` in `e2e/shell.spec.ts`), not the icon.
