import { describe, expect, it } from "vitest";

import { applyAppearance, daypart, resolveTheme } from "./theme";

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
});
