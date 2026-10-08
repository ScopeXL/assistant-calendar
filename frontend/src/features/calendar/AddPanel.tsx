import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { addDays } from "../../lib/dates";
import type { BoardPanel } from "../../lib/displayState";
import { SidePanel } from "../../ui/SidePanel";
import { useEvent, useEventChanges } from "./data";
import { EventEditor, draftFromEvent, draftToFields, type Draft } from "./EventEditor";
import { ScopeChooser } from "./ScopeChooser";
import type { CalendarEvent, EventFields, Occurrence, Scope } from "./types";

type EditorPanel = Extract<BoardPanel, { kind: "add" } | { kind: "edit" }>;

/** The occurrence a change was opened from, from the board's loaded weeks. */
export function useOccurrenceOf(
  eventId: string | null,
  recurrenceId: string | null,
): Occurrence | null {
  const queryClient = useQueryClient();
  if (!eventId) return null;
  for (const [, data] of queryClient.getQueriesData<{ occurrences: Occurrence[] }>({
    queryKey: ["occurrences"],
  })) {
    const found = data?.occurrences.find(
      (o) => o.event_id === eventId && (o.recurrence_id ?? null) === recurrenceId,
    );
    if (found) return found;
  }
  return null;
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * What a change sends at each scope. "This" can't repeat; "all" keeps the series' first day,
 * moved only as far as the occurrence's day moved, so a changed time doesn't restart the series.
 */
export function fieldsFor(
  draft: Draft,
  scope: Scope,
  event: CalendarEvent,
  occurrence: Occurrence | null,
): EventFields & { title: string; clear_rrule?: boolean } {
  const fields = draftToFields(draft, { align: scope !== "this" });
  if (scope === "this") {
    const one = { ...fields };
    delete one.rrule;
    return one;
  }
  const clear = !fields.rrule && Boolean(event.rrule);
  if (scope === "following" || !occurrence) return { ...fields, clear_rrule: clear };
  const occurrenceDay = occurrence.start_date ?? occurrence.start_local?.slice(0, 10) ?? draft.day;
  const shift = dayDiff(occurrenceDay, draft.day);
  const seriesDay = event.start_date ?? event.start?.slice(0, 10) ?? draft.day;
  const day = addDays(seriesDay, shift);
  const moved = draftToFields({
    ...draft,
    day,
    lastDay: draft.lastDay ? addDays(draft.lastDay, dayDiff(draft.day, day)) : null,
  });
  return { ...moved, clear_rrule: clear };
}

/** The wall screen's Add panel and editor (UX §4), in the side panel. */
export function AddPanel({
  panel,
  today,
  onClose,
  onDay,
}: {
  panel: EditorPanel | null;
  today: string;
  onClose: () => void;
  /** The day being added to or changed, for the board to light (UX §6). */
  onDay?: (day: string | null) => void;
}) {
  const editing = panel?.kind === "edit" ? panel : null;
  const { data: event } = useEvent(editing?.eventId ?? null);
  const occurrence = useOccurrenceOf(editing?.eventId ?? null, editing?.recurrenceId ?? null);
  const changes = useEventChanges();
  const [asking, setAsking] = useState<Draft | null>(null);
  const repeats = Boolean(event?.rrule);

  const save = (draft: Draft, scope: Scope) => {
    if (!editing || !event) return;
    changes.save.mutate(
      {
        target: { eventId: editing.eventId, recurrenceId: editing.recurrenceId },
        scope,
        fields: fieldsFor(draft, scope, event, occurrence),
      },
      { onSuccess: onClose },
    );
  };
  const title = editing ? "Change" : "Add";
  const ready = !editing || event !== undefined;
  return (
    <>
      <SidePanel open={panel !== null} title={title} onClose={onClose}>
        {panel && ready ? (
          <EventEditor
            key={editing ? `${editing.eventId}|${editing.recurrenceId ?? ""}` : "new"}
            initial={editing && event ? draftFromEvent(event, occurrence) : null}
            editing={editing !== null}
            defaultDay={panel.kind === "add" ? (panel.day ?? today) : today}
            defaultHour={panel.kind === "add" ? panel.hour : null}
            pending={changes.add.isPending || changes.save.isPending}
            {...(onDay ? { onDay } : {})}
            error={changes.add.error ?? changes.save.error}
            onSave={(draft) => {
              if (!editing) {
                changes.add.mutate(draftToFields(draft), { onSuccess: onClose });
              } else if (repeats && editing.recurrenceId) {
                setAsking(draft);
              } else {
                save(draft, "all");
              }
            }}
          />
        ) : null}
      </SidePanel>
      <ScopeChooser
        open={asking !== null}
        verb="Change"
        title={event?.title ?? ""}
        repeatText={event?.repeat_text}
        onChoose={(scope) => {
          const draft = asking;
          setAsking(null);
          if (draft) save(draft, scope);
        }}
        onCancel={() => {
          setAsking(null);
        }}
      />
    </>
  );
}
