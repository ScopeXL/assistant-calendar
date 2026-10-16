import { describe, expect, it } from "vitest";

import { dueNow, effectiveReminders, remindersOf, type Remindable } from "./reminders";

function timed(
  title: string,
  start: string,
  reminders: number[],
  more: Partial<Remindable> = {},
): Remindable {
  return {
    key: `${title}|${start}`,
    title,
    status: "confirmed",
    all_day: false,
    start_local: start,
    start_date: null,
    reminders,
    reminders_off: false,
    read_only: false,
    ...more,
  };
}

function allDay(title: string, day: string, reminders: number[]): Remindable {
  return {
    key: `${title}|${day}`,
    title,
    status: "confirmed",
    all_day: true,
    start_local: null,
    start_date: day,
    reminders,
    reminders_off: false,
    read_only: false,
  };
}

describe("remindersOf", () => {
  it("says when each reminder is due, in the household's words", () => {
    const soccer = timed("Soccer practice", "2026-10-08T16:00:00", [10, 60, 1440]);
    expect(remindersOf([soccer]).map(({ at, message }) => [at, message])).toEqual([
      ["2026-10-08T15:50:00", "Soccer practice starts in 10 min"],
      ["2026-10-08T15:00:00", "Soccer practice starts in 1 hour"],
      ["2026-10-07T16:00:00", "Soccer practice is tomorrow at 4:00 PM"],
    ]);
  });

  it("reminds about all-day events at 8 AM, on the day or the day before", () => {
    const pajamas = allDay("Pajama day", "2026-10-09", [10, 1440]);
    expect(remindersOf([pajamas]).map(({ at, message }) => [at, message])).toEqual([
      ["2026-10-09T08:00:00", "Today: Pajama day"],
      ["2026-10-08T08:00:00", "Tomorrow: Pajama day"],
    ]);
  });

  it("leaves out cancelled occurrences", () => {
    const off = { ...timed("Piano lesson", "2026-10-08T15:30:00", [10]), status: "cancelled" };
    expect(remindersOf([off])).toEqual([]);
  });
});

describe("dueNow", () => {
  const soccer = timed("Soccer practice", "2026-10-08T16:00:00", [10]);

  it("shows a reminder from its minute for a few minutes, once", () => {
    expect(dueNow([soccer], "2026-10-08T15:49:00", new Set())).toEqual([]);
    const due = dueNow([soccer], "2026-10-08T15:50:00", new Set());
    expect(due.map((d) => d.message)).toEqual(["Soccer practice starts in 10 min"]);
    expect(dueNow([soccer], "2026-10-08T15:55:00", new Set()).length).toBe(1);
    expect(dueNow([soccer], "2026-10-08T15:55:00", new Set(due.map((d) => d.key)))).toEqual([]);
  });

  it("never reminds after the event has begun", () => {
    const late = timed("Vet", "2026-10-08T09:00:00", [10]);
    expect(dueNow([late], "2026-10-08T09:00:00", new Set())).toEqual([]);
  });

  it("drops a reminder the screen missed by more than the grace minutes", () => {
    const early = timed("Book club", "2026-10-08T19:00:00", [60]);
    expect(dueNow([early], "2026-10-08T18:11:00", new Set())).toEqual([]);
  });

  it("keeps an all-day reminder until its day is over", () => {
    const pajamas = allDay("Pajama day", "2026-10-09", [10]);
    expect(dueNow([pajamas], "2026-10-09T08:05:00", new Set()).map((d) => d.message)).toEqual([
      "Today: Pajama day",
    ]);
  });
});

describe("the household's Default reminder (ADR 0034)", () => {
  it("stands in for an event with none of its own, unless it says none", () => {
    expect(effectiveReminders(timed("Vet", "2026-10-07T09:00:00", []), 10)).toEqual([10]);
    expect(effectiveReminders(timed("Vet", "2026-10-07T09:00:00", [30, 60]), 10)).toEqual([30, 60]);
    const off = timed("Vet", "2026-10-07T09:00:00", [], { reminders_off: true });
    expect(effectiveReminders(off, 10)).toEqual([]);
    expect(effectiveReminders(timed("Vet", "2026-10-07T09:00:00", []), null)).toEqual([]);
  });

  it("never reaches a calendar that only shows events", () => {
    const holiday = timed("Columbus Day", "2026-10-12T00:00:00", [], { read_only: true });
    expect(effectiveReminders(holiday, 10)).toEqual([]);
  });

  it("is due at its minute like one of the event's own", () => {
    const vet = timed("Vet", "2026-10-07T09:00:00", []);
    expect(dueNow([vet], "2026-10-07T08:50:00", new Set(), 10).map((d) => d.message)).toEqual([
      "Vet starts in 10 min",
    ]);
    expect(dueNow([vet], "2026-10-07T08:50:00", new Set(), null)).toEqual([]);
  });
});
