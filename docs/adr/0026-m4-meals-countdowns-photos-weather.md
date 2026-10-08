# ADR 0026: Meals, countdowns, photos and weather: where each part lives

- **Status:** Accepted
- **Date:** 2026-10-08

## Context

- M4 adds four plugins (PLAN §15): `meals`, `countdowns`, `screensaver` and `weather`.
- Several of their parts sit between a plugin and core, or between two plugins:
  - dinner and countdowns on the board;
  - "Add ingredients to Groceries";
  - the weather by the clock and on the screensaver;
  - the screensaver over the whole wall;
  - sunset for the Auto theme.
- ADR 0002 says plugins never import each other or read each other's tables, and every plugin works with the others off. This ADR records how M4 keeps that.

## Decision

| Question | Decision |
|---|---|
| Board overlays | A plugin registers its overlay with `ctx.calendar.register_overlay`. The calendar facade wraps it, so a plugin that's switched off answers nothing. The board asks for the overlays of the plugins that are on, and draws them as quiet chips with the plugin's mark. A tap opens the plugin's room; they can't be dragged |
| Dinner on the board | Off by default (Settings → Meals → "Show dinner on the calendar"); Tonight on the Today panel is always there |
| Ingredients to Groceries | The meals frontend calls the Lists plugin's public API (`POST /api/lists/{id}/items`), and shows the button only while Lists is on. The backends never meet. Ingredients live on saved meals (`saved_meals.ingredients_json`) |
| Saved meals | Typing a new meal also saves it, so the library is what the family really makes and next week is one tap. A meal entry points at its saved meal (`meal_entries.saved_meal_id`). One live entry per spot (day, meal, position): a partial unique index on rows not removed |
| Countdowns | Emoji only: a countdown's photo waits for a later milestone. Birthdays aren't rows; they come from people's birthdays while the `birthdays` setting is on. A surprise (`show_on_display` off) never shows on the wall, nor on the board's overlay. A one-off leaves for Recently removed the day after |
| Sunrise and sunset | Worked out in the browser (`lib/sun.ts`, the standard sunrise equation) from the household's place in core settings. It works offline and with the weather off; without a place the day runs 7 AM to 7 PM. Open-Meteo's sunrise is shown in the forecast only |
| The Auto switch | Sunset and sunrise switch the wall's theme once nobody has touched it for 10 seconds (`useQuietTheme`). A parent changing the setting sees it at once |
| The household's place | Core keeps it (`household.location_label`, `latitude`, `longitude`). The weather plugin brings the place search (parents only, 10 a minute) to first run ("Where's home?") and to Settings → Household → Location |
| Weather units | `auto` by default: °F when the household's time zone is a United States one, °C elsewhere; or set by hand. The test server makes its own forecast and never calls Open-Meteo |
| New plugin slots | `railBlock` (by the clock, in portrait's band and on a phone's Today), `dayHeader` (the board's day header), `saverCorner` (the screensaver's date line), `eventAction` (a button on an event's sheet: "Add a countdown"), and `settings.household` (a section in Settings → Household) |
| The screensaver | A frontend overlay (`PluginModule.overlay`) that starts after the set minutes idle unless Night, a held screen (a routine) or an open dialog says otherwise. It reads one manifest: every library photo not hidden or removed. It shuffles each time it starts, decodes the next photo before crossfading, and its band words sit on a dark wash (`saver-ink`, `saver-shade`). A tap after 30 minutes or more goes back to this week's board |
| Start screensaver | On the wall, the Photos room's button. From a phone, core's `POST /api/kiosk/command {screensaver}`; the plugin has no `/preview` route |
| The inbox folder | Every 5 minutes, files in `photos/inbox` that have sat still for 10 seconds (by the file system's clock) are imported, one write transaction each. Originals move to `inbox/imported/`; files that aren't readable photos move to `inbox/unreadable/` and the source says so. Immich and Nextcloud sources wait for a later milestone |
| Photo uploads | A phone sends the photo as it is when it's under the server's 15 MB, so the server can read when it was taken before it strips the rest |

## Consequences

- Tables differ from PLAN §10.3's first draft:
  - `saved_meals` gains `ingredients_json`, `created_by_member_id`, `created_at` and `updated_at`;
  - `meal_entries` gains `saved_meal_id`, and its uniqueness is partial;
  - `countdowns` has no `photo_id`.
  PLAN §10.3 now says so.
- Each of the four plugins has its own migration (slugs `meals_`, `countdowns`, `screensaver`, `weather`), and the 0.4.0 fixture database is the first that has lists and chores rows.
- A plugin calling another plugin's API from the frontend is allowed when it checks the other is on and works without it. The backend contract test still forbids imports and shared tables.
- First run gains a step ("Where's home?", 3 of 7), which skips itself with the weather off.
