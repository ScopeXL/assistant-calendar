import { describe, expect, it } from "vitest";

import { fitRow } from "./fit";

describe("fitting a one-line row (the Who picker)", () => {
  // The wall's Add panel is 592 px inside its padding; cells are 80 or 72 px with 8 between.
  const WALL = [80, 72];

  it("keeps the big cells while they fit, then the small ones, then scrolls", () => {
    expect(fitRow(592, 5, WALL, 8)).toEqual({ cell: 80, scroll: false });
    // Everyone and five people: six 80 px cells are 520 px.
    expect(fitRow(592, 6, WALL, 8)).toEqual({ cell: 80, scroll: false });
    // A seventh would be 608 px at 80, and is 552 at 72.
    expect(fitRow(592, 7, WALL, 8)).toEqual({ cell: 72, scroll: false });
    // An eighth is 632 px even at 72: the row scrolls.
    expect(fitRow(592, 8, WALL, 8)).toEqual({ cell: 72, scroll: true });
  });

  it("does the same on a phone", () => {
    const PHONE = [56, 48];
    expect(fitRow(358, 5, PHONE, 8)).toEqual({ cell: 56, scroll: false });
    expect(fitRow(358, 6, PHONE, 8)).toEqual({ cell: 48, scroll: false });
    expect(fitRow(358, 7, PHONE, 8)).toEqual({ cell: 48, scroll: true });
  });

  it("assumes the best until it has a width (a closed sheet measures 0)", () => {
    expect(fitRow(0, 12, WALL, 8)).toEqual({ cell: 80, scroll: false });
    expect(fitRow(592, 0, WALL, 8)).toEqual({ cell: 80, scroll: false });
  });
});
