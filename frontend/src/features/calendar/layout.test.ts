import { describe, expect, it } from "vitest";

import {
  byDay,
  daysCovered,
  isOn,
  isPast,
  nowSlot,
  shownFor,
  todayParts,
  type Placed,
} from "./layout";

function timed(title: string, start: string, end: string, members: string[] = []): Placed {
  return {
    key: title,
    title,
    all_day: false,
    start_local: start,
    end_local: end,
    member_ids: members,
  };
}

function allDay(title: string, start: string, end: string): Placed {
  return { key: title, title, all_day: true, start_date: start, end_date: end, member_ids: [] };
}

const WEEK = [
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
  "2026-10-08",
  "2026-10-09",
  "2026-10-10",
];

describe("the days an occurrence covers", () => {
  it("counts an all-day span's dates, end exclusive", () => {
    expect(daysCovered(allDay("Visit", "2026-10-08", "2026-10-11"))).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
  });

  it("gives an evening that ends at midnight to its own day", () => {
    expect(daysCovered(timed("Party", "2026-10-09T20:00:00", "2026-10-10T00:00:00"))).toEqual([
      "2026-10-09",
    ]);
    expect(daysCovered(timed("Trip", "2026-10-09T17:00:00", "2026-10-11T14:00:00"))).toEqual([
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });
});

describe("the week's columns", () => {
  it("puts spans in the band with arrows on all but the last day, timed ones in order", () => {
    const columns = byDay(
      [
        timed("Soccer", "2026-10-08T16:00:00", "2026-10-08T17:00:00"),
        timed("Dentist", "2026-10-08T14:30:00", "2026-10-08T15:30:00"),
        allDay("Visit", "2026-10-08", "2026-10-10"),
      ],
      WEEK,
    );
    const thursday = columns.get("2026-10-08");
    expect(thursday?.timed.map((e) => e.occurrence.title)).toEqual(["Dentist", "Soccer"]);
    expect(thursday?.allDay.map((e) => [e.occurrence.title, e.continues])).toEqual([
      ["Visit", true],
    ]);
    expect(columns.get("2026-10-09")?.allDay.map((e) => [e.continues, e.continued])).toEqual([
      [false, true],
    ]);
  });

  it("ignores days outside the week", () => {
    const columns = byDay([allDay("Long", "2026-10-01", "2026-10-30")], WEEK);
    expect([...columns.values()].every((c) => c.allDay.length === 1)).toBe(true);
    expect(columns.size).toBe(7);
  });
});

describe("now", () => {
  const now = "2026-10-08T15:00:00";
  const dentist = timed("Dentist", "2026-10-08T14:30:00", "2026-10-08T15:30:00");
  const vet = timed("Vet", "2026-10-08T09:00:00", "2026-10-08T09:30:00");
  const soccer = timed("Soccer", "2026-10-08T16:00:00", "2026-10-08T17:00:00");

  it("knows what's past and what's on", () => {
    expect(isPast(vet, now)).toBe(true);
    expect(isOn(dentist, now)).toBe(true);
    expect(isPast(dentist, now)).toBe(false);
    expect(isPast(allDay("Today", "2026-10-08", "2026-10-09"), now)).toBe(false);
    expect(isPast(allDay("Yesterday", "2026-10-07", "2026-10-08"), now)).toBe(true);
  });

  it("puts the now line under the last finished chip", () => {
    const column = byDay([vet, dentist, soccer], ["2026-10-08"]).get("2026-10-08");
    expect(nowSlot(column?.timed ?? [], now)).toBe(1);
    expect(nowSlot(column?.timed ?? [], "2026-10-08T08:00:00")).toBe(0);
  });

  it("splits today for the Today panel", () => {
    const parts = todayParts([vet, dentist, soccer], now);
    expect(parts.now.map((o) => o.title)).toEqual(["Dentist"]);
    expect(parts.upNext?.title).toBe("Soccer");
    expect(parts.later).toEqual([]);
  });
});

describe("the person filter", () => {
  it("keeps the chosen people's events and everyone's", () => {
    const people = new Set(["mia"]);
    expect(shownFor(timed("Mia's", "a", "b", ["mia"]), people)).toBe(true);
    expect(shownFor(timed("Leo's", "a", "b", ["leo"]), people)).toBe(false);
    expect(shownFor(timed("Family", "a", "b"), people)).toBe(true);
    expect(shownFor(timed("Leo's", "a", "b", ["leo"]), new Set())).toBe(true);
  });
});
