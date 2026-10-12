import { useState } from "react";

import { addDays } from "../../lib/dates";
import { Chip, ChipRow } from "../../ui/Chip";
import { MonthGrid } from "../../ui/MonthGrid";
import { Segmented } from "../../ui/Segmented";
import { useShell } from "../../ui/shell";
import { Stepper } from "../../ui/Stepper";
import { WeekdayPicker } from "../../ui/WeekStrip";
import type { KeptRule } from "./EventEditor";
import {
  customToRepeat,
  describeRepeat,
  monthDateWords,
  monthWeekdayWords,
  repeatPresets,
  repeatToCustom,
  sameRepeat,
  type CustomRepeat,
  type Repeat,
  type RepeatEnd,
} from "./repeat";

export interface RepeatChange {
  repeat: Repeat | null;
  repeatEnd: RepeatEnd;
  /** Picking anything lets go of a rule that was being kept as it is. */
  kept: null;
}

type EndKind = "never" | "until" | "count";
const DEFAULT_COUNT = 10;
const DEFAULT_UNTIL_DAYS = 90;

/**
 * How something repeats (UX §4 "Repeats", ADR 0029): the usual choices as chips, and Custom…,
 * which opens every N days, weeks, months or years, on the weekdays picked (in the household's
 * order), by date or by weekday in a month. Whenever it repeats, Ends: never, on a date, or
 * after a number of times. The sentence under it says the rule in words. A rule these shapes
 * can't hold shows as a pressed "As it is" chip with the server's words, and stays untouched
 * until another choice is made.
 */
export function RepeatField({
  label = "Repeats",
  day,
  today,
  value,
  repeatEnd,
  kept,
  weekStartsOn,
  presetKeys,
  onChange,
}: {
  label?: string;
  /** The day it starts on: the presets and the month choices are worded from it. */
  day: string;
  today: string;
  value: Repeat | null;
  repeatEnd: RepeatEnd;
  kept: KeptRule | null;
  /** 0 Monday … 6 Sunday, as the household counts. */
  weekStartsOn: number;
  /** Which presets to offer, by key; all of them when left out. */
  presetKeys?: readonly string[];
  onChange: (change: RepeatChange) => void;
}) {
  const display = useShell() === "display";
  const presets = repeatPresets(day).filter(
    (preset) => !presetKeys || presetKeys.includes(preset.key),
  );
  const isPreset = presets.some((preset) => sameRepeat(preset.repeat, value));
  const [opened, setOpened] = useState(false);
  const open = opened || (!kept && value !== null && !isPreset);
  const custom = repeatToCustom(value, day);
  const endKind: EndKind =
    repeatEnd.until !== undefined ? "until" : repeatEnd.count !== undefined ? "count" : "never";

  const set = (repeat: Repeat | null, end: RepeatEnd = repeatEnd) => {
    onChange({ repeat, repeatEnd: repeat ? end : {}, kept: null });
  };
  const setCustom = (change: Partial<CustomRepeat>) => {
    set(customToRepeat({ ...custom, ...change }, day));
  };
  const heading = display ? "text-d-body font-semibold" : "text-body font-semibold";
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  const many = custom.interval > 1;
  return (
    <div className="flex flex-col gap-2">
      <p className={heading}>{label}</p>
      <ChipRow label={label}>
        {kept ? (
          <Chip on onClick={() => undefined}>
            {`As it is: ${kept.text.charAt(0).toLowerCase()}${kept.text.slice(1)}`}
          </Chip>
        ) : null}
        {presets.map((preset) => (
          <Chip
            key={preset.key}
            on={!kept && sameRepeat(preset.repeat, value)}
            onClick={() => {
              setOpened(false);
              set(preset.repeat);
            }}
          >
            {preset.label}
          </Chip>
        ))}
        <Chip
          on={open}
          expanded={open}
          onClick={() => {
            if (open) {
              setOpened(false);
              // Closing Custom with a custom rule set goes back to not repeating.
              if (!isPreset) set(null);
              return;
            }
            setOpened(true);
            if (kept || value === null) set(customToRepeat(custom, day));
          }}
        >
          Custom…
        </Chip>
      </ChipRow>
      {open ? (
        <div className="flex flex-col gap-4 rounded-panel border-2 border-line p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={heading}>Every</span>
            <Stepper
              label="Every"
              value={custom.interval}
              onChange={(interval) => {
                setCustom({ interval });
              }}
            />
            <Segmented
              label="Every what"
              value={custom.freq}
              options={[
                { value: "daily", label: many ? "Days" : "Day" },
                { value: "weekly", label: many ? "Weeks" : "Week" },
                { value: "monthly", label: many ? "Months" : "Month" },
                { value: "yearly", label: many ? "Years" : "Year" },
              ]}
              onChange={(freq) => {
                setCustom({ freq });
              }}
            />
          </div>
          {custom.freq === "weekly" ? (
            <div className="flex flex-col gap-2">
              <span className={heading}>On</span>
              <WeekdayPicker
                label="On"
                weekStartsOn={weekStartsOn}
                value={custom.weekdays}
                onChange={(weekdays) => {
                  setCustom({ weekdays });
                }}
              />
            </div>
          ) : null}
          {custom.freq === "monthly" ? (
            <Segmented
              label="On which day of the month"
              value={custom.monthlyBy}
              options={[
                { value: "date", label: `On ${monthDateWords(day)}` },
                { value: "weekday", label: `On ${monthWeekdayWords(day)}` },
              ]}
              onChange={(monthlyBy) => {
                setCustom({ monthlyBy });
              }}
            />
          ) : null}
        </div>
      ) : null}
      {value ? (
        <div className="flex flex-col gap-2">
          <p className={heading}>Ends</p>
          <Segmented<EndKind>
            label="Ends"
            value={endKind}
            options={[
              { value: "never", label: "Never" },
              { value: "until", label: "On a date" },
              { value: "count", label: "After a number of times" },
            ]}
            onChange={(kind) => {
              set(
                value,
                kind === "until"
                  ? { until: repeatEnd.until ?? addDays(day, DEFAULT_UNTIL_DAYS) }
                  : kind === "count"
                    ? { count: repeatEnd.count ?? DEFAULT_COUNT }
                    : {},
              );
            }}
          />
          {endKind === "until" ? (
            <MonthGrid
              label="The last day"
              value={repeatEnd.until ?? null}
              today={today}
              weekStartsOn={weekStartsOn}
              min={day}
              onChange={(until) => {
                set(value, { until });
              }}
            />
          ) : null}
          {endKind === "count" ? (
            <div className="flex items-center gap-3">
              <Stepper
                label="Times"
                value={repeatEnd.count ?? DEFAULT_COUNT}
                onChange={(count) => {
                  set(value, { count });
                }}
              />
              <span className={heading}>{repeatEnd.count === 1 ? "time" : "times"}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <p aria-live="polite" className={soft}>
        {value
          ? describeRepeat(value, day, repeatEnd, weekStartsOn)
          : kept
            ? kept.text
            : "Doesn't repeat"}
      </p>
    </div>
  );
}
