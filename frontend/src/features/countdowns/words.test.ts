import { describe, expect, it } from "vitest";

import { comingUpText, daysText, turningText } from "./words";

describe("countdowns' words", () => {
  it("counts down in days, then says Tomorrow and Today!", () => {
    expect(daysText(12)).toBe("12 days");
    expect(daysText(2)).toBe("2 days");
    expect(daysText(1)).toBe("Tomorrow");
    expect(daysText(0)).toBe("Today!");
  });

  it("writes the Today panel's lines", () => {
    expect(comingUpText("Mia's birthday", 12)).toBe("Mia's birthday · 12 days");
    expect(comingUpText("Camping trip", 1)).toBe("Tomorrow: Camping trip");
    expect(comingUpText("Mia's birthday", 0)).toBe("Today: Mia's birthday!");
  });

  it("says what a birthday brings", () => {
    expect(turningText(9)).toBe("Turns 9");
    expect(turningText(null)).toBeNull();
  });
});
