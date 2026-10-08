import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { qk } from "../../api/keys";
import { addDays, formatWallRange, shortDate, zonedParts } from "../../lib/dates";
import type { BoardPanel } from "../../lib/displayState";
import { useMembers, useSettings } from "../../lib/household";
import { askForPin } from "../../lib/parent";
import { fetchSession } from "../../lib/session";
import { useMinute } from "../../lib/time";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Chip, ChipRow } from "../../ui/Chip";
import { SidePanel } from "../../ui/SidePanel";
import { useShell } from "../../ui/shell";
import { useCalendars, useEvent, useEventChanges } from "./data";
import { ScopeChooser } from "./ScopeChooser";
import type { Occurrence, Scope } from "./types";

/** The occurrence a panel was opened from, as the board last loaded it. */
export function useCachedOccurrence(key: string | null): Occurrence | null {
  const queryClient = useQueryClient();
  if (!key) return null;
  for (const [, data] of queryClient.getQueriesData<{ occurrences: Occurrence[] }>({
    queryKey: ["occurrences"],
  })) {
    const found = data?.occurrences.find((o) => o.key === key);
    if (found) return found;
  }
  return null;
}

/** "Thu, Oct 9 · 4:00–5:00 PM", "Fri, Oct 9 · all day", "Thu, Oct 8 – Sat, Oct 10". */
export function whenText(occurrence: Occurrence): string {
  if (occurrence.all_day && occurrence.start_date && occurrence.end_date) {
    const last = addDays(occurrence.end_date, -1);
    return last === occurrence.start_date
      ? `${shortDate(occurrence.start_date)} · all day`
      : `${shortDate(occurrence.start_date)} – ${shortDate(last)}`;
  }
  if (occurrence.start_local && occurrence.end_local) {
    const day = occurrence.start_local.slice(0, 10);
    const endDay = occurrence.end_local.slice(0, 10);
    const range = formatWallRange(occurrence.start_local, occurrence.end_local);
    return endDay === day
      ? `${shortDate(day)} · ${range}`
      : `${shortDate(day)} – ${shortDate(endDay)} · ${range}`;
  }
  return "";
}

/**
 * An event's sheet (UX §4 "Event sheet"): when, how it repeats, who, where, which calendar and
 * the notes, then Change, Move and Remove. A repeating event asks which ones. With Kid-safe
 * editing on, Change and Remove on the wall screen ask for the parent PIN; Move doesn't.
 */
