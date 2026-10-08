import { useEffect, useMemo, useState, type ReactNode } from "react";

import { errorMessage } from "../../api/client";
import {
  addDays,
  formatWallTime,
  householdZone,
  shortDate,
  shortWeekday,
  weekdayOf,
} from "../../lib/dates";
import { useMembers, useSettings } from "../../lib/household";
import { serverNow } from "../../lib/clock";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { useShell } from "../../ui/shell";
import { WhoPicker } from "../../ui/WhoPicker";
import { TextField } from "../../ui/TextField";
import { useCalendars } from "./data";
import { parseQuickAdd, type QuickAddDraft } from "./quickAdd";
import {
  describeRepeat,
  repeatPresets,
  repeatToRRule,
  rruleToRepeat,
  type Repeat,
  type RepeatEnd,
} from "./repeat";
import type { CalendarEvent, EventFields, Occurrence, PersonColor } from "./types";

const COLORS: { value: PersonColor; word: string }[] = [
  { value: "clay", word: "Red" },
  { value: "olive", word: "Olive" },
  { value: "moss", word: "Green" },
  { value: "sea", word: "Teal" },
  { value: "sky", word: "Blue" },
  { value: "iris", word: "Purple" },
  { value: "berry", word: "Plum" },
  { value: "rose", word: "Pink" },
];
const LENGTHS = [30, 60, 90, 120, 180];
const REMINDERS: { minutes: number | null; label: string }[] = [
  { minutes: null, label: "None" },
  { minutes: 10, label: "10 min before" },
  { minutes: 60, label: "1 hour before" },
  { minutes: 1440, label: "1 day before" },
];

type Field = "day" | "time" | "length" | "who" | "repeat";
type Picker = Field | "calendar" | "color" | "more" | null;

export interface Draft {
  title: string;
  day: string;
  allDay: boolean;
  /** Last day for an all-day span (inclusive); null is one day. */
  lastDay: string | null;
  start: string; // "HH:MM"
  minutes: number;
  memberIds: string[];
  repeat: Repeat | null;
  repeatEnd: RepeatEnd;
  calendarId: string | null;
  color: PersonColor | null;
  location: string;
  notes: string;
  reminder: number | null;
}

