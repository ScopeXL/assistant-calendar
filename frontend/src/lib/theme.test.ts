import { describe, expect, it } from "vitest";

import { applyAppearance, daypart, resolveTheme } from "./theme";

describe("the theme (ADR 0008)", () => {
  it("resolves Auto by the clock: dark from 7 PM to 7 AM without a location", () => {
    expect(resolveTheme("auto", 6)).toBe("dark");
    expect(resolveTheme("auto", 7)).toBe("light");
    expect(resolveTheme("auto", 18)).toBe("light");
    expect(resolveTheme("auto", 19)).toBe("dark");
    expect(resolveTheme("light", 23)).toBe("light");
  });

  it("steps the wall's tint through the day (UX §7)", () => {
    expect([8, 11, 15, 18].map((hour) => daypart("light", hour, true))).toEqual([
      "dawn",
      "midday",
      "afternoon",
      "dusk",
    ]);
    expect([20, 23].map((hour) => daypart("dark", hour, true))).toEqual(["evening", "night"]);
    expect(daypart("light", 8, false)).toBe("midday");
    expect(daypart("dark", 20, false)).toBe("night");
  });

  it("puts it all on <html> for the wall screen, and leaves a phone on Auto to the phone", () => {
    const root = document.createElement("html");
    applyAppearance(
      { theme: "auto", daylightTint: true, textSize: "xl", reduceMotion: true, display: true },
      21,
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
      11,
      root,
    );
    expect(root.dataset.theme).toBeUndefined();
    expect(root.dataset.textSize).toBeUndefined();
    expect(root.dataset.reduceMotion).toBeUndefined();
    expect(root.dataset.daypart).toBe("midday");
  });
});
