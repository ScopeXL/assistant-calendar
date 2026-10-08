import { describe, expect, it } from "vitest";

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
    const work = calendar({ name: "Work", source_label: "iCloud", read_only: false });
    expect(sourceLine(work, false)).toBe("iCloud · Work");
  });

  it("says where to change an event Sunroom can only show", () => {
    expect(sourceLine(calendar({ name: "Work", source_label: "iCloud" }), true)).toBe(
      "From iCloud · Work. Change it in the Calendar app.",
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
