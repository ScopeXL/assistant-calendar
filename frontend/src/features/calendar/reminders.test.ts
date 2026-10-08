import { describe, expect, it } from "vitest";

import { dueNow, remindersOf, type Remindable } from "./reminders";

function timed(title: string, start: string, reminders: number[]): Remindable {
  return {
    key: `${title}|${start}`,
    title,
    status: "confirmed",
    all_day: false,
    start_local: start,
    start_date: null,
    reminders,
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
