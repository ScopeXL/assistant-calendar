/**
 * Theme, wall tint, text size and reduced motion on <html> (ADR 0008, UX §7, §10).
 *
 * * The wall display resolves Auto itself: dark from sunset to sunrise. Until the weather
 *   plugin brings a location (M4), sunset is 7 PM and sunrise 7 AM.
 * * Phones on Auto follow the phone: no data-theme, so `color-scheme: light dark` decides.
 * * The tint steps through the day: dawn, midday, afternoon, dusk in the light theme; evening and
 *   night in the dark. With Daylight tint off the wall stays at midday (or night).
 * * Nothing crossfades on first paint: data-motion-ready arrives a moment later.
 */
export type ThemeChoice = "auto" | "light" | "dark";
export type Daypart = "dawn" | "midday" | "afternoon" | "dusk" | "evening" | "night";

export interface Appearance {
  theme: ThemeChoice;
  daylightTint: boolean;
  textSize: "standard" | "large" | "xl";
  reduceMotion: boolean;
  /** The wall display (and laptops showing the display shell) resolve Auto by the clock. */
  display: boolean;
}

export const SUNRISE_HOUR = 7;
export const SUNSET_HOUR = 19;

export function resolveTheme(choice: ThemeChoice, hour: number): "light" | "dark" {
  if (choice !== "auto") return choice;
  return hour >= SUNRISE_HOUR && hour < SUNSET_HOUR ? "light" : "dark";
}

export function daypart(theme: "light" | "dark", hour: number, tint: boolean): Daypart {
  if (theme === "dark") {
    if (!tint) return "night";
    return hour >= SUNRISE_HOUR && hour < 22 ? "evening" : "night";
  }
  if (!tint) return "midday";
  if (hour < 10) return "dawn";
  if (hour < 14) return "midday";
  if (hour < SUNSET_HOUR - 2) return "afternoon";
  return "dusk";
}

export function applyAppearance(
  appearance: Appearance,
  hour: number,
  root = document.documentElement,
): void {
  const data = root.dataset;
  const followDevice = !appearance.display && appearance.theme === "auto";
  const theme = followDevice
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : resolveTheme(appearance.theme, hour);
  if (followDevice) delete data.theme;
  else data.theme = theme;
  data.daypart = daypart(theme, hour, appearance.daylightTint);
  if (appearance.display && appearance.textSize !== "standard") data.textSize = appearance.textSize;
  else delete data.textSize;
  if (appearance.display && appearance.reduceMotion) data.reduceMotion = "";
  else delete data.reduceMotion;
}

/** Let the wall's tint and the theme crossfade from now on (never on first paint). */
export function allowAppearanceMotion(root = document.documentElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.dataset.motionReady = "";
    });
  });
}
