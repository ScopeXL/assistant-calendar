import { afterEach, describe, expect, it, vi } from "vitest";

import boot from "../../public/theme-boot.js?raw";
import {
  APPEARANCE_KEY,
  applyAppearance,
  CROSSFADE_MS,
  daypart,
  previewTheme,
  rememberAppearance,
  rememberedAppearance,
  resolveTheme,
} from "./theme";

const at = (hour: number, minute = 0) => hour * 60 + minute;
const OCTOBER = { sunrise: at(6, 59), sunset: at(18, 30) };

describe("the theme (ADR 0008)", () => {
  it("resolves Auto by the clock: dark from 7 PM to 7 AM without a location", () => {
    expect(resolveTheme("auto", at(6))).toBe("dark");
    expect(resolveTheme("auto", at(7))).toBe("light");
    expect(resolveTheme("auto", at(18))).toBe("light");
    expect(resolveTheme("auto", at(19))).toBe("dark");
    expect(resolveTheme("light", at(23))).toBe("light");
  });

  it("follows the household's sunrise and sunset when it has a place", () => {
    expect(resolveTheme("auto", at(6, 58), OCTOBER)).toBe("dark");
    expect(resolveTheme("auto", at(6, 59), OCTOBER)).toBe("light");
    expect(resolveTheme("auto", at(18, 29), OCTOBER)).toBe("light");
    expect(resolveTheme("auto", at(18, 30), OCTOBER)).toBe("dark");
  });

  it("steps the wall's tint through the day (UX §7)", () => {
    expect([8, 11, 15, 18].map((hour) => daypart("light", at(hour), true))).toEqual([
      "dawn",
      "midday",
      "afternoon",
      "dusk",
    ]);
    expect([20, 23].map((hour) => daypart("dark", at(hour), true))).toEqual(["evening", "night"]);
    expect(daypart("light", at(8), false)).toBe("midday");
    expect(daypart("dark", at(20), false)).toBe("night");
    // Dusk is the two hours before sunset.
    expect(daypart("light", at(16, 29), true, OCTOBER)).toBe("afternoon");
    expect(daypart("light", at(16, 30), true, OCTOBER)).toBe("dusk");
  });

  it("puts it all on <html> for the wall screen, and leaves a phone on Auto to the phone", () => {
    const root = document.createElement("html");
    applyAppearance(
      { theme: "auto", daylightTint: true, textSize: "xl", reduceMotion: true, display: true },
      at(21),
      root,
    );
    expect(root.dataset).toMatchObject({
      theme: "dark",
      daypart: "evening",
      textSize: "xl",
      reduceMotion: "",
    });
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
    })) as unknown as typeof window.matchMedia;
    applyAppearance(
      { theme: "auto", daylightTint: true, textSize: "xl", reduceMotion: true, display: false },
      at(11),
      root,
    );
    expect(root.dataset.theme).toBeUndefined();
    expect(root.dataset.textSize).toBeUndefined();
    expect(root.dataset.reduceMotion).toBeUndefined();
    expect(root.dataset.daypart).toBe("midday");
  });

  it("marks every text size but Standard on the wall screen", () => {
    const root = document.createElement("html");
    const sized = (textSize: "small" | "standard" | "large" | "xl") => {
      applyAppearance(
        { theme: "light", daylightTint: false, textSize, reduceMotion: false, display: true },
        at(11),
        root,
      );
      return root.dataset.textSize;
    };
    expect(sized("small")).toBe("small");
    expect(sized("standard")).toBeUndefined();
    expect(sized("large")).toBe("large");
  });
});

