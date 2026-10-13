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

## Consequences

- An end-to-end test that waits for a screen to hear live updates reads `html[data-stream="live"]`
  (`hearsLive` in `e2e/shell.spec.ts`), not the icon.
