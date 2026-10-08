import { describe, expect, it } from "vitest";

import { draftToFields, firstDayOf, type Draft } from "./EventEditor";
import type { Repeat } from "./repeat";

const WEEKDAYS: Repeat = { freq: "weekly", interval: 1, weekdays: [0, 1, 2, 3, 4] };

function draft(change: Partial<Draft>): Draft {
  return {
    title: "School drop-off",
    day: "2026-10-10", // a Saturday
    allDay: false,
    lastDay: null,
    start: "08:00",
    minutes: 30,
    memberIds: [],
    repeat: null,
    repeatEnd: {},
    calendarId: null,
    color: null,
    location: "",
    notes: "",
    reminder: null,
    ...change,
  };
}

describe("firstDayOf", () => {
  it("starts a weekly repeat on its first day on or after the chosen one", () => {
    expect(firstDayOf(WEEKDAYS, "2026-10-10")).toBe("2026-10-12");
    expect(firstDayOf(WEEKDAYS, "2026-10-08")).toBe("2026-10-08");
    expect(firstDayOf({ freq: "daily", interval: 1 }, "2026-10-10")).toBe("2026-10-10");
    expect(firstDayOf(null, "2026-10-10")).toBe("2026-10-10");
  });
});

describe("draftToFields", () => {
  it("moves a new weekday repeat chosen on a Saturday to Monday", () => {
    const fields = draftToFields(draft({ repeat: WEEKDAYS }));
    expect([fields.start, fields.end]).toEqual(["2026-10-12T08:00", "2026-10-12T08:30"]);
    expect(fields.rrule).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  });

  it("leaves one occurrence where it was put", () => {
    const fields = draftToFields(draft({ repeat: WEEKDAYS }), { align: false });
    expect(fields.start).toBe("2026-10-10T08:00");
  });

  it("keeps an all-day span's length when its start moves", () => {
    const fields = draftToFields(
      draft({
        allDay: true,
        lastDay: "2026-10-11",
        repeat: { freq: "weekly", interval: 1, weekdays: [0] },
      }),
    );
    expect([fields.start_date, fields.end_date]).toEqual(["2026-10-12", "2026-10-14"]);
  });
});
