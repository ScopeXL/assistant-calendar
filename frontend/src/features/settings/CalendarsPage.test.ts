import { describe, expect, it } from "vitest";

import type { CalendarInfo } from "../calendar/types";
import { whyItStays } from "./CalendarsPage";

function calendar(overrides: Partial<CalendarInfo>): CalendarInfo {
  return {
    id: "home",
    name: "Home",
    color: "sky",
    deleted: false,
    is_default: false,
    kind: "local",
    owner_member_id: null,
    read_only: false,
    source_label: null,
    version: 1,
    visible_on_display: true,
    ...overrides,
  };
}

describe("whyItStays (Settings → Calendars & Accounts, ADR 0032)", () => {
  const family = calendar({ id: "family", name: "Family", kind: "sync", source_label: "Apple" });

  it("keeps the last of the household's own, even when an account's calendar is the default", () => {
    const home = calendar({});
    const removed = calendar({ id: "old", name: "Old", deleted: true });
    expect(whyItStays(home, [home, { ...family, is_default: true }, removed])).toBe(
      "Sunroom keeps one calendar of its own, so this one stays.",
    );
  });

  it("keeps the default calendar while it's the default", () => {
    const home = calendar({ is_default: true });
    const kids = calendar({ id: "kids", name: "Kids' activities" });
    expect(whyItStays(home, [home, kids, family])).toBe(
      "New events go here, so it stays while it's the default calendar.",
    );
    expect(whyItStays(kids, [home, kids, family])).toBeNull();
  });
});
