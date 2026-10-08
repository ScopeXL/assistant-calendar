/**
 * The weather in the family's words (UX §2): Open-Meteo sends WMO weather codes; the wall shows
 * an icon and a word or two. Temperatures are whole degrees in the household's units, written
 * "64°" (Settings → Features → Weather says which).
 */
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";

export interface Sky {
  icon: LucideIcon;
  words: string;
}

export function sky(code: number, isDay = true): Sky {
  if (code === 0) return isDay ? { icon: Sun, words: "Sunny" } : { icon: Moon, words: "Clear" };
  if (code === 1)
    return isDay
      ? { icon: CloudSun, words: "Mostly sunny" }
      : { icon: CloudMoon, words: "Mostly clear" };
  if (code === 2) return { icon: isDay ? CloudSun : CloudMoon, words: "Partly cloudy" };
  if (code === 3) return { icon: Cloud, words: "Cloudy" };
  if (code === 45 || code === 48) return { icon: CloudFog, words: "Fog" };
  if (code === 56 || code === 57 || code === 66 || code === 67)
    return { icon: CloudRain, words: "Freezing rain" };
  if (code >= 51 && code <= 55) return { icon: CloudDrizzle, words: "Drizzle" };
  if (code >= 61 && code <= 65) return { icon: CloudRain, words: "Rain" };
  if (code >= 80 && code <= 82) return { icon: CloudRain, words: "Showers" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return { icon: CloudSnow, words: "Snow" };
  if (code >= 95) return { icon: CloudLightning, words: "Thunderstorms" };
  return { icon: Cloud, words: "Cloudy" };
}

export function degrees(value: number): string {
  return `${String(Math.round(value))}°`;
}

/** "High 70°, low 52°" for screen readers and the day's line. */
export function highLow(high: number, low: number): string {
  return `High ${degrees(high)}, low ${degrees(low)}`;
}

/** A chance of rain worth saying: 30% and up ("70%"). */
export function rainChance(percent: number | null | undefined): string | null {
  return percent != null && percent >= 30 ? `${String(percent)}%` : null;
}
