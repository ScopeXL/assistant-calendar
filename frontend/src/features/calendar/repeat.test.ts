import { afterEach, describe, expect, it } from "vitest";

import { setDatePreferences } from "../../lib/dates";
import {
  describeRepeat,
  repeatPresets,
  repeatToRRule,
  rruleToRepeat,
  sameRepeat,
  type Repeat,
  type RepeatEnd,
} from "./repeat";

afterEach(() => {
  setDatePreferences({ timezone: "UTC", timeFormat: "12h" });
});

const THURSDAY = "2025-10-09"; // the second Thursday of October 2025

const daily = (interval: number): Repeat => ({ freq: "daily", interval });
const weekly = (interval: number, weekdays: number[]): Repeat => ({
  freq: "weekly",
  interval,
  weekdays,
});
const monthlyOnDate = (interval: number): Repeat => ({ freq: "monthly", interval, by: "date" });
const monthlyOnWeekday = (interval: number): Repeat => ({
  freq: "monthly",
  interval,
  by: "weekday",
});
const yearly = (interval: number): Repeat => ({ freq: "yearly", interval });

describe("presets", () => {
  it("offers the editor's choices for a start day, in order", () => {
    expect(repeatPresets(THURSDAY)).toEqual([
      { key: "none", label: "Doesn't repeat", repeat: null },
      { key: "daily", label: "Every day", repeat: daily(1) },
      { key: "weekdays", label: "Every weekday", repeat: weekly(1, [0, 1, 2, 3, 4]) },
      { key: "weekly", label: "Every week on Thu", repeat: weekly(1, [3]) },
      { key: "biweekly", label: "Every 2 weeks on Thu", repeat: weekly(2, [3]) },
      { key: "monthly-date", label: "Every month on the 9th", repeat: monthlyOnDate(1) },
      {
        key: "monthly-weekday",
        label: "Every month on the second Thursday",
        repeat: monthlyOnWeekday(1),
      },
      { key: "yearly", label: "Every year on Oct 9", repeat: yearly(1) },
    ]);
  });

  it.each([
    // A fifth weekday is always the month's last.
    ["2026-10-29", "Every week on Thu", "Every month on the 29th", "the last Thursday", "Oct 29"],
    // A fourth that is also the last is the last.
    ["2026-11-26", "Every week on Thu", "Every month on the 26th", "the last Thursday", "Nov 26"],
    ["2026-10-22", "Every week on Thu", "Every month on the 22nd", "the fourth Thursday", "Oct 22"],
    ["2026-10-01", "Every week on Thu", "Every month on the 1st", "the first Thursday", "Oct 1"],
    ["2026-10-03", "Every week on Sat", "Every month on the 3rd", "the first Saturday", "Oct 3"],
    ["2026-10-11", "Every week on Sun", "Every month on the 11th", "the second Sunday", "Oct 11"],
    ["2026-10-13", "Every week on Tue", "Every month on the 13th", "the second Tuesday", "Oct 13"],
    ["2026-10-31", "Every week on Sat", "Every month on the 31st", "the last Saturday", "Oct 31"],
  ])("names the presets for %s", (day, week, date, weekday, yearDay) => {
    const labels = repeatPresets(day).map((preset) => preset.label);
    expect(labels).toEqual([
      "Doesn't repeat",
      "Every day",
      "Every weekday",
      week,
      week.replace("Every week", "Every 2 weeks"),
      date,
      `Every month on ${weekday}`,
      `Every year on ${yearDay}`,
    ]);
  });
});

