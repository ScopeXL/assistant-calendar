import { afterEach, describe, expect, it } from "vitest";

import {
  addDays,
  clockSuffix,
  formatClock,
  formatTime,
  setDatePreferences,
  weekOf,
  weekSpan,
  weekdayOf,
  zonedParts,
} from "./dates";

afterEach(() => {
  setDatePreferences({ timezone: "UTC", timeFormat: "12h" });
});

describe("calendar days", () => {
  it("moves across months, years and daylight-saving changes without drifting", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-11-01", 7)).toBe("2026-11-08"); // US clocks change on Nov 1
    expect(weekdayOf("2026-10-07")).toBe(2); // a Wednesday: 0 Monday … 6 Sunday
  });

  it("starts the week on the household's chosen day", () => {
    expect(weekOf("2026-10-07", 6)).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
    expect(weekOf("2026-10-07", 0)[0]).toBe("2026-10-05");
  });

  it("names a week's span as the board title does (UX §3)", () => {
    expect(weekSpan(weekOf("2026-10-07", 6))).toBe("Oct 4–10");
    expect(weekSpan(weekOf("2026-09-30", 6))).toBe("Sep 27 – Oct 3");
  });
});

describe("times in the household's zone", () => {
  it("shows the household's time, not the device's", () => {
    setDatePreferences({ timezone: "America/New_York", timeFormat: "12h" });
    const moment = new Date(Date.UTC(2026, 9, 7, 20, 41));
    expect(zonedParts(moment)).toEqual({ day: "2026-10-07", hour: 16, minute: 41, weekday: 2 });
    expect(formatTime(moment)).toBe("4:41 PM");
    expect(formatClock(moment)).toBe("4:41");
    expect(clockSuffix(moment)).toBe("PM");
  });

  it("uses the 24-hour clock when asked", () => {
    setDatePreferences({ timezone: "Europe/Lisbon", timeFormat: "24h" });
    const moment = new Date(Date.UTC(2026, 9, 7, 20, 5));
    expect(formatTime(moment)).toBe("21:05");
    expect(formatClock(moment)).toBe("21:05");
    expect(clockSuffix(moment)).toBe("");
  });

  it("knows the day turned over at the household's midnight", () => {
    setDatePreferences({ timezone: "America/Los_Angeles", timeFormat: "12h" });
    expect(zonedParts(new Date(Date.UTC(2026, 9, 8, 6, 59))).day).toBe("2026-10-07");
    expect(zonedParts(new Date(Date.UTC(2026, 9, 8, 7, 0))).day).toBe("2026-10-08");
  });
});
