import { useState } from "react";

import { formatWallTime } from "../lib/dates";
import { useReveal } from "../lib/reveal";
import { atHour, atMinute, timeChips } from "../lib/times";
import { Chip, ChipRow } from "./Chip";
import { useShell } from "./shell";

const LATER = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const EARLIER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = ["00", "15", "30", "45"];

const clock = (time: string) => formatWallTime(`2000-01-01T${time}:00`);

/**
 * A time of day, picked by touch (UX §4, ADR 0029): a chip for no time at all ("All day", "Any
 * time"), a few likely times, and Pick a time, which opens the hours (6 AM to 11 PM, with
 * Earlier hours) and the minutes in place. A time that isn't one of the suggestions shows as a
 * pressed chip in clock order, so what's chosen is always on the row. `words` says a chip its
 * own way ("by 5:00 PM").
 */
export function TimeField({
  label,
  value,
  onChange,
  none,
  suggestions,
  words = clock,
  pickLabel = "Pick a time",
}: {
  label: string;
  /** "HH:MM", or null for no time. */
  value: string | null;
  onChange: (time: string | null) => void;
  /** The chip for no time, or null when a time is required. */
  none: { label: string } | null;
  suggestions: readonly string[];
  words?: (time: string) => string;
  pickLabel?: string;
}) {
  const display = useShell() === "display";
  const [open, setOpen] = useState(false);
  const [early, setEarly] = useState(false);
  const picker = useReveal<HTMLDivElement>(open);
  const hour = value ? Number(value.slice(0, 2)) : null;
  const minute = value ? value.slice(3, 5) : null;
  const heading = display ? "text-d-body font-semibold" : "text-body font-semibold";
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  return (
    <div className="flex flex-col gap-2">
      <p className={heading}>{label}</p>
      <ChipRow label={label}>
        {none ? (
          <Chip
            on={value === null}
            onClick={() => {
              onChange(null);
            }}
          >
            {none.label}
          </Chip>
        ) : null}
        {timeChips(suggestions, value).map((time) => (
          <Chip
            key={time}
            on={value === time}
            onClick={() => {
              onChange(time);
            }}
          >
            {words(time)}
          </Chip>
        ))}
        <Chip
          on={open}
          expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {pickLabel}
        </Chip>
      </ChipRow>
      {open ? (
        <div ref={picker} className="flex flex-col gap-3 rounded-panel border-2 border-line p-3">
          <p className={soft}>Hour</p>
          <ChipRow label={`${label}: hour`}>
            {(early ? EARLIER : LATER).map((h) => (
              <Chip
                key={h}
                on={hour === h}
                onClick={() => {
                  onChange(atHour(h, value));
                }}
              >
                {formatWallTime(`2000-01-01T${atHour(h, null)}:00`, { compact: true })}
              </Chip>
            ))}
            <Chip
              on={early}
              onClick={() => {
                setEarly(!early);
              }}
            >
              {early ? "Later hours" : "Earlier hours"}
            </Chip>
          </ChipRow>
          <p className={soft}>Minutes</p>
          <ChipRow label={`${label}: minutes`}>
            {MINUTES.map((m) => (
              <Chip
                key={m}
                on={minute === m}
                onClick={() => {
                  onChange(atMinute(m, value));
                }}
              >
                {`:${m}`}
              </Chip>
            ))}
          </ChipRow>
        </div>
      ) : null}
    </div>
  );
}
