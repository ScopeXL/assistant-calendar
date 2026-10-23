# M8 batch 2: Set Up on the Screen, and This Screen First

The owner tried Sunroom on This Computer (M8, 0.15.0) and wrote two notes:

1. After Run Sunroom Here, the screen showed **Set Up Sunroom on Your Phone** and nothing else:
   the computer the family was sitting at couldn't set Sunroom up itself. It should, as a phone or
   a laptop does: it's all in the browser.
2. Settings → **This Screen** shows only where the screen can change its own things (Wi-Fi,
   updates, Restart, Quit). There it should come first and open by default, and look like the
   screen's own settings, apart from the family's Sunroom.

ADR 0039 keeps the decisions. Work through the tasks in order; each ends with the quick gate
(CLAUDE.md) and a commit.

## What exists

- `/display` before setup (`features/display/DisplayEntry.tsx`, `Welcome`): the brand, "Set Up
  Sunroom on Your Phone" and a QR code of the address. Once a phone has run setup, the screen shows
  Pair This Screen; after pairing, Name This Screen, then the board.
- The setup wizard (`features/onboarding/SetupWizard.tsx`, `/setup?step=`), in the phone shell:
  password, household (`POST /api/setup`, which signs in the device that ran it as a parent
  phone), where's home, who lives here (the first person is bound to that phone), a parent PIN,
  calendars, You're Set.
- On the wall, a paired screen (device kind `kiosk`) is a parent only while there's no PIN, or
  for ten minutes after the PIN is typed (a grant). `PUT /api/auth/member` refuses a screen.
- Settings on the wall (`features/settings/SettingsScreens.tsx`): the list of pages at the left,
  Family first and open by default; This Screen fifth, after Display, only with Sunroom Screen.

## Decisions

| Question | Decision |
|---|---|
| Which screens | Every wall screen before setup, whether Sunroom runs on it or elsewhere. A phone still works as before. |
| Set Up Sunroom | The page before setup offers two ways, side by side (stacked in portrait), as the screen's own Welcome does: **On This Screen** ("Set it up right here." … **Set Up Here**) and **On Your Phone** (its QR code and the address; the screen shows a code to pair it afterwards). |
| The steps on the wall | The wizard's six steps, at the wall's sizes, with its keyboard docked under the fields. It starts at the password (Set Up Sunroom said what it takes), whose **Back** returns to Set Up Sunroom. |
| What the screen becomes | The household step makes this screen a paired screen ("Kitchen screen"), not a phone: `POST /api/setup` takes `on_screen: true`. Nobody is bound to it at Who Lives Here. Setting a PIN there unlocks the screen for its ten minutes with that PIN, so the calendars step works. |
| The end | After the calendars, **Name This Screen** (Next), then **You're Set**: how phones join (a QR code of the address, the household password) and **Open Sunroom**, to the board. |
| Idle | Ten minutes untouched leave setup: to Set Up Sunroom while nothing is saved (what was typed is forgotten), to the board once the household is (the rest is in Settings). |
| This Screen in Settings | First in the list and open when Settings opens, on a wall run by Sunroom Screen; a box of its own at the top (a screen icon, "Network, updates and power"), a rule, then the household's pages under "The Sample Family's Sunroom". The page says "These settings are for this screen only: its network, updates and power. They don't change Sunroom for anyone else." Elsewhere nothing changes. |

## Tasks

### T1 Set Up Sunroom on the screen

- [x] Done (commit: "display: set Sunroom up on the screen itself")
- Backend: `SetupIn.on_screen`; the device a kiosk labelled "Kitchen screen"; a test.
- Frontend: `ui/Choice` (from the screen's Welcome); Set Up Sunroom's two ways; the wizard with a
  `go` and an `onScreen` (Back, the kiosk's setup body, no member binding, the PIN's grant, the
  wall's You're Set); `SetupFrame` and the steps at the wall's sizes and above its keyboard;
  `DisplayEntry` runs the steps in its frame, with a toast region; Name This Screen's Next; idle.
- Tests: `first-run.spec` (the wall sets itself up, end to end), the screenshots spec's wall.
- Docs: UX §4 and §6, PLAN §12.1, README's Install and KIOSK.md (the first setup changed),
  CHANGELOG.

### T2 This Screen first

- [ ] Done (commit: "settings: This Screen first on a wall run by Sunroom Screen")
- `pages.ts` (This Screen first), `SettingsScreens.tsx` (the box, the rule, the caption, the
  page's lead; `/settings` opens the first page); `this-screen.spec`; UX §4; CHANGELOG.

### T3 Wrap up

- [ ] Done (commit: "docs: M8 batch 2 wrapped up")
- The full gate; the screenshots of Set Up Sunroom, the wall's steps and Settings with This
  Screen, both display sizes, light and dark.
