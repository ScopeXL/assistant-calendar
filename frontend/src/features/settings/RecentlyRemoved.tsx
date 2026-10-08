import { shortDate, zonedParts } from "../../lib/dates";
import { Button } from "../../ui/Button";
import { useShell } from "../../ui/shell";
import { useEventChanges, useRemovedEvents } from "../calendar/data";
import { Group, Text } from "./parts";

/**
 * Recently removed (UX §4 Settings → Household, PLAN §8.4): events removed in the last 7 days,
 * each with Put back, because a toast's Undo is gone before a parent sees what a kid did.
 */
export function RecentlyRemoved() {
  const display = useShell() === "display";
  const { data: removed = [] } = useRemovedEvents();
  const { restore } = useEventChanges();
  return (
    <Group title="Recently removed">
      {removed.length === 0 ? (
        <div className={display ? "py-5" : "py-4"}>
          <Text soft>Things removed in the last 7 days show here.</Text>
        </div>
      ) : (
        removed.map((event) => {
          const day = event.start_date ?? event.start?.slice(0, 10) ?? null;
          const when = event.deleted_at ? zonedParts(new Date(event.deleted_at)).day : null;
          return (
            <div
              key={event.id}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${
                display ? "min-h-20 py-4" : "min-h-14 py-3"
              }`}
            >
              <div className="flex min-w-0 flex-col">
                <span className={`${display ? "text-d-body" : "text-body"} font-semibold`}>
                  {event.title}
                </span>
                <span
                  className={
                    display ? "text-d-secondary text-ink-soft" : "text-secondary text-ink-soft"
                  }
                >
                  {[
                    event.repeat_text ?? (day ? shortDate(day) : null),
                    when ? `removed ${shortDate(when)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <Button
                variant="secondary"
                pending={restore.isPending && restore.variables.id === event.id}
                onClick={() => {
                  restore.mutate(event);
                }}
              >
                Put back
                <span className="sr-only"> {event.title}</span>
              </Button>
            </div>
          );
        })
      )}
    </Group>
  );
}
