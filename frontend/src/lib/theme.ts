/**
 * Theme, wall tint, text size and reduced motion on <html> (ADR 0008, UX §7, §10).
 *
 * * The wall display resolves Auto itself: dark from sunset to sunrise at the household's place
 *   (lib/sun.ts), 7 PM to 7 AM without one. The shell holds a switch back until the screen has
 *   been quiet for 10 seconds (UX §6 "Theme auto switch at sunset").
 * * Phones on Auto follow the phone: no data-theme, so `color-scheme: light dark` decides.
 * * The tint steps through the day: dawn, midday, afternoon, dusk (the two hours before sunset)
 *   in the light theme; evening and night in the dark. With Daylight tint off the wall stays at
 *   midday (or night).
 * * Nothing crossfades on first paint: data-motion-ready arrives a moment later.
 */
import { NO_PLACE, type SunDay } from "./sun";

export type ThemeChoice = "auto" | "light" | "dark";
export type Daypart = "dawn" | "midday" | "afternoon" | "dusk" | "evening" | "night";

export interface Appearance {
  theme: ThemeChoice;
  daylightTint: boolean;
  textSize: "standard" | "large" | "xl";
  reduceMotion: boolean;
  /** The wall display (and laptops showing the display shell) resolve Auto by the clock. */
  display: boolean;
  /** Today's sunrise and sunset at the household's place. */
  sun?: SunDay;
}

const HOUR = 60;

/** `minute`: minutes after the household's midnight. */
export function resolveTheme(
  choice: ThemeChoice,
  minute: number,
  sun: SunDay = NO_PLACE,
): "light" | "dark" {
  if (choice !== "auto") return choice;
  return minute >= sun.sunrise && minute < sun.sunset ? "light" : "dark";
}

export function daypart(
  theme: "light" | "dark",
  minute: number,
  tint: boolean,
  sun: SunDay = NO_PLACE,
): Daypart {
  if (theme === "dark") {
    if (!tint) return "night";
    return minute >= sun.sunrise && minute < 22 * HOUR ? "evening" : "night";
  }
  if (!tint) return "midday";
  if (minute < Math.max(10 * HOUR, sun.sunrise + 2 * HOUR)) return "dawn";
  if (minute < 14 * HOUR) return "midday";
  if (minute < sun.sunset - 2 * HOUR) return "afternoon";
  return "dusk";
}

export function applyAppearance(
  appearance: Appearance,
  minute: number,
  root = document.documentElement,
): void {
  const data = root.dataset;
  const followDevice = !appearance.display && appearance.theme === "auto";
  const theme = followDevice
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : resolveTheme(appearance.theme, minute, appearance.sun);
  if (followDevice) delete data.theme;
  else data.theme = theme;
  data.daypart = daypart(theme, minute, appearance.daylightTint, appearance.sun);
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
