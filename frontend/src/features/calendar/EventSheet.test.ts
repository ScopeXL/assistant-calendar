import { describe, expect, it } from "vitest";

import { calendarChoiceLabel, takesEvents } from "./data";
import { sourceLine } from "./EventSheet";
import type { CalendarInfo } from "./types";

function calendar(overrides: Partial<CalendarInfo>): CalendarInfo {
  return {
    id: "calendar-1",
    name: "School",
    color: "sea",
    deleted: false,
    is_default: false,
    kind: "sync",
    owner_member_id: null,
    read_only: true,
    source_label: "a calendar address",
    version: 1,
    visible_on_display: true,
    ...overrides,
  };
}

describe("sourceLine", () => {
  it("names a two-way calendar's account", () => {
    const work = calendar({ name: "Work", source_label: "Apple", read_only: false });
    expect(sourceLine(work, false)).toBe("Apple · Work");
  });

  it("says where to change an event Sunroom can only show", () => {
    expect(sourceLine(calendar({ name: "Work", source_label: "Apple" }), true)).toBe(
      "From Apple · Work. Change it in the Calendar app.",
    );
    expect(sourceLine(calendar({ name: "Family", source_label: "Google" }), true)).toBe(
      "From Google · Family. Change it in Google Calendar.",
    );
    expect(sourceLine(calendar({}), true)).toBe(
      "From a calendar address · School. It shows events only.",
    );
    expect(sourceLine(calendar({ name: "Holidays", source_label: "Holidays" }), true)).toBe(
      "From Holidays.",
    );
  });

  it("says nothing for the family's own calendars", () => {
    const own = calendar({ kind: "local", source_label: null, read_only: false });
    expect(sourceLine(own, false)).toBeNull();
  });
});

describe("choosing a calendar (Add's Calendar row, Settings' Default calendar)", () => {
  it("offers the calendars that take events: not read-only ones, not removed ones", () => {
    const home = calendar({ name: "Home", kind: "local", source_label: null, read_only: false });
    const family = calendar({ name: "Family", source_label: "Apple", read_only: false });
    const removed = calendar({ name: "Old", kind: "local", read_only: false, deleted: true });
    expect([home, family, calendar({}), removed].filter(takesEvents)).toEqual([home, family]);
  });

  it("names a synced calendar's account first, so two of one name can be told apart", () => {
    const own = calendar({ name: "Family", kind: "local", source_label: null, read_only: false });
    const apple = calendar({ name: "Family", source_label: "Apple", read_only: false });
    expect([own, apple].map(calendarChoiceLabel)).toEqual(["Family", "Apple · Family"]);
  });
});