describe("rules", () => {
  const day = "2026-10-08"; // the second Thursday of October 2026

  it("writes the RRULE values the server stores", () => {
    expect(repeatToRRule(daily(1), day)).toBe("FREQ=DAILY");
    expect(repeatToRRule(daily(3), day)).toBe("FREQ=DAILY;INTERVAL=3");
    expect(repeatToRRule(weekly(1, [3]), day)).toBe("FREQ=WEEKLY;BYDAY=TH");
    expect(repeatToRRule(weekly(2, [3]), day)).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=TH");
    expect(repeatToRRule(weekly(1, [0, 1, 2, 3, 4]), day)).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
    expect(repeatToRRule(weekly(1, [3, 1, 3]), day)).toBe("FREQ=WEEKLY;BYDAY=TU,TH");
    expect(repeatToRRule(weekly(1, []), day)).toBe("FREQ=WEEKLY;BYDAY=TH");
    expect(repeatToRRule(monthlyOnDate(1), day)).toBe("FREQ=MONTHLY");
    expect(repeatToRRule(monthlyOnWeekday(2), day)).toBe("FREQ=MONTHLY;INTERVAL=2;BYDAY=2TH");
    expect(repeatToRRule(monthlyOnWeekday(1), "2026-10-29")).toBe("FREQ=MONTHLY;BYDAY=-1TH");
    expect(repeatToRRule(yearly(1), day)).toBe("FREQ=YEARLY");
  });

  it("ends on a date or after a number of times", () => {
    const rule = (end: RepeatEnd) => repeatToRRule(weekly(2, [3]), day, end);
    expect(rule({ until: "2026-12-31" })).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=TH;UNTIL=20261231");
    expect(rule({ count: 10 })).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=TH;COUNT=10");
    expect(rule({ until: "2026-12-31", count: 10 })).toBe(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=TH;UNTIL=20261231",
    );
    expect(rule({ count: 5000 })).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=TH;COUNT=1000");
    expect(rule({})).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=TH");
  });

  it.each(["2025-10-09", "2026-10-29", "2026-11-26", "2026-10-31", "2026-10-11", "2028-02-29"])(
    "reads back every rule it writes for %s",
    (start) => {
      const repeats = [
        ...repeatPresets(start).flatMap((preset) => (preset.repeat ? [preset.repeat] : [])),
        daily(3),
        weekly(3, [0, 2, 4]),
        weekly(2, [5, 6]),
        monthlyOnDate(6),
        monthlyOnWeekday(2),
        yearly(2),
      ];
      const ends: RepeatEnd[] = [{}, { until: "2029-03-31" }, { count: 12 }];
      for (const repeat of repeats) {
        for (const end of ends) {
          expect(rruleToRepeat(repeatToRRule(repeat, start, end), start)).toEqual({ repeat, end });
        }
      }
    },
  );

  it("reads the same rules as other calendars write them", () => {
    const read = (rule: string) => rruleToRepeat(rule, day)?.repeat ?? null;
    expect(read("RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TH")).toEqual(weekly(1, [3]));
    expect(read("FREQ=WEEKLY;WKST=SU;BYDAY=TU,TH")).toEqual(weekly(1, [1, 3]));
    expect(read("FREQ=WEEKLY")).toEqual(weekly(1, [3]));
    expect(read("freq=daily;interval=2")).toEqual(daily(2));
    expect(read("FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR")).toEqual(weekly(1, [0, 1, 2, 3, 4]));
    expect(read("FREQ=MONTHLY;BYMONTHDAY=8")).toEqual(monthlyOnDate(1));
    expect(read("FREQ=MONTHLY;BYDAY=TH;BYSETPOS=2")).toEqual(monthlyOnWeekday(1));
    expect(read("FREQ=MONTHLY;BYDAY=+2TH")).toEqual(monthlyOnWeekday(1));
    expect(read("FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=8")).toEqual(yearly(1));
    expect(read("FREQ=WEEKLY;INTERVAL=2;BYDAY=SA;WKST=SU")).toEqual(weekly(2, [5]));
    expect(rruleToRepeat("FREQ=MONTHLY;BYDAY=-1TH", "2026-11-26")?.repeat).toEqual(
      monthlyOnWeekday(1),
    );
  });

  it.each([
    "FREQ=MONTHLY;BYMONTHDAY=9", // another date than the start day's
    "FREQ=MONTHLY;BYMONTHDAY=-1",
    "FREQ=MONTHLY;BYDAY=2TU", // another weekday
    "FREQ=MONTHLY;BYDAY=TH", // every Thursday of the month
    "FREQ=MONTHLY;BYDAY=2TH;BYSETPOS=1",
    "FREQ=YEARLY;BYMONTH=11",
    "FREQ=DAILY;INTERVAL=2;BYDAY=MO",
    "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA,SU;WKST=SU", // the week's first day matters here
    "FREQ=WEEKLY;BYDAY=1MO",
    "FREQ=WEEKLY;BYHOUR=9",
    "FREQ=HOURLY",
    "FREQ=WEEKLY;INTERVAL=0",
    "FREQ=WEEKLY;COUNT=5;UNTIL=20261231",
    "FREQ=WEEKLY;COUNT=0",
    "FREQ=WEEKLY;COUNT=1001",
    "FREQ=WEEKLY;UNTIL=20261331",
    "FREQ=WEEKLY;FREQ=DAILY",
    "INTERVAL=2",
    "nonsense",
    "",
  ])("calls %s custom", (rule) => {
    expect(rruleToRepeat(rule, day)).toBeNull();
  });

  it("says when the fourth Thursday is also the last", () => {
    // The editor writes "the last Thursday" for Nov 26, so "4TH" is a different rule.
    expect(rruleToRepeat("FREQ=MONTHLY;BYDAY=4TH", "2026-11-26")).toBeNull();
    expect(rruleToRepeat("FREQ=MONTHLY;BYDAY=4TH", "2026-10-22")?.repeat).toEqual(
      monthlyOnWeekday(1),
    );
  });

  it("reads an end time as the household's day", () => {
    setDatePreferences({ timezone: "America/New_York", timeFormat: "12h" });
    const until = (value: string) => rruleToRepeat(`FREQ=WEEKLY;UNTIL=${value}`, day)?.end;
    expect(until("20261231")).toEqual({ until: "2026-12-31" });
    expect(until("20270101T045959Z")).toEqual({ until: "2026-12-31" }); // 11:59 PM in New York
    expect(until("20261231T235959Z")).toEqual({ until: "2026-12-31" });
    expect(until("20261231T120000")).toEqual({ until: "2026-12-31" });
    expect(rruleToRepeat("FREQ=WEEKLY;COUNT=10", day)?.end).toEqual({ count: 10 });
  });
});

