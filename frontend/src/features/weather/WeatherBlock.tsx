import { useState } from "react";

import { formatTime, formatWallTime, shortWeekday, zonedParts } from "../../lib/dates";
import { useMinute } from "../../lib/time";
import { Sheet } from "../../ui/Sheet";
import { useShell } from "../../ui/shell";
import type { RailPlace } from "../registry";
import { useWeather, useWeatherDay, type Weather, type WeatherDay } from "./data";
import { degrees, highLow, placeWithoutCountry, rainChance, sky } from "./sky";

/** "as of 9:10" once the forecast is over 3 hours old (PLAN §11.4). */
function staleText(weather: Weather): string | null {
  return weather.stale && weather.fetched_at
    ? `as of ${formatTime(new Date(weather.fetched_at))}`
    : null;
}

/** The forecast's first line, the weather now: "Partly cloudy, 64° now. High 72°, low 55°.",
 * with ", as of 9:10" after "now" when the forecast is old. */
function nowLine(weather: Weather, day: WeatherDay | undefined): string | null {
  if (!weather.current) return null;
  const { words } = sky(weather.current.code, weather.current.is_day);
  const stale = staleText(weather);
  const now = `${words}, ${degrees(weather.current.temperature)} now${stale ? `, ${stale}` : ""}.`;
  return day ? `${now} ${highLow(day.high, day.low)}.` : now;
}

/**
 * The weather by the clock (UX §3): the sky's icon and the temperature, with the day's high over
 * its low beside them in the wall's header, or under them at the top of a phone's Today. A tap
 * opens the forecast: Today and the days ahead. Nothing shows until there's a forecast.
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
  const header = place === "header";
  const button = header
    ? "press flex min-h-tap shrink-0 items-center gap-3 rounded-chip-d px-2 text-left"
    : "press flex min-h-11 items-center gap-3 self-start rounded-chip px-1 text-left";
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
          <Icon aria-hidden="true" className={header ? "size-8" : "size-7"} strokeWidth={2} />
          <span className={`${header ? "text-d-title" : "text-title"} font-bold whitespace-nowrap`}>
            {degrees(data.current.temperature)}
          </span>
        </span>
        {header ? (
          day || stale ? (
            // The high over the low; an old forecast says when it's from instead.
            <span className="flex flex-col text-d-caption leading-tight font-semibold whitespace-nowrap text-ink-soft">
              {stale ? (
                <span>{stale}</span>
              ) : (
                <>
                  <span>{day ? degrees(day.high) : null}</span>
                  <span>{day ? degrees(day.low) : null}</span>
                </>
              )}
            </span>
          ) : null
        ) : day || stale ? (
          <span className="text-secondary font-semibold whitespace-nowrap text-ink-soft">
            {day ? `${degrees(day.high)} / ${degrees(day.low)}` : null}
            {day && stale ? " · " : null}
            {stale}
          </span>
        ) : null}
      </button>
      <Forecast
        weather={data}
        day={day}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}

/**
 * The forecast, from the weather by the clock (UX §3, ADR 0033): titled with the place without
 * its country, on one line; **Today**, a line on the weather now with the day's high and low,
 * then the next twelve hours; **Forecast**, the days ahead.
 */
function Forecast({
  weather,
  day,
  open,
  onClose,
}: {
  weather: Weather;
  /** Today's forecast, for its high and low. */
  day: WeatherDay | undefined;
  open: boolean;
  onClose: () => void;
}) {
  const display = useShell() === "display";
  const text = display ? "text-d-body" : "text-body";
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  const today = weather.daily[0]?.date;
  const now = nowLine(weather, day);
  return (
    <Sheet
      open={open}
      title={placeWithoutCountry(weather.location_label) ?? "The Weather"}
      oneLineTitle
      onClose={onClose}
    >
      <div className="flex flex-col gap-6">
        <section aria-label="Today" className="flex flex-col gap-3">
          <h3 className={`${text} font-bold`}>Today</h3>
          {now ? <p className={soft}>{now}</p> : null}
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
        <section aria-label="Forecast" className="flex flex-col gap-1">
          <h3 className={`${text} font-bold`}>Forecast</h3>
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
 * reaches). The forecast itself is a tap on the header's weather away. */
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
