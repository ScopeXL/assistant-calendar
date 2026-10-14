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
 * * Nothing crossfades on first paint, and nothing fades in a theme that arrived late: the
 *   page's first paint is the appearance this browser last showed (public/theme-boot.js reads
 *   it before anything paints), and data-motion-ready arrives only after the household's own
 *   appearance has been put on (ADR 0032).
 */
import { NO_PLACE, type SunDay } from "./sun";

export type ThemeChoice = "auto" | "light" | "dark";
export type Daypart = "dawn" | "midday" | "afternoon" | "dusk" | "evening" | "night";

const DAYPARTS: readonly Daypart[] = ["dawn", "midday", "afternoon", "dusk", "evening", "night"];

/** Where this browser keeps what it last showed. public/theme-boot.js reads the same key. */
export const APPEARANCE_KEY = "sunroom.appearance";

/** What a page put on <html>: what the next page's first paint should be. */
export interface ShownAppearance {
  /** null: the device decides (a phone on Auto). */
  theme: "light" | "dark" | null;
  daypart: Daypart;
  /** null: Standard. */
  textSize: "small" | "large" | "xl" | null;
  reduceMotion: boolean;
}

/** The shown appearance, kept in localStorage, with what the household chose (ADR 0032). */
export interface RememberedAppearance extends ShownAppearance {
  v: 1;
  /** When it was shown (ms since 1970): a page that loads soon after keeps it exactly. */
  at: number;
  /** The household's own choices, for a screen that has been off a while. */
  choice: ThemeChoice;
  daylightTint: boolean;
  sun: SunDay | null;
}

/** How long a remembered appearance is the screen's own, rather than a guess to refresh. */
export const REMEMBERED_FRESH_MS = 5 * 60_000;

export interface Appearance {
  theme: ThemeChoice;
  daylightTint: boolean;
  textSize: "small" | "standard" | "large" | "xl";
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

/** Put the appearance on <html>, and say what was put there (for `rememberAppearance`). */
export function applyAppearance(
  appearance: Appearance,
  minute: number,
  root = document.documentElement,
): ShownAppearance {
  const followDevice = !appearance.display && appearance.theme === "auto";
  const theme = followDevice
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : resolveTheme(appearance.theme, minute, appearance.sun);
  const shown: ShownAppearance = {
    theme: followDevice ? null : theme,
    daypart: daypart(theme, minute, appearance.daylightTint, appearance.sun),
    textSize: appearance.display && appearance.textSize !== "standard" ? appearance.textSize : null,
    reduceMotion: appearance.display && appearance.reduceMotion,
  };
  showAppearance(shown, root);
  return shown;
}

/**
 * Put a shown appearance on <html> as it was, as the boot script does. A change of theme once
 * the fades are armed crossfades every color together (`crossfadeTheme`).
 */
export function showAppearance(shown: ShownAppearance, root = document.documentElement): void {
  const data = root.dataset;
  const before = data.theme;
  if (shown.theme) data.theme = shown.theme;
  else delete data.theme;
  data.daypart = shown.daypart;
  if (shown.textSize) data.textSize = shown.textSize;
  else delete data.textSize;
  if (shown.reduceMotion) data.reduceMotion = "";
  else delete data.reduceMotion;
  if (data.theme !== before && data.motionReady !== undefined) crossfadeTheme(root);
}

/** How long a theme change takes (UX §9 crossfade; `--motion-crossfade` in styles/motion.css). */
export const CROSSFADE_MS = 600;
const switching = new WeakMap<HTMLElement, number>();

/**
 * A theme change, once the fades are armed (UX §9, ADR 0032): data-theme-switching on <html>
 * for the crossfade's 600 ms, under which every color on the page eases together
 * (styles/motion.css). Without it each thing eased at its own pace: the surfaces over 2 s,
 * today's column over 600 ms, a button over 90 ms. Nothing to ease with Reduce motion.
 */
function crossfadeTheme(root: HTMLElement): void {
  const reduced =
    root.dataset.reduceMotion !== undefined ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  window.clearTimeout(switching.get(root));
  if (reduced) {
    delete root.dataset.themeSwitching;
    return;
  }
  root.dataset.themeSwitching = "";
  switching.set(
    root,
    window.setTimeout(() => {
      delete root.dataset.themeSwitching;
    }, CROSSFADE_MS),
  );
}

/**
 * Keep what this page showed, with the household's choices, for the next page's first paint
 * (public/theme-boot.js) and for the pair screen (`rememberedAppearance`). A browser with no
 * storage (a private window) simply has no memory.
 */
export function rememberAppearance(
  shown: ShownAppearance,
  household: { choice: ThemeChoice; daylightTint: boolean; sun: SunDay | null },
  at = Date.now(),
): void {
  const remembered: RememberedAppearance = { v: 1, at, ...shown, ...household };
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(remembered));
  } catch {
    // No storage here: the next page guesses, as it always did.
  }
}

/** What this browser last showed, checked field by field; null when there's nothing usable. */
export function rememberedAppearance(): RememberedAppearance | null {
  let value: unknown;
  try {
    value = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? "null");
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const kept = value as Partial<Record<keyof RememberedAppearance, unknown>>;
  const sun = kept.sun as Partial<SunDay> | null | undefined;
  const fine =
    kept.v === 1 &&
    typeof kept.at === "number" &&
    (kept.theme === "light" || kept.theme === "dark" || kept.theme === null) &&
    DAYPARTS.includes(kept.daypart as Daypart) &&
    (kept.textSize === null || ["small", "large", "xl"].includes(kept.textSize as string)) &&
    typeof kept.reduceMotion === "boolean" &&
    ["auto", "light", "dark"].includes(kept.choice as string) &&
    typeof kept.daylightTint === "boolean" &&
    (sun === null ||
      (typeof sun === "object" &&
        typeof sun.sunrise === "number" &&
        typeof sun.sunset === "number"));
  return fine ? (value as RememberedAppearance) : null;
}

/** Let the wall's tint and the theme crossfade from now on (never on first paint). */
export function allowAppearanceMotion(root = document.documentElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.dataset.motionReady = "";
    });
  });
}
