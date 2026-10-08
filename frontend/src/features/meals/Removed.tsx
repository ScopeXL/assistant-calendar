import { useEffect } from "react";

import { shortDate } from "../../lib/dates";
import { RemovedRow } from "../settings/RecentlyRemoved";
import { SLOT_WORDS, useMealChanges, useRemovedMeals } from "./data";

/** Meals taken off a day and saved meals archived in the last 7 days, in Recently removed. */
export function RemovedMealRows({ onCount }: { onCount: (count: number) => void }) {
  const { data } = useRemovedMeals();
  const { restore, unarchiveSaved } = useMealChanges();
  const entries = data?.entries ?? [];
  const saved = data?.saved ?? [];
  const count = entries.length + saved.length;
  useEffect(() => {
    onCount(count);
  }, [count, onCount]);
  return (
    <>
      {entries.map((entry) => (
        <RemovedRow
          key={entry.id}
          title={entry.text}
          detail={`${SLOT_WORDS[entry.slot]} on ${shortDate(entry.day)}`}
          removedAt={entry.deleted_at}
          pending={restore.isPending && restore.variables.entry.id === entry.id}
          onPutBack={() => {
            restore.mutate({ entry });
          }}
        />
      ))}
      {saved.map((meal) => (
        <RemovedRow
          key={meal.id}
          title={meal.text}
          detail="A saved meal"
          removedAt={meal.deleted_at}
          pending={unarchiveSaved.isPending && unarchiveSaved.variables.saved.id === meal.id}
          onPutBack={() => {
            unarchiveSaved.mutate({ saved: meal });
          }}
        />
      ))}
    </>
  );
}