function lengthWords(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} min`;
  if (minutes === 60) return "1 hour";
  if (minutes === 90) return "1½ hours";
  return minutes % 60 === 0
    ? `${String(minutes / 60)} hours`
    : `${String(Math.floor(minutes / 60))} h ${String(minutes % 60)} min`;
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

function addMinutes(day: string, start: string, minutes: number): string {
  const [h = 0, m = 0] = start.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const days = Math.floor(total / 1440);
  const rest = total - days * 1440;
  return `${addDays(day, days)}T${String(Math.floor(rest / 60)).padStart(2, "0")}:${String(rest % 60).padStart(2, "0")}`;
}

/**
 * The day a weekly repeat starts: its first weekday on or after the chosen day. A start on any
 * other day would be an extra occurrence (RFC 5545 always counts the start), so "Every weekday"
 * chosen on a Saturday starts on Monday.
 */
export function firstDayOf(repeat: Repeat | null, day: string): string {
  if (repeat?.freq !== "weekly") return day;
  for (let n = 0; n < 7; n += 1) {
    const candidate = addDays(day, n);
    if (repeat.weekdays.includes(weekdayOf(candidate))) return candidate;
  }
  return day;
}

/** The API body for this draft. `align` moves a weekly repeat's start onto one of its days;
 * one occurrence changed on its own stays where it was put. */
export function draftToFields(
  original: Draft,
  { align = true }: { align?: boolean } = {},
): EventFields & { title: string } {
  const day = align ? firstDayOf(original.repeat, original.day) : original.day;
  const draft: Draft =
    day === original.day
      ? original
      : {
          ...original,
          day,
          lastDay: original.lastDay ? addDays(original.lastDay, dayDiff(original.day, day)) : null,
        };
  const rrule = draft.repeat ? repeatToRRule(draft.repeat, draft.day, draft.repeatEnd) : null;
  const common = {
    title: draft.title.trim(),
    member_ids: draft.memberIds,
    reminders: draft.reminder === null ? [] : [draft.reminder],
    calendar_id: draft.calendarId,
    color: draft.color,
    location: draft.location.trim(),
    description: draft.notes,
    rrule,
  };
  if (draft.allDay) {
    return {
      ...common,
      all_day: true,
      start_date: draft.day,
      end_date: addDays(draft.lastDay ?? draft.day, 1),
    };
  }
  return {
    ...common,
    all_day: false,
    start: `${draft.day}T${draft.start}`,
    end: addMinutes(draft.day, draft.start, draft.minutes),
  };
}

/** A draft for an existing event, at the occurrence it was opened from. */
export function draftFromEvent(event: CalendarEvent, occurrence: Occurrence | null): Draft {
  const startLocal = occurrence?.start_local ?? event.start ?? null;
  const endLocal = occurrence?.end_local ?? event.end ?? null;
  const day = occurrence?.start_date ?? startLocal?.slice(0, 10) ?? event.start_date ?? "";
  const endDate = occurrence?.end_date ?? event.end_date;
  const parsed = event.rrule ? rruleToRepeat(event.rrule, day) : null;
  let minutes = 60;
  if (startLocal && endLocal) {
    minutes = Math.max(
      5,
      Math.round((Date.parse(`${endLocal}Z`) - Date.parse(`${startLocal}Z`)) / 60_000),
    );
  }
  return {
    title: event.title,
    day,
    allDay: event.all_day,
    lastDay: event.all_day && endDate ? addDays(endDate, -1) : null,
    start: startLocal ? startLocal.slice(11, 16) : "09:00",
    minutes,
    memberIds: occurrence?.member_ids ?? event.member_ids,
    repeat: parsed?.repeat ?? null,
    repeatEnd: parsed?.end ?? {},
    calendarId: event.calendar_id,
    color: event.color ?? null,
    location: event.location,
    notes: event.description,
    reminder: event.reminders[0] ?? null,
  };
}

/**
 * The event editor (UX §4 "Add and the event editor", §5): the quick-add field, the line of what
 * was understood, and a chip for each part that opens its picker; anything the parser misread is
 * one tap to fix, and a part set by hand isn't overwritten by more typing. The same form fills
 * the wall's side panel and a phone's sheet.
 */
export function EventEditor({
  initial,
  editing,
  defaultDay,
  defaultHour,
  pending,
  error,
  onSave,
  onDay,
}: {
  /** An existing event's draft; null for a new one. */
  initial: Draft | null;
  /** Only the title in the field (no parsing) when changing an event. */
  editing: boolean;
  defaultDay: string;
  defaultHour: number | null;
  pending: boolean;
  error: unknown;
  onSave: (draft: Draft) => void;
  /** The draft's day as it changes, so the board can light it; null when the editor closes. */
  onDay?: (day: string | null) => void;
}) {
  const display = useShell() === "display";
  const { data: settings } = useSettings();
  const { data: members = [] } = useMembers();
  const { data: calendars = [] } = useCalendars();
  const writable = calendars.filter((c) => !c.read_only && !c.deleted);
  const defaultCalendar = writable.find((c) => c.is_default)?.id ?? writable[0]?.id ?? null;
  const [text, setText] = useState(initial?.title ?? "");
  const [manual, setManual] = useState<Partial<Draft>>(initial ?? {});
  const [picker, setPicker] = useState<Picker>(null);

  const parsed: QuickAddDraft | null = useMemo(() => {
    if (editing) return null;
    return parseQuickAdd(text, {
      now: new Date(serverNow()),
      zone: householdZone() ?? settings?.timezone ?? "UTC",
      weekStartsOn: settings?.week_starts_on ?? 6,
      members: members.map((m) => ({ id: m.id, name: m.name })),
      defaultDay,
    });
  }, [editing, text, settings, members, defaultDay]);

  // A day tapped on the board while the panel is open sets the date (UX §4).
  const [boardDay, setBoardDay] = useState(defaultDay);
  if (boardDay !== defaultDay) {
    setBoardDay(defaultDay);
    if (!initial) setManual((current) => ({ ...current, day: defaultDay }));
  }

  const fromHour = defaultHour === null ? null : `${String(defaultHour).padStart(2, "0")}:00`;
  const draft: Draft = {
    title: editing ? text : (parsed?.title ?? text),
    day: manual.day ?? parsed?.day ?? defaultDay,
    allDay: manual.allDay ?? (parsed ? parsed.allDay && fromHour === null : false),
    lastDay: manual.lastDay ?? null,
    start: manual.start ?? parsed?.start ?? fromHour ?? "09:00",
    minutes: manual.minutes ?? parsed?.durationMinutes ?? 60,
    memberIds: manual.memberIds ?? parsed?.memberIds ?? [],
    repeat: manual.repeat !== undefined ? manual.repeat : (parsed?.repeat ?? null),
    repeatEnd: manual.repeatEnd ?? {},
    calendarId: manual.calendarId ?? defaultCalendar,
    color: manual.color !== undefined ? manual.color : null,
    location: manual.location ?? "",
    notes: manual.notes ?? "",
    reminder: manual.reminder !== undefined ? manual.reminder : null,
  };
  const set = (change: Partial<Draft>) => {
    setManual((current) => ({ ...current, ...change }));
  };
  useEffect(() => {
    onDay?.(draft.day);
  }, [onDay, draft.day]);
  useEffect(
    () => () => {
      onDay?.(null);
    },
    [onDay],
  );
  const people = members.filter((m) => draft.memberIds.includes(m.id));
  const calendar = writable.find((c) => c.id === draft.calendarId);
  const timeText = draft.allDay ? "All day" : formatWallTime(`${draft.day}T${draft.start}:00`);
  const repeatText = draft.repeat
    ? describeRepeat(draft.repeat, draft.day, draft.repeatEnd)
    : "Doesn't repeat";
  const dayText =
    draft.allDay && draft.lastDay && draft.lastDay !== draft.day
      ? `${shortDate(draft.day)} – ${shortDate(draft.lastDay)}`
      : shortDate(draft.day);
  const understood = [
    draft.title || null,
    dayText,
    timeText,
    draft.allDay ? null : lengthWords(draft.minutes),
    people.length ? people.map((p) => p.name).join(", ") : "Everyone",
  ].filter(Boolean);

  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  const label = display ? "text-d-body font-semibold" : "text-body font-semibold";
  const chip = (field: Picker, children: ReactNode) => (
    <Chip
      on={picker === field}
      onClick={() => {
        setPicker(picker === field ? null : field);
      }}
    >
      {children}
    </Chip>
  );

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.title.trim()) onSave(draft);
      }}
    >
      <TextField
        label={editing ? "Title" : "What, when, who"}
        hint={editing ? null : "For example: Dentist Thu 2:30pm Mia"}
        value={text}
        maxLength={200}
        autoComplete="off"
        data-autofocus=""
        error={error ? errorMessage(error) : null}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <div className="flex flex-col gap-2">
        <p className={soft}>{editing ? "When and who" : "Understood as"}</p>
        <p className={`${label} break-words`}>{understood.join(" · ")}</p>
      </div>
      <ChipRow label="Change a part">
        {chip("day", dayText)}
        {chip("time", timeText)}
        {draft.allDay ? null : chip("length", lengthWords(draft.minutes))}
        {chip("who", people.length ? people.map((p) => p.name).join(", ") : "Everyone")}
        {chip("repeat", repeatText)}
        {writable.length > 1 ? chip("calendar", calendar?.name ?? "Calendar") : null}
        {chip(
          "color",
          draft.color ? (COLORS.find((c) => c.value === draft.color)?.word ?? "Color") : "Color",
        )}
        {chip("more", "More…")}
      </ChipRow>
      {picker === "day" ? (
        <DayPicker draft={draft} defaultDay={defaultDay} set={set} />
      ) : picker === "time" ? (
        <TimePicker draft={draft} set={set} />
      ) : picker === "length" ? (
        <ChipRow label="How long">
          {LENGTHS.map((minutes) => (
            <Chip
              key={minutes}
              on={draft.minutes === minutes}
              onClick={() => {
                set({ minutes });
              }}
            >
              {lengthWords(minutes)}
            </Chip>
          ))}
        </ChipRow>
      ) : picker === "who" ? (
        <WhoPicker
          label="Who"
          members={members}
          value={draft.memberIds}
          multiple
          onChange={(memberIds) => {
            set({ memberIds });
          }}
        />
      ) : picker === "repeat" ? (
        <RepeatPicker draft={draft} set={set} />
      ) : picker === "calendar" ? (
        <ChipRow label="Calendar">
          {writable.map((c) => (
            <Chip
              key={c.id}
              on={draft.calendarId === c.id}
              onClick={() => {
                set({ calendarId: c.id });
              }}
            >
              {c.name}
            </Chip>
          ))}
        </ChipRow>
      ) : picker === "color" ? (
        <ChipRow label="Color">
          <Chip
            on={draft.color === null}
            onClick={() => {
              set({ color: null });
            }}
          >
            The person's color
          </Chip>
          {COLORS.map((c) => (
            <Chip
              key={c.value}
              on={draft.color === c.value}
              onClick={() => {
                set({ color: c.value });
              }}
            >
              <span data-person={c.value} className="inline-flex items-center gap-2">
                <span aria-hidden="true" className="size-5 rounded-full bg-p" />
                {c.word}
              </span>
            </Chip>
          ))}
        </ChipRow>
      ) : picker === "more" ? (
        <div className="flex flex-col gap-4">
          <TextField
            label="Where"
            value={draft.location}
            maxLength={300}
            autoComplete="off"
            onChange={(event) => {
              set({ location: event.target.value });
            }}
          />
          <TextField
            label="Notes"
            value={draft.notes}
            maxLength={5000}
            autoComplete="off"
            onChange={(event) => {
              set({ notes: event.target.value });
            }}
          />
          <div className="flex flex-col gap-2">
            <p className={label}>Remind on the kitchen screen</p>
            <ChipRow label="Remind on the kitchen screen">
              {REMINDERS.map((option) => (
                <Chip
                  key={option.label}
                  on={draft.reminder === option.minutes}
                  onClick={() => {
                    set({ reminder: option.minutes });
                  }}
                >
                  {option.label}
                </Chip>
              ))}
            </ChipRow>
          </div>
        </div>
      ) : null}
      {/* On the wall it stays in view at the bottom of the panel; the panel's padding keeps it
          above the on-screen keyboard (a sticky box stops at its scroller's padding). */}
      <div
        className={
          display ? "sticky bottom-0 z-10 -mx-6 border-t border-line bg-surface px-6 py-4" : ""
        }
      >
        <Button type="submit" block pending={pending} disabled={!draft.title.trim()}>
          {editing ? "Save changes" : "Add event"}
        </Button>
      </div>
    </form>
  );
}

function DayPicker({
  draft,
  defaultDay,
  set,
}: {
  draft: Draft;
  defaultDay: string;
  set: (change: Partial<Draft>) => void;
}) {
  const display = useShell() === "display";
  const today = defaultDay;
  const days = Array.from({ length: 7 }, (_, n) => addDays(today, n));
  return (
    <div className="flex flex-col gap-3">
      <ChipRow label="Day">
        {days.map((day, n) => (
          <Chip
            key={day}
            on={draft.day === day}
            onClick={() => {
              set({ day, lastDay: null });
            }}
          >
            {n === 0 ? shortDate(day) : `${shortWeekday(day)} ${String(Number(day.slice(8)))}`}
          </Chip>
        ))}
      </ChipRow>
      <label className="flex flex-col gap-2">
        <span
          className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
        >
          Pick a date
        </span>
        <input
          type="date"
          value={draft.day}
          className={`rounded-button border-2 border-line bg-surface ${
            display ? "min-h-16 px-4 text-d-body" : "min-h-12 px-3 text-body"
          }`}
          onChange={(event) => {
            if (event.target.value) set({ day: event.target.value });
          }}
        />
      </label>
      {draft.allDay ? (
        <label className="flex flex-col gap-2">
          <span
            className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
          >
            Last day (for more than one day)
          </span>
          <input
            type="date"
            value={draft.lastDay ?? draft.day}
            min={draft.day}
            className={`rounded-button border-2 border-line bg-surface ${
              display ? "min-h-16 px-4 text-d-body" : "min-h-12 px-3 text-body"
            }`}
            onChange={(event) => {
              set({ lastDay: event.target.value || null });
            }}
          />
        </label>
      ) : null}
    </div>
  );
}

function TimePicker({ draft, set }: { draft: Draft; set: (change: Partial<Draft>) => void }) {
  const [early, setEarly] = useState(false);
  const hour = Number(draft.start.slice(0, 2));
  const minute = draft.start.slice(3, 5);
  const hours = early
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const at = (h: number, m: string) => `${String(h).padStart(2, "0")}:${m}`;
  return (
    <div className="flex flex-col gap-3">
      <ChipRow label="All day">
        <Chip
          on={draft.allDay}
          onClick={() => {
            set({ allDay: !draft.allDay });
          }}
        >
          All day
        </Chip>
        <Chip
          on={early}
          onClick={() => {
            setEarly(!early);
          }}
        >
          {early ? "Later hours" : "Earlier hours"}
        </Chip>
      </ChipRow>
      <ChipRow label="Hour">
        {hours.map((h) => (
          <Chip
            key={h}
            on={!draft.allDay && hour === h}
            onClick={() => {
              set({ allDay: false, start: at(h, minute) });
            }}
          >
            {formatWallTime(`2000-01-01T${at(h, "00")}:00`, { compact: true })}
          </Chip>
        ))}
      </ChipRow>
      <ChipRow label="Minutes">
        {["00", "15", "30", "45"].map((m) => (
          <Chip
            key={m}
            on={!draft.allDay && minute === m}
            onClick={() => {
              set({ allDay: false, start: at(hour, m) });
            }}
          >
            {`:${m}`}
          </Chip>
        ))}
      </ChipRow>
    </div>
  );
}

function RepeatPicker({ draft, set }: { draft: Draft; set: (change: Partial<Draft>) => void }) {
  const display = useShell() === "display";
  const presets = repeatPresets(draft.day);
  const current = draft.repeat ? JSON.stringify(draft.repeat) : null;
  const ends: { key: string; label: string; end: RepeatEnd }[] = [
    { key: "never", label: "Never ends", end: {} },
    { key: "count", label: "10 times", end: { count: 10 } },
    {
      key: "until",
      label: `Until ${shortDate(addDays(draft.day, 90))}`,
      end: { until: addDays(draft.day, 90) },
    },
  ];
  const endKey = draft.repeatEnd.count ? "count" : draft.repeatEnd.until ? "until" : "never";
  return (
    <div className="flex flex-col gap-3">
      <ChipRow label="Repeats">
        {presets.map((preset) => (
          <Chip
            key={preset.key}
            on={(preset.repeat ? JSON.stringify(preset.repeat) : null) === current}
            onClick={() => {
              set({ repeat: preset.repeat });
            }}
          >
            {preset.label}
          </Chip>
        ))}
      </ChipRow>
      {draft.repeat ? (
        <>
          <ChipRow label="Ends">
            {ends.map((option) => (
              <Chip
                key={option.key}
                on={endKey === option.key}
                onClick={() => {
                  set({ repeatEnd: option.end });
                }}
              >
                {option.label}
              </Chip>
            ))}
          </ChipRow>
          {endKey === "until" ? (
            <label className="flex flex-col gap-2">
              <span
                className={
                  display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"
                }
              >
                Last day
              </span>
              <input
                type="date"
                value={draft.repeatEnd.until ?? ""}
                min={draft.day}
                className={`rounded-button border-2 border-line bg-surface ${
                  display ? "min-h-16 px-4 text-d-body" : "min-h-12 px-3 text-body"
                }`}
                onChange={(event) => {
                  if (event.target.value) set({ repeatEnd: { until: event.target.value } });
                }}
              />
            </label>
          ) : null}
        </>
      ) : null}
      <p className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}>
        {draft.repeat ? describeRepeat(draft.repeat, draft.day, draft.repeatEnd) : "Doesn't repeat"}
      </p>
    </div>
  );
}
