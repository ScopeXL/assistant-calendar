import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShellContext } from "./shell";
import { REVEAL, SwipeRow, swipeSettles } from "./SwipeRow";

afterEach(cleanup);

function row(onOpen = vi.fn(), onAction = vi.fn()) {
  return (
    <SwipeRow action="Remove" label="Remove Eggs" onAction={onAction}>
      <button type="button" onClick={onOpen}>
        Eggs
      </button>
    </SwipeRow>
  );
}

describe("a row a phone swipes for Remove (ADR 0036)", () => {
  it("opens past half the button or on a flick left, and closes otherwise", () => {
    expect(swipeSettles(-REVEAL / 2 - 1, 0)).toBe(true);
    expect(swipeSettles(-REVEAL / 2 + 1, 0)).toBe(false);
    expect(swipeSettles(-10, -500)).toBe(true);
    // Open, then a flick right: closed, however far it still is.
    expect(swipeSettles(-REVEAL, 500)).toBe(false);
    expect(swipeSettles(0, 0)).toBe(false);
  });

  it("hides its Remove from taps and screen readers until it's swiped open", () => {
    const onOpen = vi.fn();
    const { container } = render(row(onOpen));
    const remove = container.querySelector<HTMLButtonElement>('button[aria-label="Remove Eggs"]');
    expect(remove?.textContent).toBe("Remove");
    expect(remove?.hasAttribute("inert")).toBe(true);
    expect(remove?.getAttribute("aria-hidden")).toBe("true");
    expect(remove?.tabIndex).toBe(-1);
    expect(screen.queryByRole("button", { name: "Remove Eggs" })).toBeNull();
    // A tap on the row is still the row's own.
    fireEvent.click(screen.getByRole("button", { name: "Eggs" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("never swipes on the wall, nor when it's switched off", () => {
    const wall = render(<ShellContext.Provider value="display">{row()}</ShellContext.Provider>);
    expect(wall.container.querySelector('[aria-label="Remove Eggs"]')).toBeNull();
    expect(screen.getByRole("button", { name: "Eggs" })).toBeTruthy();
    cleanup();
    const off = render(
      <SwipeRow action="Remove" label="Remove Eggs" onAction={vi.fn()} disabled>
        <span>Eggs</span>
      </SwipeRow>,
    );
    expect(off.container.querySelector("button")).toBeNull();
  });
});
