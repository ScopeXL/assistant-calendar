import { describe, expect, it } from "vitest";

import {
  ZOOMS,
  chipBox,
  chipTier,
  gridStepMinutes,
  gutterHours,
  initialScrollTop,
  laneCount,
  laneStyle,
  minuteOfDay,
  minutesAtY,
  nowTop,
  pixelsPerHour,
  placeTimed,
  rescaledScrollTop,
} from "./hours";
import type { Placed } from "./layout";

const REM = 16;
const DAY = "2026-10-07";

function timed(key: string, start: string, end: string, day = DAY): Placed {
  return {
    key,
    title: key,
    all_day: false,
    start_local: `${day}T${start}:00`,
    end_local: `${end === "24:00" ? "2026-10-08T00:00" : `${day}T${end}`}:00`,
    member_ids: [],
  };
}

describe("the zoom ladder (pixelsPerHour)", () => {
  it("fits the day at 24h, half of it at 12h, and doubles from there", () => {
    expect(ZOOMS.map((zoom) => pixelsPerHour(zoom, 720, REM))).toEqual([30, 60, 144, 288]);
    expect(ZOOMS.map((zoom) => pixelsPerHour(zoom, 1200, REM))).toEqual([50, 100, 200, 400]);
  });

  it("makes each step at least twice the one before, at any height", () => {
    for (const height of [300, 560, 708, 900, 1400, 2400]) {
      const steps = ZOOMS.map((zoom) => pixelsPerHour(zoom, height, REM));
      for (let n = 1; n < steps.length; n++) {
        expect(steps[n]).toBeGreaterThanOrEqual(2 * (steps[n - 1] ?? 0));
      }
    }
  });

  it("scales with the text size, so a half hour still gets a full chip", () => {
    expect(pixelsPerHour("1h", 720, 20.8)).toBeGreaterThanOrEqual(187.2);
  });
});

describe("where a chip sits (chipBox)", () => {
  it("starts at its time, and is never shorter than a tap target", () => {
    expect(chipBox(timed("soccer", "16:00", "17:00"), DAY, 30, REM)).toEqual({
      top: 480,
      visible: 30,
      height: 56,
      offset: 0,
    });
    expect(chipBox(timed("soccer", "16:00", "17:00"), DAY, 144, REM).height).toBe(144);
    const quick = chipBox(timed("call", "09:00", "09:15"), DAY, 30, REM);
    expect([quick.visible, quick.height]).toEqual([7.5, 56]);
    expect(chipBox(timed("soccer", "16:00", "17:00"), DAY, 30, 20.8).height).toBeCloseTo(72.8);
  });

  it("ends at midnight, sliding up when its button would run past it", () => {
    const late = chipBox(timed("movie", "22:00", "24:00"), DAY, 30, REM);
    expect(late.top + late.height).toBe(720);
    const last = chipBox(timed("call", "23:45", "24:00"), DAY, 30, REM);
    expect(last).toEqual({ top: 664, visible: 7.5, height: 56, offset: 48.5 });
  });

  it("reads minutes from a wall time", () => {
    expect(minuteOfDay("2026-10-08T15:30:00")).toBe(930);
  });
});

describe("what a chip shows (chipTier)", () => {
  it("goes from a bar to two title lines as it grows", () => {
    expect(chipTier(27.9, REM).tier).toBe("bar");
    expect(chipTier(28, REM).tier).toBe("title");
    expect(chipTier(56, REM).tier).toBe("line");
    expect(chipTier(72, REM)).toEqual({ tier: "lines", titleLines: 1 });
    expect(chipTier(104, REM)).toEqual({ tier: "lines", titleLines: 2 });
  });
});