describe("descriptions", () => {
  it("names any repeat the way the presets do", () => {
    expect(describeRepeat(daily(1), THURSDAY)).toBe("Every day");
    expect(describeRepeat(daily(3), THURSDAY)).toBe("Every 3 days");
    expect(describeRepeat(weekly(1, [1, 3]), THURSDAY)).toBe("Every week on Tue and Thu");
    expect(describeRepeat(weekly(1, [4, 0, 2]), THURSDAY)).toBe("Every week on Mon, Wed and Fri");
    expect(describeRepeat(weekly(1, [0, 1, 2, 3, 4]), THURSDAY)).toBe("Every weekday");
    expect(describeRepeat(weekly(2, [0, 1, 2, 3, 4]), THURSDAY)).toBe(
      "Every 2 weeks on Mon, Tue, Wed, Thu and Fri",
    );
    expect(describeRepeat(weekly(1, [5, 6]), THURSDAY)).toBe("Every week on Sat and Sun");
    expect(describeRepeat(monthlyOnDate(2), THURSDAY)).toBe("Every 2 months on the 9th");
    expect(describeRepeat(monthlyOnWeekday(3), THURSDAY)).toBe(
      "Every 3 months on the second Thursday",
    );
    expect(describeRepeat(yearly(3), THURSDAY)).toBe("Every 3 years on Oct 9");
  });

  it("adds when it ends", () => {
    const biweekly = weekly(2, [3]);
    expect(describeRepeat(biweekly, THURSDAY, { until: "2025-12-31" })).toBe(
      "Every 2 weeks on Thu, until Dec 31",
    );
    expect(describeRepeat(biweekly, THURSDAY, { until: "2026-01-15" })).toBe(
      "Every 2 weeks on Thu, until Jan 15, 2026",
    );
    expect(describeRepeat(biweekly, THURSDAY, { count: 10 })).toBe(
      "Every 2 weeks on Thu, 10 times",
    );
    expect(describeRepeat(biweekly, THURSDAY, { count: 1 })).toBe("Every 2 weeks on Thu, once");
    expect(describeRepeat(biweekly, THURSDAY, {})).toBe("Every 2 weeks on Thu");
  });
});

describe("comparing", () => {
  it("compares weekdays as sets", () => {
    expect(sameRepeat(weekly(1, [3, 1]), weekly(1, [1, 3]))).toBe(true);
    expect(sameRepeat(weekly(1, [1]), weekly(2, [1]))).toBe(false);
    expect(sameRepeat(monthlyOnDate(1), monthlyOnWeekday(1))).toBe(false);
    expect(sameRepeat(daily(1), weekly(1, [0, 1, 2, 3, 4, 5, 6]))).toBe(false);
    expect(sameRepeat(null, null)).toBe(true);
    expect(sameRepeat(null, daily(1))).toBe(false);
  });
});
