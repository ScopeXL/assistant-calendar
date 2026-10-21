import { afterEach, describe, expect, it, vi } from "vitest";

import {
  backToNow,
  displayState,
  editorOpen,
  forgetView,
  holdIdle,
  idleHolds,
  resting,
  updateDisplay,
} from "./displayState";
import { lastActivity } from "./idle";

const MEMORY_KEY = "sunroom.display.view";
const ROOM_KEY = "sunroom.display.room";
const KEPT = {
  v: 1,
  view: "month",
  weekOffset: 0,
  day: null,
  monthOffset: 2,
  panelShown: false,
  railCollapsed: true,
  weekLayout: "hours",
  rollingWeek: true,
  hoursZoom: 2.25,
  people: ["mia", "leo"],
};

/** The module as a page that just loaded would get it, with what the browser kept. */
async function freshPage(): Promise<typeof import("./displayState")> {
  vi.resetModules();
  return import("./displayState");
}

afterEach(() => {
  forgetView();
  resting.set(false);
  localStorage.clear();
});

describe('what the wall is showing (UX §1 "Idle, wake and reset")', () => {
  it("starts on the household's choices: nothing is overridden on this screen", () => {
    const state = displayState.get();
    expect(state.view).toBeNull();
    expect(state.panelShown).toBeNull();
    expect(state.railCollapsed).toBeNull();
    expect(state.weekLayout).toBeNull();
    expect(state.rollingWeek).toBeNull();
    expect(state.people).toEqual([]);
  });

  it("goes back to now after two minutes idle, keeping what the screen chose (ADR 0031)", () => {
    updateDisplay({
      view: "month",
      monthOffset: 2,
      weekOffset: 3,
      day: "2026-10-20",
      railCollapsed: true,
      panelShown: false,
      weekLayout: "hours",
      rollingWeek: true,
      hoursZoom: 2.25,
      people: ["mia"],
      panel: { kind: "event", eventId: "e", recurrenceId: null, key: "k" },
    });
    backToNow();
    const state = displayState.get();
    // This week, today and this month, everyone's events, nothing open.
    expect(state.monthOffset).toBe(0);
    expect(state.weekOffset).toBe(0);
    expect(state.day).toBeNull();
    expect(state.people).toEqual([]);
    expect(state.panel).toBeNull();
    // The view, the layout, Rolling week and zoom, the panel and the rail stay as the screen
    // had them.
    expect(state.view).toBe("month");
    expect(state.weekLayout).toBe("hours");
    expect(state.rollingWeek).toBe(true);
    expect(state.hoursZoom).toBe(2.25);
    expect(state.panelShown).toBe(false);
    expect(state.railCollapsed).toBe(true);
  });

  it("keeps a rail opened back out, too", () => {
    updateDisplay({ railCollapsed: false });
    backToNow();
    expect(displayState.get().railCollapsed).toBe(false);
  });

  it("leaves a board already at now alone, so nothing redraws", () => {
    updateDisplay({ view: "day", railCollapsed: true });
    const before = displayState.get();
    backToNow();
    expect(displayState.get()).toBe(before);
  });

  it("rests from going back to now until the next touch", () => {
    expect(resting.get()).toBe(false);
    backToNow();
    expect(resting.get()).toBe(true);
    lastActivity.set(lastActivity.get() + 1);
    expect(resting.get()).toBe(false);
  });

  it("gives way to the household's later choice, one thing at a time (ADR 0031)", async () => {
    const page = await freshPage();
    const household = {
      homeView: "week",
      weekLayout: "agenda",
      rollingWeek: false,
      todayPanel: true,
      compactRail: false,
    } as const;
    const chosen = {
      view: "month",
      weekLayout: "hours",
      rollingWeek: true,
      panelShown: false,
      railCollapsed: true,
    };
    page.updateDisplay({
      view: "month",
      weekLayout: "hours",
      rollingWeek: true,
      panelShown: false,
      railCollapsed: true,
    });
    // The first settings a page reads change nothing: what the screen kept stands.
    page.householdChose(household);
    expect(page.displayState.get()).toMatchObject(chosen);
    // Nor do the same ones again (another setting changed).
    page.householdChose({ ...household });
    expect(page.displayState.get()).toMatchObject(chosen);
    // Compact rail changed: only the rail's own choice gives way.
    page.householdChose({ ...household, compactRail: true });
    expect(page.displayState.get()).toMatchObject({ ...chosen, railCollapsed: null });
    // Rolling week in Settings → Display: every screen goes to the household's (ADR 0036).
    page.householdChose({ ...household, compactRail: true, rollingWeek: true });
    expect(page.displayState.get()).toMatchObject({
      ...chosen,
      railCollapsed: null,
      rollingWeek: null,
    });
    page.householdChose({
      homeView: "today",
      weekLayout: "hours",
      rollingWeek: true,
      todayPanel: false,
      compactRail: true,
    });
    expect(page.displayState.get()).toMatchObject({
      view: null,
      weekLayout: null,
      rollingWeek: null,
      panelShown: null,
      railCollapsed: null,
    });
  });

  it("knows when an editor is open, and when something holds the screen", () => {
    expect(editorOpen()).toBe(false);
    updateDisplay({ panel: { kind: "add", day: null, hour: null } });
    expect(editorOpen()).toBe(true);
    updateDisplay({ panel: { kind: "event", eventId: "e", recurrenceId: null, key: "k" } });
    expect(editorOpen()).toBe(false);
    const release = holdIdle();
    expect(idleHolds.get()).toBe(1);
    release();
    release();
    expect(idleHolds.get()).toBe(0);
  });
});

