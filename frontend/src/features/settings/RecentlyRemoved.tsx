import { useState } from "react";

import { shortDate, zonedParts } from "../../lib/dates";
import { Button } from "../../ui/Button";
import { useShell } from "../../ui/shell";
import { useEventChanges, useRemovedEvents } from "../calendar/data";
import { useRemovedGroups } from "../usePluginModules";
import { Group, Text } from "./parts";

/**
 * Recently removed (UX §4 Settings → Household, PLAN §8.4): what was removed in the last 7 days
 * (events, and each plugin's own: lists, items, chores), each with Put back, because a toast's
 * Undo is gone before a parent sees what a kid did.
 */
export function RecentlyRemoved() {
  const { data: removed = [] } = useRemovedEvents();
  const { restore } = useEventChanges();
  const groups = useRemovedGroups();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const nothing = removed.length === 0 && groups.every(({ id }) => (counts[id] ?? 0) === 0);
  const display = useShell() === "display";
  return (
    <Group title="Recently Removed">
      {nothing ? (
        <div className={display ? "py-5" : "py-4"}>
          <Text soft>Things removed in the last 7 days show here.</Text>
        </div>
      ) : null}
      {removed.map((event) => {
        const day = event.start_date ?? event.start?.slice(0, 10) ?? null;
        return (
          <RemovedRow
            key={event.id}
            title={event.title}
            detail={event.repeat_text ?? (day ? shortDate(day) : null)}
            removedAt={event.deleted_at ?? null}
            pending={restore.isPending && restore.variables.id === event.id}
            onPutBack={() => {
              restore.mutate(event);
            }}
          />
        );
      })}
      {groups.map(({ id, Rows }) => (
        <Rows
          key={id}
          onCount={(count) => {
            setCounts((known) => (known[id] === count ? known : { ...known, [id]: count }));
          }}
        />
      ))}
    </Group>
  );
}

/** One removed thing with Put back; plugins use it for their own rows. */
export function RemovedRow({
  title,
  detail,
  removedAt,
  pending,
  onPutBack,
}: {
  title: string;
  /** What it was: "Every week on Thu", "Groceries". */
  detail: string | null;
  removedAt: string | null;
  pending: boolean;
  onPutBack: () => void;
}) {
  const display = useShell() === "display";
  const when = removedAt ? zonedParts(new Date(removedAt)).day : null;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${
        display ? "min-h-20 py-4" : "min-h-14 py-3"
      }`}
    >
      <div className="flex min-w-0 flex-col">
        <span className={`${display ? "text-d-body" : "text-body"} font-semibold`}>{title}</span>
        <span
          className={display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"}
        >
          {[detail, when ? `removed ${shortDate(when)}` : null].filter(Boolean).join(" · ")}
        </span>
      </div>
      <Button variant="secondary" pending={pending} onClick={onPutBack}>
        Put back
        <span className="sr-only"> {title}</span>
      </Button>
    </div>
  );
}
