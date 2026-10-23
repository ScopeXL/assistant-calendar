# ADR 0039: Set up on the screen, and This Screen first

- **Status:** Accepted
- **Date:** 2026-10-23

## Context

- With Sunroom on This Computer (ADR 0038), the computer a family installs Sunroom Screen on can
  run Sunroom too. After Run Sunroom Here the owner met the wall's page before setup: "Set Up
  Sunroom on Your Phone", a QR code, and no way to go on from the computer itself. Setup happened
  on a phone since M0 (UX §6), because a wall screen used to be a Pi across the room; a computer
  with Sunroom Screen is a browser with a keyboard on its screen, like a phone or a laptop.
- Settings → This Screen (ADR 0035) shows only on a wall run by Sunroom Screen, and was fifth in
  the list, among the household's pages, though it is the one page about the device itself.
- `docs/M8-batch-2.md` is the plan and the record.

## Decision

| Question | Decision |
|---|---|
| Setting up on the wall | Every wall screen's page before setup offers **On This Screen** (**Set Up Here**) beside **On Your Phone** (the QR code and address). Set Up Here runs the wizard's six steps on the wall, at its sizes and with its keyboard; it starts at the password, which has **Back**. |
| What the screen becomes | `POST /api/setup` takes `on_screen: true`: the device it signs in is a paired screen (kind `kiosk`, "Kitchen screen"), not a phone, so the wall ends as any paired screen does. Nobody is bound to it; a PIN set there unlocks it for its ten minutes with that PIN, for the last step. Then Name This Screen and You're Set, which says how phones join. |
| Idle while setting up | Ten minutes untouched leave setup: to the page before setup while nothing is saved, to the board once the household is. |
| This Screen | First in Settings and open when Settings opens, on a wall run by Sunroom Screen; drawn apart (its own box with a screen icon, a rule, then the household's pages under the household's Sunroom), and the page says its settings are for this screen only. |

## Consequences

- A wall that sets Sunroom up is a parent's until a PIN is set, as any paired screen is; the
  password is typed on a screen in the family's view, masked, and forgotten if setup is left.
- Phones still set up as before, and a wall waiting on its page before setup still moves to Pair
  This Screen when a phone finishes first.
- Changes ADR 0030's "A Pi that runs setup itself" (it signed the wall in as a parent's phone,
  and the wall's page offered only the phone) and part of ADR 0035 (This Screen's place in
  Settings).