describe("what a screen remembers for its next start (ADR 0030)", () => {
  it("comes back to the view the browser kept", async () => {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(KEPT));
    const page = await freshPage();
    const state = page.displayState.get();
    expect(state.view).toBe("month");
    expect(state.monthOffset).toBe(2);
    expect(state.panelShown).toBe(false);
    expect(state.railCollapsed).toBe(true);
    expect(state.weekLayout).toBe("hours");
    expect(state.rollingWeek).toBe(true);
    expect(state.hoursZoom).toBe(2.25);
    expect(state.people).toEqual(["mia", "leo"]);
    // Never an open sheet or a draft in Add.
    expect(state.panel).toBeNull();
  });

  it("comes back to a view kept by 0.13.0, which had no Rolling week (ADR 0036)", async () => {
    const older: Record<string, unknown> = { ...KEPT };
    delete older.rollingWeek;
    localStorage.setItem(MEMORY_KEY, JSON.stringify(older));
    const page = await freshPage();
    expect(page.remembered()).toMatchObject({ view: "month", rollingWeek: null });
    expect(page.displayState.get().view).toBe("month");
    expect(page.displayState.get().rollingWeek).toBeNull();
  });

  it("ignores what it can't read, field by field", async () => {
    for (const bad of [
      "not json",
      "null",
      JSON.stringify({ ...KEPT, v: 2 }),
      JSON.stringify({ ...KEPT, view: "year" }),
      JSON.stringify({ ...KEPT, weekOffset: "3" }),
      JSON.stringify({ ...KEPT, day: "tomorrow" }),
      JSON.stringify({ ...KEPT, panelShown: "no" }),
      JSON.stringify({ ...KEPT, weekLayout: "grid" }),
      JSON.stringify({ ...KEPT, rollingWeek: "yes" }),
      JSON.stringify({ ...KEPT, hoursZoom: 0 }),
      JSON.stringify({ ...KEPT, people: [1, 2] }),
      JSON.stringify({ v: 1, view: "month" }),
    ]) {
      localStorage.setItem(MEMORY_KEY, bad);
      const page = await freshPage();
      expect(page.remembered(), bad).toBeNull();
      expect(page.displayState.get().view, bad).toBeNull();
    }
  });

  it("keeps every change but the panel, and going back to now too", async () => {
    const page = await freshPage();
    page.updateDisplay({ view: "day", day: "2026-10-14", people: ["mia"] });
    expect(page.remembered()).toMatchObject({ view: "day", day: "2026-10-14", people: ["mia"] });
    const kept = localStorage.getItem(MEMORY_KEY);
    page.updateDisplay({ panel: { kind: "add", day: null, hour: null } });
    expect(localStorage.getItem(MEMORY_KEY)).toBe(kept);
    expect(kept).not.toContain('panel"');
    // A screen that sat idle comes back to today, in its own view: remembered like any change.
    page.updateDisplay({ panel: null });
    page.backToNow();
    expect(page.remembered()).toMatchObject({ view: "day", day: null, people: [] });
  });

  it("forgets on request: the home view, and nothing kept", async () => {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(KEPT));
    localStorage.setItem(ROOM_KEY, "/lists");
    const page = await freshPage();
    page.forgetView();
    expect(page.displayState.get().view).toBeNull();
    expect(page.displayState.get().people).toEqual([]);
    expect(page.displayState.get().railCollapsed).toBeNull();
    // forgetView alone leaves the screen remembering: it keeps the home view from here.
    expect(page.remembered()).toMatchObject({ view: null });
    expect(localStorage.getItem(ROOM_KEY)).toBeNull();
  });

  it("keeps nothing while the household says the home view, and starts again when it doesn't", async () => {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(KEPT));
    localStorage.setItem(ROOM_KEY, "/lists");
    const page = await freshPage();
    page.setRemembering(false);
    expect(localStorage.getItem(MEMORY_KEY)).toBeNull();
    expect(localStorage.getItem(ROOM_KEY)).toBeNull();
    expect(page.roomAtStart()).toBeNull();
    // What's on screen stays where it is: the setting is about the next start.
    expect(page.displayState.get().view).toBe("month");
    page.updateDisplay({ view: "people" });
    page.rememberRoom("/meals");
    expect(localStorage.getItem(MEMORY_KEY)).toBeNull();
    expect(localStorage.getItem(ROOM_KEY)).toBeNull();
    page.setRemembering(true);
    expect(page.remembered()).toMatchObject({ view: "people" });
  });

  it("remembers the room a screen was in, never Settings or a page that isn't a room", async () => {
    localStorage.setItem(ROOM_KEY, "/chores/rewards");
    let page = await freshPage();
    expect(page.roomAtStart()).toBe("/chores/rewards");
    // Read once as the page loads: the shell's own writes don't change where it started.
    page.rememberRoom("/lists");
    expect(localStorage.getItem(ROOM_KEY)).toBe("/lists");
    expect(page.roomAtStart()).toBe("/chores/rewards");
    page.rememberRoom(null);
    expect(localStorage.getItem(ROOM_KEY)).toBeNull();
    for (const bad of [
      "/settings/family",
      "/display",
      "/",
      "lists",
      "/sign-in",
      "//evil.example/x",
    ]) {
      localStorage.setItem(ROOM_KEY, bad);
      page = await freshPage();
      expect(page.roomAtStart(), bad).toBeNull();
    }
  });
});
