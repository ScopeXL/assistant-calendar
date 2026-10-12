import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { overflowOf, ScrollRow } from "./ScrollRow";

afterEach(cleanup);

describe("a one-line row that scrolls sideways", () => {
  it("knows which edges have more behind them", () => {
    expect(overflowOf(0, 300, 300)).toBe("none");
    expect(overflowOf(0, 300, 520)).toBe("end");
    expect(overflowOf(110, 300, 520)).toBe("both");
    expect(overflowOf(220, 300, 520)).toBe("start");
    // Half a pixel of rounding isn't more to show.
    expect(overflowOf(0.4, 300, 300.6)).toBe("none");
  });

  it("is a named group that never wraps", () => {
    render(
      <ScrollRow label="Who">
        <button type="button">Ana</button>
        <button type="button">Sam</button>
      </ScrollRow>,
    );
    const row = screen.getByRole("group", { name: "Who" });
    expect(row.className).toContain("flex-nowrap");
    expect(row.className).toContain("overflow-x-auto");
    expect(row.getAttribute("data-overflow")).toBe("none");
  });
});
