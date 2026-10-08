import { beforeEach, describe, expect, it } from "vitest";

import { setDatePreferences } from "../../lib/dates";
import { sourceName, type Account } from "./data";
import { pillText } from "./SyncPill";

function account(overrides: Partial<Account>): Account {
  return {
    id: "account-1",
    provider: "caldav",
    label: "iCloud",
    address: "caldav.icloud.com",
    calendars: [],
    interval_min: 5,
    last_error: null,
    last_error_at: null,
    last_success_at: null,
    last_sync_at: null,
    next_sync_at: null,
    owner_member_id: null,
    read_only: false,
    status: "connected",
    syncing: false,
    ...overrides,
  };
}

beforeEach(() => {
  setDatePreferences({ timezone: "America/New_York", timeFormat: "12h" });
});

describe("pillText", () => {
  it("asks for a refused password again", () => {
    expect(pillText(account({ status: "needs_reconnect" }))).toBe(
      "iCloud needs its password again.",
    );
    expect(pillText(account({ provider: "google", status: "needs_reconnect" }))).toBe(
      "Google signed Sunroom out.",
    );
  });

  it("says since when an account hasn't answered, and that its events stay", () => {
    const quiet = account({ status: "error", last_success_at: "2026-10-07T13:10:00Z" });
    expect(pillText(quiet)).toBe("iCloud hasn't answered since 9:10 AM. Showing what we had.");
    expect(pillText(account({ status: "error" }))).toBe(
      "iCloud hasn't answered. Showing what we had.",
    );
  });
});

describe("sourceName", () => {
  it("names the service a family knows", () => {
    expect(sourceName(account({ provider: "holidays", label: "Holidays" }))).toBe("Holidays");
    expect(sourceName(account({ provider: "google", label: "Sam's Google" }))).toBe("Google");
    const secretAddress = account({ provider: "ics", address: "calendar.google.com/…/basic.ics" });
    expect(sourceName(secretAddress)).toBe("Google");
    expect(sourceName(account({ address: "dav.example.org", label: "Work server" }))).toBe(
      "Work server",
    );
  });
});
