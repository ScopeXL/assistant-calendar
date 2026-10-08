import { useState } from "react";

import { formatTime, formatWallTime, shortWeekday, zonedParts } from "../../lib/dates";
import { useMinute } from "../../lib/time";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import type { RailPlace } from "../registry";
import { useWeather, useWeatherDay, type Weather } from "./data";
import { degrees, highLow, rainChance, sky } from "./sky";

/** "as of 9:10" once the forecast is over 3 hours old (PLAN §11.4). */
function staleText(weather: Weather): string | null {
  return weather.stale && weather.fetched_at
    ? `as of ${formatTime(new Date(weather.fetched_at))}`
    : null;
}

/**
 * The weather by the clock (UX §3): the sky's icon and the temperature, the day's high and low
 * under them; a tap opens the day's hours and the week. In portrait's band it sits beside the
 * clock on one line, and on a phone it heads Today. Nothing shows until there's a forecast.
 */
export function WeatherBlock({ place }: { place: RailPlace }) {
  const { data } = useWeather();
  const today = zonedParts(useMinute()).day;
  const day = useWeatherDay(today);
  const [open, setOpen] = useState(false);
  if (data?.status !== "ok" || !data.current) return null;
  const { icon: Icon, words } = sky(data.current.code, data.current.is_day);
  const stale = staleText(data);
  const spoken = [
    `${words}, ${degrees(data.current.temperature)}`,
    day ? highLow(day.high, day.low) : null,
    stale,
  ]
    .filter(Boolean)
    .join(". ");
  const button =
    place === "rail"
      ? "press flex min-h-14 flex-col items-start justify-center gap-1 rounded-chip-d text-left"
      : place === "band"
        ? "press flex min-h-14 items-center gap-4 rounded-chip-d px-2 text-left"
        : "press flex min-h-11 items-center gap-3 rounded-chip px-1 text-left";
  return (
    <>
      <button
        type="button"
        aria-label={`The weather: ${spoken}. Open the forecast.`}
        onClick={() => {
          setOpen(true);
        }}
        className={button}
      >
        <span className="flex items-center gap-2">
          <Icon
            aria-hidden="true"
            className={place === "phone" ? "size-7" : "size-9"}
            strokeWidth={2}
          />
          <span
            className={`${place === "phone" ? "text-title" : "text-d-title"} font-bold whitespace-nowrap`}
          >
            {degrees(data.current.temperature)}
          </span>
        </span>
        {day || stale ? (
          <span
            className={`${place === "phone" ? "text-secondary" : "text-d-caption"} font-semibold whitespace-nowrap text-ink-soft`}
          >
            {day ? `${degrees(day.high)} / ${degrees(day.low)}` : null}
            {day && stale ? " · " : null}
            {stale}
          </span>
        ) : null}
      </button>
      <Forecast
        weather={data}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

/** The day's hours and the week, from the rail's weather. */
function Forecast({
  weather,
  open,
  onClose,
}: {
  weather: Weather;
  open: boolean;
  onClose: () => void;
}) {
  const display = useShell() === "display";
  const text = display ? "text-d-body" : "text-body";
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  const today = weather.daily[0]?.date;
  return (
    <Sheet open={open} title={weather.location_label ?? "The weather"} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <section aria-label="The next hours" className="flex flex-col gap-3">
          <h3 className={`${text} font-bold`}>The next hours</h3>
          <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
            {weather.hourly.slice(0, 12).map((hour) => {
              const { icon: Icon, words } = sky(hour.code);
              const rain = rainChance(hour.precipitation);
              return (
                <li key={hour.time} className="flex flex-col items-center gap-1 text-center">
                  <span className={soft}>{formatWallTime(hour.time, { compact: true })}</span>
                  <Icon aria-label={words} role="img" className="size-7" />
                  <span className={`${text} font-semibold`}>{degrees(hour.temperature)}</span>
                  {rain ? (
                    <span className={soft}>
                      {rain}
                      <span className="sr-only"> chance of rain</span>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
        <section aria-label="The week" className="flex flex-col gap-1">
          <h3 className={`${text} font-bold`}>The week</h3>
          <ul className="flex flex-col divide-y divide-line">
            {weather.daily.map((day) => {
              const { icon: Icon, words } = sky(day.code);
              const rain = rainChance(day.precipitation);
              return (
                <li
                  key={day.date}
                  className={`flex items-center gap-4 ${display ? "min-h-16" : "min-h-12"}`}
                >
                  <span className={`w-20 ${text} font-semibold`}>
                    {day.date === today ? "Today" : shortWeekday(day.date)}
                  </span>
                  <Icon aria-hidden="true" className="size-7 shrink-0" />
                  <span className={`flex-1 ${soft}`}>
                    {words}
                    {rain ? `, ${rain} chance` : ""}
                  </span>
                  <span className={`${text} font-semibold whitespace-nowrap`}>
                    {degrees(day.high)} <span className="text-ink-soft">{degrees(day.low)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        <p className={soft}>Weather by Open-Meteo</p>
      </div>
    </Sheet>
  );
}

/** A day's sky, as an icon in the board's day header (UX §3; only for days the forecast
 * reaches). The forecast itself is a tap on the rail's weather away. */
export function WeatherDayMark({ day }: { day: string }) {
  const forecast = useWeatherDay(day);
  if (!forecast) return null;
  const { icon: Icon } = sky(forecast.code);
  return (
    <Icon
      aria-hidden="true"
      className="ml-auto size-7 shrink-0 self-center text-ink-soft portrait:ml-0"
      strokeWidth={2}
    />
  );
}

/** The weather beside the date on the screensaver: "☼ 64°". */
export function WeatherSaverCorner() {
  const { data } = useWeather();
  if (data?.status !== "ok" || !data.current) return null;
  const { icon: Icon, words } = sky(data.current.code, data.current.is_day);
  return (
    <span className="inline-flex items-center gap-2">
      <Icon aria-label={words} role="img" className="size-10" strokeWidth={2} />
      {degrees(data.current.temperature)}
    </span>
  );
}
