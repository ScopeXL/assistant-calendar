import { afterEach, describe, expect, it } from "vitest";

import {
  displayState,
  editorOpen,
  holdIdle,
  idleHolds,
  resetBoard,
  updateDisplay,
} from "./displayState";

afterEach(() => {
  updateDisplay({ panel: null });
  resetBoard();
});

describe('what the wall is showing (UX §1 "Idle, wake and reset")', () => {
  it("starts on the household's choices: nothing is overridden on this screen", () => {
    const state = displayState.get();
    expect(state.view).toBeNull();
    expect(state.panelShown).toBeNull();
    expect(state.railCollapsed).toBeNull();
    expect(state.weekLayout).toBeNull();
    expect(state.people).toEqual([]);
  });

  it("goes back to them after two minutes idle: the rail, the panel, the week, the people", () => {
    updateDisplay({
      railCollapsed: true,
      panelShown: false,
      weekOffset: 3,
      people: ["mia"],
      view: "month",
    });
    expect(displayState.get().railCollapsed).toBe(true);
    resetBoard();
    const state = displayState.get();
    expect(state.railCollapsed).toBeNull();
    expect(state.panelShown).toBeNull();
    expect(state.weekOffset).toBe(0);
    expect(state.people).toEqual([]);
    expect(state.view).toBeNull();
  });

  it("opening the rail back out is a change too, and resets the same way", () => {
    updateDisplay({ railCollapsed: false });
    resetBoard();
    expect(displayState.get().railCollapsed).toBeNull();
  });

  it("leaves a screen already at rest alone, so nothing redraws", () => {
    const before = displayState.get();
    resetBoard();
    expect(displayState.get()).toBe(before);
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
