import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clockOffset,
  nextTimestamp,
  onClockMoved,
  recordClockSample,
  resetClockForTests,
} from "./clock";

beforeEach(() => {
  resetClockForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("clock offset", () => {
  it("uses the lowest-latency sample", () => {
    recordClockSample(1000, 1400, 5000); // slow: offset 3800, round trip 400
    recordClockSample(2000, 2020, 5_010); // fast: offset 3000, round trip 20
    expect(clockOffset()).toBe(3000);
  });

  it("ignores impossible samples", () => {
    recordClockSample(2000, 1000, 5000);
    recordClockSample(1000, 1010, Number.NaN);
    expect(clockOffset()).toBe(0);
  });

  it("says when the offset moves by more than a second", () => {
    let moved = 0;
    const stop = onClockMoved(() => {
      moved += 1;
    });
    recordClockSample(1000, 1040, 1020); // offset 0: no change
    recordClockSample(2000, 2030, 2015 + 600); // faster, but only 600 ms off
    recordClockSample(3000, 3020, 3010 + 90_000); // faster still, and 90 s off
    stop();
    recordClockSample(4000, 4010, 4005 - 90_000);
    expect(moved).toBe(1);
  });

  it("drops samples from before this device's own clock jumped", () => {
    recordClockSample(1000, 1010, 1005 + 3_600_000); // a Pi an hour behind
    expect(clockOffset()).toBe(3_600_000);
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 3_600_000); // the network sets it right
    expect(clockOffset()).toBe(0);
  });

  it("issues strictly increasing timestamps, even if the clock steps back", () => {
    const first = nextTimestamp(10_000);
    const second = nextTimestamp(9_000);
    const third = nextTimestamp(9_000);
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });
});
