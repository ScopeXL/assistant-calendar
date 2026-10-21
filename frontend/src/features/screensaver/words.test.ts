import { beforeEach, describe, expect, it } from "vitest";

import { setDatePreferences } from "../../lib/dates";
import { connectedLine, libraryLine, picksSentence } from "./words";

const choices = {
  people: [
    { id: "p-mia", name: "Mia" },
    { id: "p-leo", name: "Leo" },
  ],
  albums: [
    { id: "a-beach", name: "Beach 2026" },
    { id: "a-zoo", name: "Zoo day" },
  ],
  tags: [{ id: "t-wall", name: "Wall" }],
};
const none = { people: [], albums: [], tags: [] };
const idle = {
  status: "connected",
  checking: false,
  pending: 0,
  photo_count: 480,
  last_scan_at: "2026-10-07T13:10:00Z",
  last_error: null,
};

beforeEach(() => {
  setDatePreferences({ timezone: "America/New_York", timeFormat: "12h" });
});

describe("a photo library's words (ADR 0036)", () => {
  it("says plainly that every photo is shown when nothing is picked", () => {
    expect(picksSentence(none, choices, 500)).toBe(
      "Showing every photo, newest first, up to 500. Pick people, albums or tags to narrow it.",
    );
    expect(picksSentence(none, undefined, 1000)).toBe(
      "Showing every photo, newest first, up to 1,000. Pick people, albums or tags to narrow it.",
    );
  });

  it("names the picks, any of them matching", () => {
    expect(
      picksSentence(
        { people: ["p-mia", "p-leo"], albums: ["a-beach"], tags: ["t-wall"] },
        choices,
        500,
      ),
    ).toBe(
      "Showing photos of Mia or Leo, or in Beach 2026, or tagged Wall, newest first, up to 500.",
    );
    expect(picksSentence({ ...none, albums: ["a-beach", "a-zoo"] }, choices, 250)).toBe(
      "Showing photos in Beach 2026 or Zoo day, newest first, up to 250.",
    );
    // A pick the library no longer has.
    expect(picksSentence({ ...none, people: ["p-mia", "p-gone"] }, choices, 500)).toBe(
      "Showing photos of Mia or one that's gone, newest first, up to 500.",
    );
    expect(picksSentence({ ...none, tags: ["t-1", "t-2"] }, choices, 500)).toBe(
      "Showing photos tagged 2 that are gone, newest first, up to 500.",
    );
  });

  it("says how a library is doing, in red only when a parent can fix it", () => {
    expect(libraryLine(idle)).toEqual({ text: "Checked 9:10 AM · 480 photos", trouble: false });
    expect(libraryLine({ ...idle, pending: 360, photo_count: 120, checking: true })).toEqual({
      text: "Bringing in photos… 120 of 480",
      trouble: false,
    });
    expect(libraryLine({ ...idle, checking: true })).toEqual({ text: "Checking…", trouble: false });
    expect(libraryLine({ ...idle, last_scan_at: null, photo_count: 0 })).toEqual({
      text: "Not checked yet",
      trouble: false,
    });
    expect(libraryLine({ ...idle, status: "needs_reconnect" })).toEqual({
      text: "Needs its key again",
      trouble: true,
    });
    expect(
      libraryLine({ ...idle, status: "error", last_error: "That server didn't answer in time." }),
    ).toEqual({ text: "That server didn't answer in time.", trouble: true });
    expect(libraryLine({ ...idle, last_error: "Photos need room." })).toEqual({
      text: "Photos need room.",
      trouble: true,
    });
  });

  it("says what the server is, when it's connected", () => {
    expect(connectedLine({ version: "2.7.5", library_photos: 12345 }, "Immich")).toBe(
      "Connected · Immich 2.7 · 12,345 photos",
    );
    expect(connectedLine({ version: "3.3.4", library_photos: null }, "Immich")).toBe(
      "Connected · Immich 3.3",
    );
    expect(connectedLine({ version: null, library_photos: 1 }, "Immich")).toBe(
      "Connected · Immich · 1 photo",
    );
  });
});
