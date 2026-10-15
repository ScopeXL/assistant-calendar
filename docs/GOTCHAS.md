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

- A backdrop under the header's menus covered only the header: the header is a size container
  (`@container`), and a container contains `fixed` boxes. `ui/Menu` closes on a press outside
  and swallows that click instead.
- The rail's fold never eased: `:root[data-motion-ready] [data-surface]` reset `transition` on
  every surface a moment after first paint, and out-ranked the rail's own rule. That rule is
  gone (0.10.0); a theme switch's (`data-theme-switching`) out-ranks every element's own for
  its 600 ms, so a fold during a theme change snaps.
- A fade that only Light showed, on a refresh: the theme arrived with `/api/settings`, after
  the fades were armed, and the page had painted the browser's own dark. `public/theme-boot.js`
  paints the remembered theme first, and the fades wait for the household's (ADR 0032).
- The header was 9 px taller in Tasks than elsewhere: a bordered `Segmented` is 12 px taller
  than a button. As one row the header pads 4 px, and `--header-h` follows `--tap`.

- A select stayed 27 px tall in Safari: WebKit ignores `min-height` on a native select. Use
  `ui/Select` (appearance reset, its own chevron).
- Hours' day columns stopped lining up: `container-type` adds layout containment, and a contained
  box can't be a subgrid. The head and body are the containers, not the column.
- An Hours chip's block sat mid-button: a `<button>` centres its content vertically. Make it
  `flex flex-col`.
- A stacked `Segmented` row rested 4 px scrolled: its snap points sat inside its padding. It
  has `scroll-px-1`.
- At Small text, 8 px gaps became 7 and failed the tap check: rem shrinks. `--spacing-2` is
  `max(0.5rem, 8px)`; Hours chips size by `tapPx(rem)`.
- The Hours grid's scrollbar flickered once a minute on the kitchen screen: Chromium's overlay
  bar shows on every scroll, and a resting grid sets `scrollTop` each minute to follow now. That
  scroller is `scrollbar-width: none`.

## Time and live updates

- The wall clock ignored the server's time until the next minute: the minute store didn't hear
  about new clock samples. `lib/clock` tells listeners when the offset moves (`onClockMoved`).
- The wall's live icon blinked on every room switch: the kiosk remounts the shell, so the stream
  reconnects. `ui/LiveStatus` shows anything but connected only after 2 s.
- After Erase everything the wall sat on a pair code: its cached setup status said complete.
  `handleSignedOut` invalidates it.

## End-to-end tests

- The wall's keyboard didn't rise in an a11y run: an `Escape` earlier in the test counted as a
  physical keyboard, which keeps the on-screen one down for 5 s. Close things with a tap.
- The tap-target check flagged the buttons under an open menu as its neighbours. It looks only
  inside an open `[role=menu]`'s box, as it does inside a modal dialog.
- A screenshot showed the last shot's zoom: a wall screen remembers its view across a reload
  (ADR 0030). The screenshot spec clears `sunroom.display.*` before every load.
- A render prop that hands out a function touching a ref (`children(close)`) fails the React
  compiler's refs lint. Pass it through a context, or call it only from a handler.

- An e2e helper moved on before sign-in finished on a laptop: the Today panel's "Up next" shows
  beside Who's using this there. Wait for the URL, not a heading that two screens share.
- WebKit screenshot runs report inline-style CSP violations: Playwright's WebKit screenshot code
  injects a `<style>`. Only the screenshot spec turns `cspGuard` off.
- `settled()` hung on the Hours board: the now line glides in a 60 s transition. It ignores
  animations longer than 10 s.
- The update e2e failed only around 3:30 PM: it counted every toast, and the seed's 4 PM
  practice reminds 30 minutes ahead on the real clock. Count the toast the test means, or set
  the server's clock.
- A wait for the board to come back to this week passed at once: the Week board's region is
  named "This Week" on every week. Wait for the header's This week button to be disabled (This
  month on the Month view).
- The portrait layout test (`lays out its rail or bottom bar…`) failed about one run in seven:
  it read the Today band's box, then the header's, and the header had grown 8 px in between. The
  weather arrives after the board, and in portrait (two header rows) its stacked high and low
  make the first row taller. The test waits for the weather button. The 8 px shift itself is
  still there on a portrait wall as the weather loads.
- A click just after a dnd-kit drop did nothing: dnd-kit swallows clicks for 50 ms after a drop.
  Tests wait 100 ms.
- A heading locator matched twice in Settings: the Today panel shows beside it. Use `exact`.
- The e2e job on GitHub failed every release from 0.5.0 to 0.9.1, unseen: the two accessibility
  journeys (about forty axe scans each) passed in under 30 s on the Mac and took longer on the
  4-CPU runner, Playwright's default limit. The base is 60 s and they're `test.slow()`; the
  deploy skill now reports the run.
- A test that skipped itself at once ended "Test ended." and showed as flaky on CI: the `guard`
  fixture fired `page.addInitScript` without awaiting it. `watch` awaits it now.
