import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Pop } from "./Pop";

afterEach(cleanup);

describe("a count that pops (UX §9)", () => {
  it("is still on first paint, pops when it changes, and again the next time", () => {
    const view = render(<Pop value="2 of 3" className="font-bold" />);
    const first = screen.getByText("2 of 3");
    expect(first.classList.contains("pop")).toBe(false);
    expect(first.classList.contains("font-bold")).toBe(true);
    view.rerender(<Pop value="3 of 3" className="font-bold" />);
    const second = screen.getByText("3 of 3");
    expect(second.classList.contains("pop")).toBe(true);
    // A new element each time, so the animation plays again.
    expect(second).not.toBe(first);
    view.rerender(<Pop value="3 of 3" className="font-bold" />);
    expect(screen.getByText("3 of 3")).toBe(second);
    view.rerender(<Pop value="2 of 3" className="font-bold" />);
    expect(screen.getByText("2 of 3")).not.toBe(second);
  });

  it("rolls a number that turns over, and shows its children when given", () => {
    const view = render(
      <Pop value={12} roll>
        12 days
      </Pop>,
    );
    expect(screen.getByText("12 days").className.trim()).toBe("");
    view.rerender(
      <Pop value={11} roll>
        11 days
      </Pop>,
    );
    expect(screen.getByText("11 days").classList.contains("roll")).toBe(true);
  });
});
