# ADR 0034: The owner's sixth notes (M6, batch 6)

- **Status:** Accepted
- **Date:** 2026-10-16

## Context

- Sunroom 0.11.0 went on the owner's wall and phones, and their sixth set of notes was the widest
  yet: the words for devices and screens; setup's password, name and theme; About and the
  Location note; "Return to the calendar after: Never" ignored by Settings; tips on by default;
  four more colors; stars for several children; the Who picker's padding; a Support Sunroom page;
  people assigned from an event's title and chips in several colors; reminders that don't come
  back and a default reminder; errors surfaced in one place; no proxy setting; a refresh that
  shows the new version; the Backup page rebuilt, and restore from a file. `docs/M6-batch-6.md`
  turns them into tasks, answers the owner's questions and records every decision; this ADR keeps
  the ones that change an earlier decision or that a later session would otherwise have to
  rediscover (PLAN §15, M6 → 0.12.0). It was started with the batch's first task and gained a row
  with each task after.

## Decision

| Question | Decision |
|---|---|
| Devices and screens | **A device is anything signed in with the household password** (a phone, tablet or computer); **a screen is a wall screen paired with a code** ("paired screens", "this screen"; "Kitchen screen" stays as the default name a new one gets). The app no longer says "phone or computer" for what any device can do, and a paired screen shows **nothing it can't do and no line saying where to do it**: the owner's rule is that whoever can see a setting can use it. So Backup on a screen keeps the backups and Back Up Now and drops its three "from a phone or computer" lines (and the export group, which had only that line there); a person's sheet on a screen shows the photo row only to remove a photo; Start Over stays off the screens (a child can reach them, ADR 0029). Where the screen is showing something that genuinely needs a device (Google's own sign-in page, a helper's key file, adding photos), it keeps the QR code that opens it on one, worded "from a device"; an account that Google signed out now shows that code ("Sign in again from a device:") where it had a sentence. Devices' second group is **Signed-in Devices** (a page named Devices can't hold a group named Devices); the server's refusals say "a signed-in device" and "a paired screen". Two places keep "phone", because they are about one: setup, before any screen exists, and installing the app. Two new tips say what signed-in devices can do that a screen can't (one planned tip was 96 characters, over the list's 90, and was shortened) |

## Consequences

- No schema change from the words.
- UX §2 has a "Devices and screens" paragraph; PLAN §2's glossary names devices and paired
  screens.
