import { describe, expect, it } from "vitest";

import { fitCount, type Box, type Flow } from "./FitList";

const COLUMN: Flow = { row: false, width: 200, rowGap: 8, columnGap: 8 };
const ROW: Flow = { row: true, width: 904, rowGap: 0, columnGap: 8 };
const MORE = { width: 200, height: 56 };
const SHORT_MORE = { width: 110, height: 56 };

/** A column of `heights`, 8 px apart. */
function column(heights: number[]): Box[] {
  let top = 0;
  return heights.map((height) => {
    const box = { top, left: 0, width: 200, height, marginBottom: 0 };
    top += height + 8;
    return box;
  });
}

/** A cell in a wrapping row: lines spaced by its 8 px bottom margin. */
function cell(top: number, left: number, height = 64, width = 224): Box {
  return { top, left, width, height, marginBottom: 8 };
}

describe("how many chips fit, and where +N more goes (fitCount)", () => {
  it("shows everything that fits a column", () => {
    expect(fitCount(column([64, 64, 64]), MORE, 300, COLUMN)).toBe(3);
  });

  it("gives up a chip for +N more when the rest don't fit a column", () => {
    // 64 + 8 + 64 = 136 fits 150; the third doesn't, and +N more after the second ends at 200.
    expect(fitCount(column([64, 64, 64]), MORE, 150, COLUMN)).toBe(1);
    expect(fitCount(column([64, 64, 64]), MORE, 200, COLUMN)).toBe(2);
    expect(fitCount(column([64]), MORE, 40, COLUMN)).toBe(0);
  });

  it("puts +N more beside the last chip in a row when the line has room", () => {
    // Line 1: three 224 px chips (to 688); the fourth wraps to a line that doesn't fit.
    const cells = [cell(0, 0), cell(0, 232), cell(0, 464), cell(72, 0)];
    expect(fitCount(cells, SHORT_MORE, 100, ROW)).toBe(3); // 688 + 8 + 110 = 806 ≤ 904
    expect(fitCount(cells, { width: 224, height: 56 }, 100, ROW)).toBe(2); // 920 > 904
  });

  it("follows the all-day band's line break onto the next line", () => {
    // The band's chip (two lines of title, 80 px), a zero-height break on its own line, then
    // the timed chips under it, which don't fit: +N more goes beside the band's chip.
    const cells: Box[] = [
      cell(0, 0, 80),
      { top: 88, left: 0, width: 904, height: 0, marginBottom: 0 },
      cell(88, 0),
      cell(88, 232),
    ];
    expect(fitCount(cells, SHORT_MORE, 130, ROW)).toBe(1);
    // With room for the timed line, everything shows.
    expect(fitCount(cells, SHORT_MORE, 160, ROW)).toBe(4);
  });
});
