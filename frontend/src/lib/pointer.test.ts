import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { watchPointer } from "./pointer";

/** jsdom has no PointerEvent: a MouseEvent with the type on it is all the watcher reads. */
function pointer(type: string, pointerType: string, x = 0, y = 0): Event {
  const event = new MouseEvent(type, { bubbles: true, screenX: x, screenY: y });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return event;
}

let root: HTMLElement;
let stop: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  root = document.createElement("div");
  stop = watchPointer(root);
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe("the wall's pointer (ADR 0030)", () => {
  it("hides three seconds after the mouse stops, and a move brings it back", () => {
    expect(root.dataset.pointer).toBeUndefined();
    vi.advanceTimersByTime(2_999);
    expect(root.dataset.pointer).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(root.dataset.pointer).toBe("hidden");
    window.dispatchEvent(pointer("pointermove", "mouse", 10, 10));
    expect(root.dataset.pointer).toBeUndefined();
    // Still moving: the three seconds start again from the last move.
    vi.advanceTimersByTime(2_000);
    window.dispatchEvent(pointer("pointermove", "mouse", 20, 10));
    vi.advanceTimersByTime(2_000);
    expect(root.dataset.pointer).toBeUndefined();
    vi.advanceTimersByTime(1_000);
    expect(root.dataset.pointer).toBe("hidden");
  });

  it("hides at once on a touch, and a finger's own moves don't show it", () => {
    window.dispatchEvent(pointer("pointerdown", "touch", 5, 5));
    expect(root.dataset.pointer).toBe("hidden");
    window.dispatchEvent(pointer("pointermove", "touch", 50, 50));
    expect(root.dataset.pointer).toBe("hidden");
    // A mouse button isn't a touch: the pointer is in use.
    window.dispatchEvent(pointer("pointermove", "mouse", 60, 60));
    window.dispatchEvent(pointer("pointerdown", "mouse", 60, 60));
    expect(root.dataset.pointer).toBeUndefined();
  });

  it("ignores a move that goes nowhere: the page changed under a resting pointer", () => {
    window.dispatchEvent(pointer("pointermove", "mouse", 30, 30));
    vi.advanceTimersByTime(3_000);
    expect(root.dataset.pointer).toBe("hidden");
    window.dispatchEvent(pointer("pointermove", "mouse", 30, 30));
    expect(root.dataset.pointer).toBe("hidden");
  });

  it("stops listening, and the next watch starts as this one ended", () => {
    window.dispatchEvent(pointer("pointerdown", "touch"));
    stop();
    expect(root.dataset.pointer).toBeUndefined();
    window.dispatchEvent(pointer("pointerdown", "touch"));
    expect(root.dataset.pointer).toBeUndefined();
    // The kiosk remounts its shell on a room switch: still hidden, no three-second flash.
    stop = watchPointer(root);
    expect(root.dataset.pointer).toBe("hidden");
    window.dispatchEvent(pointer("pointermove", "mouse", 1, 1));
    stop();
    stop = watchPointer(root);
    expect(root.dataset.pointer).toBeUndefined();
  });
});
