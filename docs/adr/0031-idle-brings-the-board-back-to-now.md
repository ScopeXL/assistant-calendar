# ADR 0031: Idle brings the board back to now, and what a screen chose for itself stays

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

- The wall's idle machine put its whole display state back after 2 minutes: the week, the
  person filter and the open sheet, and with them every choice made on the screen. Those were
  the Today panel's button, the Week layout and zoom (ADR 0028) and the rail's fold (ADR 0029),
  each documented as lasting "until the screen sits idle". ADR 0030 then kept that state across
  starts, and said a screen that sat idle comes back home "because that's what it was showing".
- Living with 0.9.0, the owner found the wall going back to the Agenda Week, with the rail and
  the Today panel open, two minutes after any use, on the Calendar too, after they had folded
  the rail or picked another view on purpose. The 2 minutes were the board's own fixed rule,
  not Settings → Display → Return to the calendar after, which only governs the other rooms.
- The rule did two jobs at once. One is showing the next person *now*: this week, everyone's
  events, no sheet left open (UX §1). The other put the screen's layout back to the
  household's, which undid choices made on purpose.

## Decision

- **Back to now, not back to the defaults.** After 2 minutes idle (10 with an editor open), and
  when a tap ends a screensaver that ran over half an hour, the board goes to this week, today
  and this month, the person filter clears and an open sheet closes. `backToNow()` in
  `lib/displayState` does this, and replaces `resetBoard()`. The view (Week, Day, Month, People,
  Today), the Week layout and zoom, the Today panel and the rail stay as the screen has them.
  This supersedes ADR 0028's "both go back after two minutes idle", ADR 0029's "cleared by the
  two-minute idle reset" for the fold, and ADR 0030's "a screen that sat idle comes back home".
  Rooms still return to the calendar after the household's minutes, and Settings still lock
  after 2. The calendar a screen returns to is in its own view.
- **The person filter still clears.** Who's filtered is a question asked for a moment, like
  paging to next week, and it hides people's events; on a shared screen the next person to
  glance should see everyone's.
- **The latest choice wins.** Four household settings can also be chosen on a screen: Home
  view, Week layout, Today panel and Compact rail. Now that a screen's choice outlasts idle, a
  change in Settings → Display would never show on a screen that had made its own. So when one
  of the four changes (on the wall's own Settings or a phone), the screen's own choice of that
  thing gives way and the household's new value shows at once (`householdChose()`, fed by the
  display shell each time the settings arrive). The first values a page reads are only noted,
  so what a screen remembered from before its start stands.
- **A zoomed grid keeps now in view.** With the zoom outlasting idle, a grid left scrolled to
  the evening would greet the next glance there. From going back to now until the next touch
  the screen is resting (`resting` in `lib/displayState`), and a zoomed Hours grid puts now a
  third of the way down, as zooming in does, again each minute.
- **Words.** Settings → Display → Home view's hint is "What the screen shows until someone picks
  another view." It said "when nobody is using it", which is no longer true. Compact rail's hint
  now says the rail opens back out from the header, where its button has been since ADR 0030.

## Consequences

- A choice made on the wall lasts until someone changes it, for everyone who uses that screen:
  a folded rail stays folded and a hidden Today panel stays hidden. The household's settings
  are what a new screen starts with, and what any screen shows again after one of them
  changes.
- The Home view is what a screen shows until someone picks another view: on a new screen, at a
  start when When it starts says The home view, and after the setting changes.
- `lib/displayState.test.ts` checks `backToNow()` and `householdChose()` field by field. The
  end-to-end tests check that idle keeps the rail, the Today panel and the Month view
  (`shell.spec.ts`) and the Week layout and zoom with now back in view (`hours.spec.ts`), and
  that a later choice of Compact rail or Week layout wins.
