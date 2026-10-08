# ADR 0010: Weather comes from Open-Meteo, with no API key

- **Status:** Accepted
- **Date:** 2026-10-07

## Context

- Any setup step that asks a family to create an API key is a step a non-technical self-hoster may not finish (PLAN §3).
- Open-Meteo needs no key and no account, and it also offers geocoding by place name.
- Its terms are CC BY 4.0, with limits on commercial use (PLAN §17, risk 17).

## Decision

- **The `weather` plugin** asks Open-Meteo for current conditions, hourly values and a 7-day forecast at the household's location. It is on by default.
- **Location:** the household's place is geocoded once by name, from a town search during onboarding or in Settings → Household, and stored on the household row, where the sunset schedule uses it too (ADR 0008).
- **Refresh and cache:** every 30 minutes and whenever the settings change, cached in `weather_cache` for 60 minutes (PLAN §11.4). When the data is stale the panel says "as of 9:10", with a stale hint after 3 hours.
- **Attribution:** "Weather by Open-Meteo" in the panel footer and on the About page.
- **Network:** Open-Meteo's hosts are constants in the SSRF guard, and geocoding is limited to 10 lookups a minute.

## Consequences

- Weather works as soon as a location is set, with nothing to sign up for.
- Each refresh sends the household's latitude and longitude to Open-Meteo, and the town search sends the name typed.
- One call every 30 minutes keeps use modest, as the terms expect.
- Weather shows on the rail, the day headers, the Today panel, the screensaver and the phone's Today header. All of it goes away when the plugin is off, and the calendar keeps working (PLAN §18).
- Tests use a recorded response with sockets disabled (`FakeWeather`).
- From M4 the plugin also supplies sunrise and sunset for the Auto theme and the daylight tint.
