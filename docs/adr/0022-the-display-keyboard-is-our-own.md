# ADR 0022: The wall screen's on-screen keyboard is Sunroom's own, not react-simple-keyboard

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

- The Pi's touchscreen has no physical keyboard, and the system's own (squeekboard) covers half
  the screen, so UX §1 specifies an in-app keyboard: it slides up only for a focused field, docks
  960 px wide under the side panel in landscape and spans the screen in portrait, never covers
  the field, has letters, symbols, a numeric pad for PINs, times and codes, long-press accents,
  an automatic capital for a title's first letter, and keys of 80 × 64 px (88 × 72 in portrait).
- PLAN §4 named `react-simple-keyboard` for it.
- Two things have to hold that a general-purpose keyboard component doesn't promise: a key press
  must never take focus from the field (the caret and the field's own state stay put), and the
  typed text must reach React-controlled inputs as real input, with no second source of truth.

## Decision

- **Sunroom draws its own keyboard** (`ui/Keyboard.tsx` with `lib/keyboard.ts`, a few hundred
  lines and no dependency):
  - fields opt in with `data-osk` and `inputMode="none"` (`ui/TextField` does this in the display
    shell), and the keyboard follows whichever such field has focus;
  - keys are buttons that cancel `pointerdown`, so focus never leaves the field;
  - text goes in through the input element's native value setter plus an `input` event, so React
    sees an ordinary change, and Enter submits the field's form;
  - layouts: letters, numbers and symbols, and a numeric pad; held vowels offer accents;
  - any physical key press marks the device as having a keyboard, which hides the on-screen one
    (laptops never see it; they get the display shell only for its layout).
- Styling is tokens only, like every other primitive; sizes follow UX §1.

## Consequences

- One less dependency, and no third-party stylesheet or runtime style injection to vet against
  the CSP (ADR 0007).
- Sunroom owns keyboard bugs. The e2e suite types with it on the wall screen, and the bottom
  padding it adds (`--osk-h`) outlasts it by 400 ms so a tap that lowers it never moves the page
  under the finger.
- Still to build, as the UX asks: the suggestion row and the pair-code layout arrive with the
  features that need them (quick add, M1).