export function EventSheet({
  panel,
  onClose,
  onChange,
}: {
  panel: Extract<BoardPanel, { kind: "event" }> | null;
  onClose: () => void;
  onChange: (eventId: string, recurrenceId: string | null) => void;
}) {
  const display = useShell() === "display";
  const occurrence = useCachedOccurrence(panel?.key ?? null);
  const { data: event } = useEvent(panel?.eventId ?? null);
  const { data: members = [] } = useMembers();
  const { data: calendars = [] } = useCalendars();
  const { data: settings } = useSettings();
  const { data: session } = useQuery({ queryKey: qk.session(), queryFn: fetchSession });
  const changes = useEventChanges();
  const [moving, setMoving] = useState(false);
  const [asking, setAsking] = useState<null | { verb: "Remove" | "Move"; toDay?: string }>(null);
  const today = zonedParts(useMinute()).day;

  const title = occurrence?.title ?? event?.title ?? "";
  const people = members.filter((m) =>
    (occurrence?.member_ids ?? event?.member_ids ?? []).includes(m.id),
  );
  const calendar = calendars.find((c) => c.id === (occurrence?.calendar_id ?? event?.calendar_id));
  const repeats = occurrence?.is_recurring ?? Boolean(event?.rrule);
  const readOnly = occurrence?.read_only ?? event?.read_only ?? false;
  const target = panel ? { eventId: panel.eventId, recurrenceId: panel.recurrenceId } : null;
  const guarded =
    display &&
    session?.device_kind === "kiosk" &&
    !session.is_parent &&
    session.has_pin &&
    (settings?.kid_safe_editing ?? true);

  const close = () => {
    setMoving(false);
    setAsking(null);
    onClose();
  };
  const remove = (scope: Scope) => {
    if (!target) return;
    changes.remove.mutate({ target, scope, title }, { onSuccess: close });
  };
  const moveTo = (toDay: string, scope: Scope) => {
    if (!target) return;
    changes.move.mutate({ target, scope, toDate: toDay, title }, { onSuccess: close });
  };

  const text = display ? "text-d-body" : "text-body";
  const soft = display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft";
  const actions = readOnly ? (
    <p className={soft}>This calendar comes from an account. Change it there.</p>
  ) : moving ? null : (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        onClick={() => {
          void (async () => {
            if (guarded && !(await askForPin("Changing events on this screen asks for the PIN."))) {
              return;
            }
            if (panel) onChange(panel.eventId, panel.recurrenceId);
          })();
        }}
      >
        Change
      </Button>
      <Button
        variant="secondary"
        onClick={() => {
          setMoving(true);
        }}
      >
        Move
      </Button>
      <Button
        variant="quiet-danger"
        onClick={() => {
          if (repeats) setAsking({ verb: "Remove" });
          else remove("all");
        }}
      >
        Remove
      </Button>
    </div>
  );

  return (
    <>
      <SidePanel open={panel !== null} title={title} onClose={close} footer={actions}>
        <div className="flex flex-col gap-4">
          {occurrence ? <p className={`${text} font-semibold`}>{whenText(occurrence)}</p> : null}
          {event?.repeat_text ? <p className={soft}>{event.repeat_text}</p> : null}
          {occurrence?.is_override ? <p className={soft}>Changed from the usual time</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            {people.length ? (
              people.map((member) => (
                <span key={member.id} className={`flex items-center gap-2 ${text}`}>
                  <Avatar member={member} size="sm" />
                  {member.name}
                </span>
              ))
            ) : (
              <span className={`flex items-center gap-2 ${text}`}>
                <Avatar member={null} size="sm" />
                Everyone
              </span>
            )}
          </div>
          {occurrence?.location || event?.location ? (
            <p className={text}>{occurrence?.location ?? event?.location}</p>
          ) : null}
          {calendar ? <p className={soft}>{calendar.name}</p> : null}
          {event?.description ? (
            <p className={`${text} whitespace-pre-wrap`}>{event.description}</p>
          ) : null}
          {moving ? (
            <MovePicker
              today={today}
              onPick={(day) => {
                if (repeats) setAsking({ verb: "Move", toDay: day });
                else moveTo(day, "all");
              }}
              onCancel={() => {
                setMoving(false);
              }}
            />
          ) : null}
        </div>
      </SidePanel>
      <ScopeChooser
        open={asking !== null}
        verb={asking?.verb ?? "Remove"}
        title={title}
        repeatText={event?.repeat_text}
        onChoose={(scope) => {
          const pending = asking;
          setAsking(null);
          if (pending?.verb === "Move" && pending.toDay) moveTo(pending.toDay, scope);
          else remove(scope);
        }}
        onCancel={() => {
          setAsking(null);
        }}
      />
    </>
  );
}

/** Move to another day (UX §4): the next 14 days as chips, or any date. */
function MovePicker({
  today,
  onPick,
  onCancel,
}: {
  today: string;
  onPick: (day: string) => void;
  onCancel: () => void;
}) {
  const display = useShell() === "display";
  const days = Array.from({ length: 14 }, (_, n) => addDays(today, n));
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <p className={display ? "text-d-body font-semibold" : "text-body font-semibold"}>Move to</p>
      <ChipRow label="Move to">
        {days.map((day) => (
          <Chip
            key={day}
            on={false}
            onClick={() => {
              onPick(day);
            }}
          >
            {day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : shortDate(day)}
          </Chip>
        ))}
      </ChipRow>
      <label className="flex flex-col gap-2">
        <span
          className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
        >
          Another day
        </span>
        <input
          type="date"
          min={today}
          className={`rounded-button border-2 border-line bg-surface ${
            display ? "min-h-16 px-4 text-d-body" : "min-h-12 px-3 text-body"
          }`}
          onChange={(event) => {
            if (event.target.value) onPick(event.target.value);
          }}
        />
      </label>
      <Button variant="quiet" onClick={onCancel}>
        Don't move
      </Button>
    </div>
  );
}
