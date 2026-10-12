import { describe, expect, it } from "vitest";

import { atHour, atMinute, EVENT_TIMES, timeChips } from "./times";

describe("the chips on a time row", () => {
  it("are the suggestions in clock order", () => {
    expect(timeChips(EVENT_TIMES, null)).toEqual(["09:00", "12:00", "15:00", "18:00"]);
    expect(timeChips(["19:00", "07:00"], "07:00")).toEqual(["07:00", "19:00"]);
  });

  it("hold an odd chosen time where it belongs", () => {
    expect(timeChips(EVENT_TIMES, "10:30")).toEqual(["09:00", "10:30", "12:00", "15:00", "18:00"]);
    expect(timeChips(EVENT_TIMES, "06:15")[0]).toBe("06:15");
  });

  it("an hour keeps the minutes, and minutes keep the hour", () => {
    expect(atHour(14, "09:45")).toBe("14:45");
    expect(atHour(7, null)).toBe("07:00");
    expect(atMinute("30", "14:45")).toBe("14:30");
    expect(atMinute("15", null)).toBe("09:15");
  });
});
