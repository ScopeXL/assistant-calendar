# ADR 0014: Kiosk and phone are one responsive app; the device kind picks the layout

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

- Sunroom has two surfaces, as the opening of the UX spec puts it. The wall display is shared: open, with no sign-in, always showing today. Phones are personal: they remember who holds them and do the typing-heavy work.
- Screen size can't tell them apart. The 10-inch Touch Display 2 or an old tablet can be a wall screen, while a laptop is as wide as the wall (PLAN §13.3, UX §3).
- Two apps would mean two codebases, two sets of components and two test suites.

## Decision

- **One SPA, one build.** The display shell (rail, board, Today panel) and the phone shell (tab bar and sheets) are two shells over the same components, routes and API client.
- **The kiosk layout follows the device kind, not the screen size.** A device paired as a kiosk (`devices.kind = kiosk`) always gets it, with the kiosk's behavior: idle reset, the screensaver, the on-screen keyboard and the PIN gate. `kind` can't change after pairing.
- **Any signed-in browser can preview it** at `/display`; `just display` opens the built app there at 1920×1080. Without a session, `/display` is where a new screen shows its pair code (ADR 0006).
- **Inside each shell, size still matters** (UX §3). Portrait turns the week's days into rows, the Today view is the default under 1280 px, and laptops (1024 px and up) get the display shell with no on-screen keyboard.

## Consequences

- Plugins contribute to both surfaces through one manifest: display panels and rooms, phone tabs and settings sections (ADR 0002).
- Components work at two scales: the display's (body text 24 px, nothing under 18 px, targets at least 56 px) and Dinner Bell's phone scale (body text 16 px, targets at least 44 px) (UX §1).
- One e2e suite runs five projects: `display-1080p`, `display-portrait`, `phone-webkit`, `phone-chromium` and `desktop` (PLAN §14.6).
- Kiosk-only rules, such as the member header and Settings behind the PIN, follow the device row, never the URL. A phone that opens `/display` is still a phone.
