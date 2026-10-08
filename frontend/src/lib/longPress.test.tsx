import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOLD_MS, useLongPress } from "./longPress";

function Tile({ onHold, onOpen }: { onHold: () => void; onOpen: () => void }) {
  const hold = useLongPress(onHold);
  return (
    <button type="button" onClick={onOpen} {...hold}>
      Groceries
    </button>
  );
}

describe("a long press", () => {
  let onHold: ReturnType<typeof vi.fn<() => void>>;
  let onOpen: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    onHold = vi.fn<() => void>();
    onOpen = vi.fn<() => void>();
    render(<Tile onHold={onHold} onOpen={onOpen} />);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const tile = () => screen.getByRole("button", { name: "Groceries" });
  const press = (x = 10, y = 10) => {
    fireEvent.pointerDown(tile(), { button: 0, clientX: x, clientY: y });
  };

  it("held still calls the shortcut, and its release doesn't also tap", () => {
    press();
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    expect(onHold).toHaveBeenCalledOnce();
    fireEvent.pointerUp(tile());
    fireEvent.click(tile());
    expect(onOpen).not.toHaveBeenCalled();
    // The next tap is an ordinary one.
    press();
    fireEvent.pointerUp(tile());
    fireEvent.click(tile());
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("a quick tap is a tap", () => {
    press();
    act(() => {
      vi.advanceTimersByTime(HOLD_MS - 100);
    });
    fireEvent.pointerUp(tile());
    fireEvent.click(tile());
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    expect(onHold).not.toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("a finger that moves is scrolling", () => {
    press(10, 10);
    fireEvent.pointerMove(tile(), { clientX: 10, clientY: 40 });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    expect(onHold).not.toHaveBeenCalled();
  });
});
