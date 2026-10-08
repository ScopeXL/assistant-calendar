# ADR 0006: A household password set on first run, device sessions, a kiosk that never expires, an optional parent PIN

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

- Dinner Bell reads its household password from `APP_PASSWORD` because its URL is public, so no one can race to set it first (Dinner Bell's ADR 0004). A kitchen app's first run happens on a LAN, often by someone who has never edited a `.env` file.
- The wall display is shared. No one signs it in each morning, and it has to survive reboots and power cuts.
- Children use the wall. Settings, approvals and changes to events need a gate there; adding things and checking off chores must not have one.

## Decision

**First run** (PLAN §12.1, §13.4)
- Until a household exists, every page leads to `/setup`. The display shows "Finish setting up Sunroom on a phone or computer" with a QR code.
- The wizard sets the household password (12 or more characters, with a strength hint, stored with `hashlib.scrypt`), names the family, confirms the time zone, adds people, picks features and ends on "Pair the kitchen screen". The setup endpoint is public only until setup is done, then closes for good.
- `APP_PASSWORD` is optional. When set, it skips the wizard's password step and is authoritative at every boot. Without it, a lost password is reset with `sunroom reset-password` through `docker exec`.
- When `APP_SECRET_KEY` is unset, a key is generated on first boot into `/data/secret.key`.

**Sessions and devices** (Dinner Bell's model, PLAN §12.2)
- Each device gets a signed cookie for 400 days (Chrome's cap), re-issued after 30 days. Its name depends on the scheme (ADR 0017). "Sign out other devices" bumps `auth_epoch`.
- A device signed in with the password is a parent device unless it is marked as a kid's. Kid devices can add events and items, complete their own chores and ask for rewards; they can't change settings, approve, or delete what they didn't create.
- One code mechanism adds a phone and pairs a screen: six characters without look-alikes, valid for 10 minutes, single use, stored as an HMAC.

**The kiosk** (PLAN §12.3)
- `/display` without a session shows a pair code and waits. A parent types the code on a signed-in phone, or types the household password on the display. The device row gets `kind = kiosk` and stands for Everyone.
- Its cookie is the normal one, re-issued while the display is on, so it never expires. A password or secret-key change, or a restore, signs it out, and it shows a new code.
- Dinner Bell's rule that attribution never comes from the request is relaxed for kiosks only: a kiosk request may carry `X-Sunroom-Member`, the avatar tapped before checking off a chore. Phones' headers are ignored.

**The parent PIN** (PLAN §12.3)
- Optional, 4 to 6 digits, stored with PBKDF2-SHA256 (200,000 iterations). Each device gets 5 wrong tries per 15 minutes.
- On the display it gates Settings, features, accounts, approvals and deleting other people's things. A correct PIN sets a 10-minute parent grant cookie that does not slide.
- **Kid-safe editing**, on once a kid exists: changing or removing an event on the display asks for the PIN. Moving one, adding things and completing things never do. **Recently removed** keeps removed things for 7 days.

## Consequences

- No one edits a file to get started. A Portainer-style install can still pin the password with `APP_PASSWORD`, which then overrides changes made in the app.
- An unconfigured instance exposed beyond the LAN could be claimed by whoever opens it first. The README and the wizard say to finish setup on the LAN first (PLAN §17, risk 10).
- A password change signs out every device, the kitchen screen included; the screen shows its code again and a phone re-pairs it (risk 14). Losing the secret key does the same and disconnects synced accounts.
- Anyone on the LAN who holds the kiosk cookie could spoof the member header. That is accepted for a household; parent actions still need the PIN grant (risk 15).
- Without a PIN, parent actions on the display are open, and Settings nags once a week. Marking a phone as a kid's needs a PIN first.
