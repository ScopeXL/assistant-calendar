/**
 * Sunrise and sunset at the household's place (UX §6 "Theme auto switch at sunset"): the wall's
 * Auto theme turns dark at sunset and light at sunrise, and the wall's tint steps around them.
 * Without a place (Settings → Household → Location) the day runs 7 AM to 7 PM.
 *
 * The standard sunrise equation (the sun's centre 0.833° below the horizon, for refraction and
 * its disc), good to a minute or two: plenty for a theme switch. It works offline, so it doesn't
 * need the weather.
 */
import { zonedParts } from "./dates";

/** Minutes after the household's midnight. */
export interface SunDay {
  sunrise: number;
  sunset: number;
}

export const NO_PLACE: SunDay = { sunrise: 7 * 60, sunset: 19 * 60 };

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const J0 = 0.0009;
const TILT = RAD * 23.4397; // the Earth's axis
const HORIZON = RAD * -0.833;

const toDays = (ms: number) => ms / DAY_MS - 0.5 + J1970 - J2000;
const fromJulian = (julian: number) => new Date((julian + 0.5 - J1970) * DAY_MS);

/** When the sun rises and sets (UTC instants) on a calendar day at a place, or null for each in
 * a polar day or night. */
export function sunTimes(
  day: string,
  latitude: number,
  longitude: number,
): { sunrise: Date | null; sunset: Date | null } {
  const [year = 1970, month = 1, date = 1] = day.split("-").map(Number);
  // That day's local noon, roughly: the solar noon nearest it is that day's.
  const noon = Date.UTC(year, month - 1, date, 12) - (longitude / 15) * 3_600_000;
  const west = RAD * -longitude;
  const phi = RAD * latitude;
  const cycle = Math.round(toDays(noon) - J0 - west / (2 * Math.PI));
  const transitDay = J0 + west / (2 * Math.PI) + cycle;
  const anomaly = RAD * (357.5291 + 0.98560028 * transitDay);
  const centre =
    RAD *
    (1.9148 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly) + 0.0003 * Math.sin(3 * anomaly));
  const longitudeOfSun = anomaly + centre + RAD * 102.9372 + Math.PI;
  const declination = Math.asin(Math.sin(TILT) * Math.sin(longitudeOfSun));
  const transit = (days: number) =>
    J2000 + days + 0.0053 * Math.sin(anomaly) - 0.0069 * Math.sin(2 * longitudeOfSun);
  const solarNoon = transit(transitDay);
  const cosHour =
    (Math.sin(HORIZON) - Math.sin(phi) * Math.sin(declination)) /
    (Math.cos(phi) * Math.cos(declination));
  if (cosHour < -1 || cosHour > 1) return { sunrise: null, sunset: null };
  const hourAngle = Math.acos(cosHour);
  const sunset = transit(J0 + (hourAngle + west) / (2 * Math.PI) + cycle);
  return { sunrise: fromJulian(solarNoon - (sunset - solarNoon)), sunset: fromJulian(sunset) };
}

/** Sunrise and sunset on the household's day, in its minutes; 7 AM and 7 PM without a place,
 * and a polar day or night keeps those too. */
export function sunDay(
  day: string,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): SunDay {
  if (latitude == null || longitude == null) return NO_PLACE;
  const { sunrise, sunset } = sunTimes(day, latitude, longitude);
  if (!sunrise || !sunset) return NO_PLACE;
  const minutes = (moment: Date) => {
    const parts = zonedParts(moment);
    return parts.hour * 60 + parts.minute;
  };
  return { sunrise: minutes(sunrise), sunset: minutes(sunset) };
}
