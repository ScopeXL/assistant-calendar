import { afterEach, describe, expect, it } from "vitest";

import {
  addDays,
  clockSuffix,
  formatClock,
  formatTime,
  monthGrid,
  orderedWeekdays,
  rollingWeek,
  setDatePreferences,
  weekOf,
  weekSpan,
  weekdayLong,
  weekdayOf,
  weekdayShort,
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

  it("rolls a week around a day: the day before it, the day, and the five after (ADR 0033)", () => {
    expect(rollingWeek("2026-10-09")).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    // Paging moves it seven days, and it's named by its span like any other week.
    expect(rollingWeek(addDays("2026-10-09", 7))[0]).toBe("2026-10-15");
    expect(weekSpan(rollingWeek("2026-10-09"))).toBe("Oct 8–14");
    expect(rollingWeek("2026-10-31")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
    ]);
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

describe("weekdays in the household's order", () => {
  it("starts on the household's day", () => {
    expect(orderedWeekdays(6)).toEqual([6, 0, 1, 2, 3, 4, 5]); // Sunday first
    expect(orderedWeekdays(0)).toEqual([0, 1, 2, 3, 4, 5, 6]); // Monday first
    expect(orderedWeekdays(5)).toEqual([5, 6, 0, 1, 2, 3, 4]); // Saturday first
  });

  it("names them, 0 Monday to 6 Sunday", () => {
    expect(orderedWeekdays(6).map(weekdayShort)).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect([0, 3, 6].map(weekdayLong)).toEqual(["Monday", "Thursday", "Sunday"]);
    expect(weekdayShort(weekdayOf("2026-10-07"))).toBe("Wed");
  });
});

describe("a month as whole weeks", () => {
  it("starts on the household's day and covers the month", () => {
    const sundays = monthGrid("2026-10-07", 0, 6);
    expect(sundays.first).toBe("2026-10-01");
    expect(sundays.days[0]).toBe("2026-09-27");
    expect(sundays.weeks).toHaveLength(5);
    expect(sundays.days.at(-1)).toBe("2026-10-31");
    const mondays = monthGrid("2026-10-07", 0, 0);
    expect(mondays.days[0]).toBe("2026-09-28");
    expect(mondays.weeks).toHaveLength(5);
    expect(mondays.days.at(-1)).toBe("2026-11-01");
  });

  it("pages across a year's end, and holds a six-week month", () => {
    const january = monthGrid("2026-12-15", 1, 6);
    expect(january.first).toBe("2027-01-01");
    expect(january.days[0]).toBe("2026-12-27");
    const before = monthGrid("2026-01-15", -1, 6);
    expect(before.first).toBe("2025-12-01");
    // August 2026 starts on a Saturday: six Sunday-first weeks.
    expect(monthGrid("2026-08-10", 0, 6).weeks).toHaveLength(6);
    for (const week of monthGrid("2026-08-10", 0, 6).weeks) expect(week).toHaveLength(7);
  });
});
