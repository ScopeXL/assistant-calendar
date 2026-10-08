import { describe, expect, it } from "vitest";

import { isNight } from "./night";

describe("the sleep schedule", () => {
  it("is off without both times", () => {
    expect(isNight(null, "06:30", 23, 0)).toBe(false);
    expect(isNight("22:00", undefined, 23, 0)).toBe(false);
  });

  it("wraps past midnight", () => {
    expect(isNight("22:00", "06:30", 21, 59)).toBe(false);
    expect(isNight("22:00", "06:30", 22, 0)).toBe(true);
    expect(isNight("22:00", "06:30", 3, 15)).toBe(true);
    expect(isNight("22:00", "06:30", 6, 30)).toBe(false);
  });

  it("works within one day too", () => {
    expect(isNight("13:00", "15:00", 14, 0)).toBe(true);
    expect(isNight("13:00", "15:00", 15, 0)).toBe(false);
  });
});
