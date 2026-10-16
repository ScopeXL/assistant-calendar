import { describe, expect, it } from "vitest";

import { fieldsFor } from "./AddPanel";
import { draftFromEvent, draftToFields, firstDayOf, type Draft } from "./EventEditor";
import type { Repeat } from "./repeat";
import type { CalendarEvent } from "./types";

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
    kept: null,
    calendarId: null,
    color: null,
    location: "",
    notes: "",
    reminders: [],
    remindersOff: false,
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

function event(change: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "e1",
    calendar_id: "home",
    title: "Rent",
    description: "",
    location: "",
    all_day: true,
    start: null,
    end: null,
    start_date: "2026-10-09",
    end_date: "2026-10-10",
    tzid: null,
    rrule: null,
    repeat_text: null,
    member_ids: [],
    reminders: [],
    reminders_off: false,
    color: null,
    is_override: false,
    ...change,
  } as CalendarEvent;
}

describe("a rule the editor can't read", () => {
  // The 15th of each month, on an event that starts on the 9th: no preset or Custom shape.
  const RULE = "FREQ=MONTHLY;BYMONTHDAY=15";
  const rent = event({ rrule: RULE, repeat_text: "Every month on the 15th" });

  it("is kept as it is, with the server's words for it", () => {
    const opened = draftFromEvent(rent, null);
    expect(opened.repeat).toBeNull();
    expect(opened.kept).toEqual({ rrule: RULE, text: "Every month on the 15th" });
  });

  it("goes back unchanged when only the title was touched, and is never cleared", () => {
    const opened = { ...draftFromEvent(rent, null), title: "Rent is due" };
    expect(draftToFields(opened).rrule).toBe(RULE);
    const all = fieldsFor(opened, "all", rent, null);
    expect(all.rrule).toBe(RULE);
    expect(all.clear_rrule).toBe(false);
  });

  it("gives way once a repeat is picked, or Doesn't repeat", () => {
    const opened = draftFromEvent(rent, null);
    const weekly = {
      ...opened,
      kept: null,
      repeat: { freq: "weekly", interval: 1, weekdays: [4] },
    };
    expect(draftToFields(weekly as Draft).rrule).toBe("FREQ=WEEKLY;BYDAY=FR");
    const none = fieldsFor({ ...opened, kept: null }, "all", rent, null);
    expect(none.rrule).toBeNull();
    expect(none.clear_rrule).toBe(true);
  });

  it("reads a rule the presets can't say but Custom can", () => {
    const opened = draftFromEvent(
      event({ rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH", start_date: "2026-10-06" }),
      null,
      6,
    );
    expect(opened.kept).toBeNull();
    expect(opened.repeat).toEqual({ freq: "weekly", interval: 2, weekdays: [1, 3] });
  });
});

describe("who it's for (P1, ADR 0034)", () => {
  it("sends the people only once Who was chosen, so a title or a synced calendar decides", () => {
    expect("member_ids" in draftToFields(draft({ memberIds: ["mia"] }))).toBe(false);
    expect(draftToFields(draft({ memberIds: ["mia"], whoTouched: true })).member_ids).toEqual([
      "mia",
    ]);
    // Everyone, picked by hand, is a choice too.
    expect(draftToFields(draft({ memberIds: [], whoTouched: true })).member_ids).toEqual([]);
  });
});

describe("reminders (R1–R3, ADR 0034)", () => {
  it("sends reminders only once the row was picked, in the event's three states", () => {
    expect("reminders" in draftToFields(draft({ reminders: [30] }))).toBe(false);
    const none = draftToFields(draft({ remindersOff: true, remindChanged: true }));
    expect([none.reminders, none.reminders_off]).toEqual([[], true]);
    const hour = draftToFields(draft({ reminders: [60], remindChanged: true }));
    expect([hour.reminders, hour.reminders_off]).toEqual([[60], false]);
    const two = draftToFields(draft({ reminders: [10, 60], remindChanged: true }));
    expect(two.reminders).toEqual([10, 60]);
    const usual = draftToFields(draft({ reminders: [], remindChanged: true }));
    expect([usual.reminders, usual.reminders_off]).toEqual([[], false]);
  });

  it("opens one changed occurrence on its own words and reminders, the series' timing", () => {
    const series = event({
      title: "Soccer practice",
      location: "Field 3",
      reminders: [30],
      rrule: "FREQ=WEEKLY;BYDAY=TU,TH",
    });
    const final = event({
      title: "Soccer final",
      location: "Field 1",
      description: "Bring the cup.",
      reminders: [15],
      is_override: true,
    });
    const opened = draftFromEvent(series, null, 0, final);
    expect([opened.title, opened.location, opened.notes, opened.reminders]).toEqual([
      "Soccer final",
      "Field 1",
      "Bring the cup.",
      [15],
    ]);
    expect(opened.repeat).not.toBeNull();
    // Not changed on its own: the series' words.
    expect(draftFromEvent(series, null, 0, series).title).toBe("Soccer practice");
  });
});

describe("the person's color (C1, ADR 0034)", () => {
  it("clears a color the event had, at every scope", () => {
    const painted = event({ color: "copper" });
    const opened = { ...draftFromEvent(painted, null), color: null };
    for (const scope of ["this", "following", "all"] as const) {
      expect(fieldsFor(opened, scope, painted, null).clear_color, scope).toBe(true);
    }
  });

  it("clears nothing when there was nothing, or a color is still chosen", () => {
    const plain = event({ color: null });
    expect(fieldsFor(draftFromEvent(plain, null), "all", plain, null).clear_color).toBe(false);
    const painted = event({ color: "copper" });
    const lime = { ...draftFromEvent(painted, null), color: "lime" as const };
    const fields = fieldsFor(lime, "all", painted, null);
    expect(fields.clear_color).toBe(false);
    expect(fields.color).toBe("lime");
  });
});

describe("the household's first day of the week", () => {
  const SUN_MON: Repeat = { freq: "weekly", interval: 2, weekdays: [0, 6] };

  it("is written into a rule only when it changes the rule's days", () => {
    const sunday = draft({ day: "2026-10-11", repeat: SUN_MON });
    expect(draftToFields(sunday, { weekStartsOn: 6 }).rrule).toBe(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,SU;WKST=SU",
    );
    expect(draftToFields(sunday, { weekStartsOn: 0 }).rrule).toBe(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,SU",
    );
    expect(draftToFields(draft({ repeat: WEEKDAYS }), { weekStartsOn: 6 }).rrule).toBe(
      "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
    );
  });
});
