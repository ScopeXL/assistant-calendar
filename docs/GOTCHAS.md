# Gotchas, by area

Things that cost time once: the symptom, the cause, and the fix. `CLAUDE.md` keeps the ones any
task can hit (tooling, migrations, plugins, tests in general, motion); these belong to one screen
or one widget. Add a line where it fits, and move lines here from `CLAUDE.md` when it nears its
size limit.

## The wall's keyboard, sheets and panels

- A tap on a wall-screen button missed: the field lost focus, the keyboard lowered, and the page
  moved under the finger. The keyboard's padding (`--osk-h`) outlasts it by 400 ms.
- A sticky Save bar in the wall's side panel covered the chips above the keyboard: a sticky box
  stops at its scroller's padding, which already holds `--osk-h`. Stick it at `bottom-0`.
- The wall's keyboard couldn't type into a sheet: a modal `<dialog>` makes the rest inert.
  `ui/Keyboard` mounts in the open dialog; a backdrop tap closes a sheet only if the press began
  there (the sheet rises with the keys, so a release can land on the backdrop).
- A wall password field offered capitals: the keyboard's layout comes from TextField's `layout`,
  not `type`. Pass `layout="password"`, and `autoCapitalize="none"` for addresses.
- The wall stayed shifted up after typing: an `overflow: hidden` box still scrolls from script
  (focus, `scrollIntoView`) once its content overflows. The shell is `overflow: clip`.
- A field in the wall's side panel jumped to the top when the keyboard rose: the panel's scroll
  padding already holds the keyboard, and the field's own scroll margin counted it twice.
  `[data-panel] [data-osk]` gets a 1rem margin.
- The Add panel opened scrolled down: a side panel kept the last form's scroll. `ui/SidePanel`
  puts `scrollTop` back to 0 when it opens or its title changes.
- A sliver of the form showed under a pinned button: `ui/PanelActions` has a cover strip
  (`after:`) below itself.

## Layout and CSS

- A select stayed 27 px tall in Safari: WebKit ignores `min-height` on a native select. Use
  `ui/Select` (appearance reset, its own chevron).
- Hours' day columns stopped lining up: `container-type` adds layout containment, and a contained
  box can't be a subgrid. The head and body are the containers, not the column.
- An Hours chip's block sat mid-button: a `<button>` centres its content vertically. Make it
  `flex flex-col`.
- A stacked `Segmented` row rested 4 px scrolled: its snap points sat inside its padding. It
  has `scroll-px-1`.

## Time and live updates

- The wall clock ignored the server's time until the next minute: the minute store didn't hear
  about new clock samples. `lib/clock` tells listeners when the offset moves (`onClockMoved`).
- The wall's live icon blinked on every room switch: the kiosk remounts the shell, so the stream
  reconnects. `ui/LiveStatus` shows anything but connected only after 2 s.

## End-to-end tests

- An e2e helper moved on before sign-in finished on a laptop: the Today panel's "Up next" shows
  beside Who's using this there. Wait for the URL, not a heading that two screens share.
- WebKit screenshot runs report inline-style CSP violations: Playwright's WebKit screenshot code
  injects a `<style>`. Only the screenshot spec turns `cspGuard` off.
- `settled()` hung on the Hours board: the now line glides in a 60 s transition. It ignores
  animations longer than 10 s.
