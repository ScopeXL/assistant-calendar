# ADR 0029: The owner's second notes (M6, batch 2)

- **Status:** Accepted
- **Date:** 2026-10-12

## Context

- Sunroom 0.7.0 went on the owner's wall and phones, and after a few more days of use they sent
  a second set of notes. `docs/M6-batch-2.md` turns them into tasks; the decisions below were
  made with the owner on 2026-10-12 and settled while building them (PLAN §15, M6 → 0.8.0).
- Until now each room drew its own title row, the rail held the clock and the weather, and the
  Today panel hid in Settings. The owner wants one bar across the top that is the same in every
  room, with the page's own buttons at its right.

## Decision

| Question | Decision |
|---|---|
| "Chores" | The family reads **Tasks** and **task** everywhere: the room, the Add type, the Today panel's block, Settings, tips, toasts and error copy. The stored word stays, as Kid did under Child (ADR 0028): the plugin id `chores`, its routes, tables, events, query keys and the room's address `/chores`. No migration and no API change |
| The people view's name | **People**, one word beside Week · Day · Month, in the view switch, the Home view setting, tips and the docs. "Who's Doing What" is gone |
| Small text | A fourth text size, Small: the root font size at 87.5% (14 px), for a screen around 1920×1080 that is read up close. The display's floor is 16 px there (18 at Standard stays the rule); `text_size` is a string column, so the value needs no migration |
| Tap targets at every text size | A target grows with Large and Extra large and never shrinks under Small: `--tap` is `max(3.5rem, 56px)` and `--tap-primary` is `max(4rem, 64px)`, in the theme's spacing scale as `min-h-tap`, `size-tap`, `min-h-tap-primary`. The least room between two targets holds the same way: `--spacing-2` is `max(0.5rem, 8px)`, so every `gap-2` keeps 8 px. The Hours grid, which sizes chips in JS, floors them with `tapPx(rem)`. Small shrinks text and spacing, never a target |
| Button groups | Each word in a segmented control has 20 px of room on either side on the wall and 16 on phones (it was 12). A group that can't fit one line wraps onto a second row with a fixed corner radius, so it still reads as one control. `IconSegmented` is the icon form: round tap-sized cells, no border, each named. A setting's choices are a group up to six options and 40 letters; more are chips |
| The header | One bar over the board and the Today panel, the full width in portrait (it replaces the portrait band's clock strip, and the band drops from 28rem to 24rem). Zones: today (the date, the time at 40 px in digit boxes with AM or PM beside it, the weather) · the room's way back, title and controls · the Today panel's button · the live-updates icon at the far right (ADR 0028's corner holds). One row from 104rem of the header's own width (1920 px at Standard and Small), two rows below it: the room's part moves to the second row and the corner stays put. The rail stays full height and loses its clock |
| The title's quiet line | Under the title, not beside it. Side by side, the week's span ("Sep 27 – Oct 3") is as long as the title, and with the chosen view's word in the switch the one row no longer fit at 1920 px Standard. Stacked, the worst case (late September, a two-digit hour) fits with room to spare, and portrait's second row holds the title, the arrows and the switch |
| How a room reaches the header | A store, `shell/roomHeader`, set in a layout effect on every render and cleared on leaving (`useRoomHeader`, or `<RoomHeader title="Lists" …/>` so the Title Case test reads the literal). Not a portal: a portal needs the header's node before the room first renders, and the kiosk remounts the shell between `/display` and the rooms, which would blank it. The header is the store's only subscriber. Every room uses it; none draws a title row |
| The Today panel in Settings | Allowed now: its button is in the header in every room, and Settings' pages are capped at a reading width anyway |
| The view switch | Four icons (Week · Day · Month · People) with the chosen view's word beside its icon while the header has 64rem; below that one **View** button named "View: Week" that opens the four as a menu of radio items (the checked one takes focus, arrows move, Escape, Tab and a press elsewhere close it and return focus). No library, no `<dialog>`. Only one form is drawn at a time, so a button named "Day" is never there twice |
| The rail's top and its fold | The rail starts with the brand (the mark over the name) and **Hide the rail**. Folded, it is an icon-only mini rail, 4.5rem wide: the mark, **Show the rail**, each room, the Add circle and Settings, every one still named. It is never fully hidden, so a room is always one tap away. The width is one CSS rule, `:root:has([data-rail="compact"]) { --rail-w: 4.5rem }`, so the header, the board and the toasts follow with no script; landscape only, portrait's bar is always whole |
| How long a fold lasts | A per-screen override in the display state (`railCollapsed`), cleared by the two-minute idle reset like the Today panel's, over a household setting, **Compact rail** (`display_rail_compact`), for a lasting choice. With the setting on, Show the rail opens it out until the next idle reset. The width eases over the enter time, never on first paint: the attribute that allows it arrives a frame after the settings do |
| Gear or padlock | Settings is a gear. It is a padlock only while Settings are locked: a paired screen with a PIN set and no grant open. A parent's laptop and a household with no PIN see the gear from the start; with a grant open the word under the gear reads "Unlocked", and the header's own Lock button keeps its padlock. The button carries `data-icon`, because lucide puts no class on its SVGs for a test to find |
| Toasts and the rail's side | The wall's toasts sit over the board: between the rail and the Today panel, whichever side the rail is on and whether or not the panel shows (four static class sets in `ToastRegion`). Batch 1's follow-up, closed |
| What stays with the board | Its own toolbar above the days: Show (the person filter), the plugins' quiet pills, and the Week's tools (the zoom and the layout switch) at the right. Nothing at all with one person, no pill and no tool |

## Consequences

- `household` gains `display_rail_compact` (default off): one migration for the batch,
  `202610121749_household_compact_rail`, with its fixture database built in the same task.
- `RailPlace` is `"header" | "phone"`: a plugin's block by the clock (the weather) draws in the
  header on the wall. The `rail` and `band` places are gone.
- A room's heading is the header's h1, whose name is the title followed by its quiet line
  ("Tasks Today", "Meals Oct 4–10"); a room's `<section>` is named by `aria-label`.
- The Photos room's Start screensaver is an ordinary button on the kitchen screen now, like its
  neighbours: a 64 px primary button would have made the header's row uneven.