describe("the appearance a browser remembers (ADR 0032)", () => {
  afterEach(() => {
    localStorage.clear();
    const data = document.documentElement.dataset;
    for (const key of ["theme", "daypart", "textSize", "reduceMotion"])
      Reflect.deleteProperty(data, key);
  });

  /** Run the boot script's text as the page does, from <head>, before anything paints. */
  const runBoot = () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- a classic script, no exports
    (new Function(boot) as () => void)();
  };

  it("keeps what a page showed, with the household's choices, and reads it back", () => {
    const shown = applyAppearance(
      { theme: "light", daylightTint: true, textSize: "xl", reduceMotion: false, display: true },
      at(15),
      document.createElement("html"),
    );
    rememberAppearance(shown, { choice: "light", daylightTint: true, sun: OCTOBER }, 1000);
    expect(rememberedAppearance()).toEqual({
      v: 1,
      at: 1000,
      theme: "light",
      daypart: "afternoon",
      textSize: "xl",
      reduceMotion: false,
      choice: "light",
      daylightTint: true,
      sun: OCTOBER,
    });
  });

  it("previews the setup wizard's choice at once, and keeps it for the next page (ADR 0034)", () => {
    const root = document.createElement("html");
    previewTheme("dark", new Date(2026, 9, 7, 15), root);
    expect(root.dataset.theme).toBe("dark");
    expect(rememberedAppearance()).toMatchObject({ theme: "dark", choice: "dark", sun: null });
    // Auto in the phone's shell is the device's own: no data-theme at all.
    previewTheme("auto", new Date(2026, 9, 7, 15), root);
    expect(root.dataset.theme).toBeUndefined();
    expect(rememberedAppearance()).toMatchObject({ theme: null, choice: "auto" });
  });

  it("ignores a memory it can't read", () => {
    const good = {
      v: 1,
      at: 1,
      theme: "dark",
      daypart: "night",
      textSize: null,
      reduceMotion: false,
      choice: "auto",
      daylightTint: true,
      sun: null,
    };
    for (const junk of [
      "{",
      "null",
      "[]",
      JSON.stringify({ ...good, v: 2 }),
      JSON.stringify({ ...good, theme: "pink" }),
      JSON.stringify({ ...good, daypart: "noon" }),
      JSON.stringify({ ...good, sun: { sunrise: "early" } }),
    ]) {
      localStorage.setItem(APPEARANCE_KEY, junk);
      expect(rememberedAppearance(), junk).toBeNull();
    }
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(good));
    expect(rememberedAppearance()).toEqual(good);
  });

  it("is on <html> before anything paints: the boot script", () => {
    rememberAppearance(
      { theme: "dark", daypart: "evening", textSize: "large", reduceMotion: true },
      { choice: "auto", daylightTint: true, sun: null },
    );
    runBoot();
    expect(document.documentElement.dataset).toMatchObject({
      theme: "dark",
      daypart: "evening",
      textSize: "large",
      reduceMotion: "",
    });
  });

  it("leaves the first paint to the device when nothing usable is remembered", () => {
    runBoot();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    localStorage.setItem(APPEARANCE_KEY, "{");
    runBoot();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    // A phone on Auto remembers no theme: the device keeps deciding.
    rememberAppearance(
      { theme: null, daypart: "midday", textSize: null, reduceMotion: false },
      { choice: "auto", daylightTint: true, sun: null },
    );
    runBoot();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.documentElement.dataset.daypart).toBe("midday");
  });
});

describe("a theme change (UX §9, ADR 0032)", () => {
  const base = { daylightTint: true, textSize: "standard", display: true } as const;
  const shown = (root: HTMLElement, theme: "light" | "dark", reduceMotion = false) =>
    applyAppearance({ ...base, theme, reduceMotion }, at(11), root);

  it("crossfades every color together for 600 ms, once the fades are armed", () => {
    vi.useFakeTimers();
    try {
      const root = document.createElement("html");
      shown(root, "light");
      expect(root.dataset.themeSwitching).toBeUndefined();
      shown(root, "dark");
      // Not armed yet: the first paint and the household's first appearance snap.
      expect(root.dataset.themeSwitching).toBeUndefined();
      root.dataset.motionReady = "";
      shown(root, "dark");
      expect(root.dataset.themeSwitching).toBeUndefined();
      shown(root, "light");
      expect(root.dataset.themeSwitching).toBe("");
      vi.advanceTimersByTime(CROSSFADE_MS - 1);
      expect(root.dataset.themeSwitching).toBe("");
      vi.advanceTimersByTime(1);
      expect(root.dataset.themeSwitching).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("has nothing to ease with Reduce motion", () => {
    const root = document.createElement("html");
    root.dataset.motionReady = "";
    shown(root, "light", true);
    shown(root, "dark", true);
    expect(root.dataset.themeSwitching).toBeUndefined();
  });
});
