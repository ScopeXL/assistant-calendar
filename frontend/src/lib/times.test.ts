import { describe, expect, it } from "vitest";

import { atHour, atMinute } from "./times";

describe("a time picked in two taps", () => {
  it("an hour keeps the minutes, and minutes keep the hour", () => {
    expect(atHour(14, "09:45")).toBe("14:45");
    expect(atHour(7, null)).toBe("07:00");
    expect(atMinute("30", "14:45")).toBe("14:30");
    expect(atMinute("15", null)).toBe("09:15");
  });
});