describe("lanes", () => {
  it("fits as many tap-wide lanes as the column allows, three at most", () => {
    expect([60, 120, 176, 233].map((width) => laneCount(width, REM))).toEqual([1, 2, 2, 3]);
    expect(laneCount(136, 20.8)).toBe(1);
  });

  it("puts overlapping events side by side, and +N in the last lane when they don't fit", () => {
    const three = [
      timed("a", "09:00", "10:00"),
      timed("b", "09:15", "10:30"),
      timed("c", "09:30", "11:00"),
    ];
    const two = placeTimed(three, DAY, 30, REM, 176);
    expect(two.map((item) => [item.kind, item.lane, item.lanes])).toEqual([
      ["chip", 0, 2],
      ["more", 1, 2],
    ]);
    const more = two[1];
    expect(more?.kind === "more" ? [more.hidden.length, more.top, more.height] : []).toEqual([
      2, 270, 60,
    ]);
    const roomy = placeTimed(three, DAY, 30, REM, 233);
    expect(roomy.map((item) => [item.kind, item.lane, item.lanes])).toEqual([
      ["chip", 0, 3],
      ["chip", 1, 3],
      ["chip", 2, 3],
    ]);
  });

  it("keeps an event that doesn't overlap at full width", () => {
    const placed = placeTimed(
      [timed("a", "09:00", "10:00"), timed("b", "10:00", "11:00")],
      DAY,
      30,
      REM,
      176,
    );
    expect(placed.map((item) => [item.lane, item.lanes])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("never lets a later chip cover all but less than 24 px of the one before (WCAG 2.5.8)", () => {
    // An hour apart at 22 px an hour: the second chip would start 22 px down the first one's
    // 56 px button, so they share the column side by side instead.
    const close = [timed("a", "08:00", "08:30"), timed("b", "09:00", "09:30")];
    expect(placeTimed(close, DAY, 22, REM, 176).map((item) => [item.lane, item.lanes])).toEqual([
      [0, 2],
      [1, 2],
    ]);
    // At 25 px an hour, 25 px of the first stays uncovered: the second sits on its tail.
    expect(placeTimed(close, DAY, 25, REM, 176).map((item) => [item.lane, item.lanes])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("places a lane across its column, 8 px between", () => {
    expect(laneStyle(1, 2)).toEqual({
      left: "calc(1 * (100% + 8px) / 2)",
      width: "calc((100% - 8px) / 2)",
    });
  });
});

describe("the now line and scrolling", () => {
  it("sits at now on today only", () => {
    expect(nowTop("2026-10-07T10:00:00", DAY, 30)).toBe(300);
    expect(nowTop("2026-10-07T10:00:00", "2026-10-08", 30)).toBeNull();
  });

  it("starts at the top at 24h, with now a third down on this week, else at 7 AM", () => {
    const days = ["2026-10-04", "2026-10-05", "2026-10-06", DAY, "2026-10-08"];
    const at = (zoom: "24h" | "1h", now: string, week = days) =>
      initialScrollTop({ zoom, pph: 60, fit: 720, now, days: week });
    expect(at("24h", "2026-10-07T10:00:00")).toBe(0);
    expect(at("1h", "2026-10-07T10:00:00")).toBe(360);
    expect(at("1h", "2026-10-07T01:00:00")).toBe(0);
    expect(at("1h", "2026-10-07T10:00:00", ["2026-10-11", "2026-10-12"])).toBe(420);
  });

  it("keeps the middle minute in the middle when the zoom changes", () => {
    expect(rescaledScrollTop(360, 720, 60, 144)).toBe(1368);
    expect(rescaledScrollTop(0, 720, 60, 30)).toBe(0);
  });
});

describe("the gutter, the lines and a tapped time", () => {
  it("names every other hour at 24h and every hour otherwise, never 0 or 24", () => {
    expect(gutterHours("24h")).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    expect(gutterHours("1h")).toEqual(Array.from({ length: 23 }, (_, n) => n + 1));
  });

  it("draws finer lines as it zooms in", () => {
    expect(ZOOMS.map(gridStepMinutes)).toEqual([60, 60, 30, 15]);
  });

  it("turns a tap into a quarter hour", () => {
    expect(minutesAtY(31, 30)).toBe(60);
    expect(minutesAtY(712, 30)).toBe(1425);
    expect(minutesAtY(-5, 30)).toBe(0);
    expect(minutesAtY(719, 30)).toBe(1425);
  });
});
