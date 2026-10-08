import { beforeEach, describe, expect, it } from "vitest";

import { setDatePreferences } from "./dates";
import { NO_PLACE, sunDay, sunTimes } from "./sun";

const minutesApart = (a: Date | null, b: string) =>
  Math.abs((a?.getTime() ?? 0) - new Date(b).getTime()) / 60_000;

beforeEach(() => {
  setDatePreferences({ timezone: "America/New_York", timeFormat: "12h" });
});

describe("sunrise and sunset", () => {
  it("match the almanac within a couple of minutes", () => {
    // A famous public spot in New York, October 7, 2026: about 6:59 AM and 6:30 PM EDT.
    const october = sunTimes("2026-10-07", 40.71, -74.01);
    expect(minutesApart(october.sunrise, "2026-10-07T10:59:00Z")).toBeLessThan(3);
    expect(minutesApart(october.sunset, "2026-10-07T22:30:00Z")).toBeLessThan(3);
    // Midsummer in London: about 4:43 AM and 9:21 PM BST.
    const june = sunTimes("2026-06-21", 51.5, -0.13);
    expect(minutesApart(june.sunrise, "2026-06-21T03:43:00Z")).toBeLessThan(3);
    expect(minutesApart(june.sunset, "2026-06-21T20:21:00Z")).toBeLessThan(3);
    // Sydney in its summer, across the date line from UTC: about 5:41 AM and 8:05 PM AEDT.
    const sydney = sunTimes("2026-12-21", -33.87, 151.21);
    expect(minutesApart(sydney.sunrise, "2026-12-20T18:41:00Z")).toBeLessThan(3);
    expect(minutesApart(sydney.sunset, "2026-12-21T09:05:00Z")).toBeLessThan(3);
  });

  it("has no sunrise or sunset in a polar day or night", () => {
    expect(sunTimes("2026-06-21", 78.2, 15.6)).toEqual({ sunrise: null, sunset: null });
    expect(sunTimes("2026-12-21", 78.2, 15.6)).toEqual({ sunrise: null, sunset: null });
  });

  it("gives the household's minutes, or 7 AM to 7 PM without a place", () => {
    expect(sunDay("2026-10-07", 40.71, -74.01)).toEqual({
      sunrise: 6 * 60 + 59,
      sunset: 18 * 60 + 30,
    });
    expect(sunDay("2026-10-07", null, null)).toBe(NO_PLACE);
    expect(sunDay("2026-06-21", 78.2, 15.6)).toBe(NO_PLACE);
  });
});
