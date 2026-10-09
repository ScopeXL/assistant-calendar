import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

import { addDays, shortDate, weekSpan } from "../../lib/dates";
import { useMembers } from "../../lib/household";
import { Button } from "../../ui/Button";
import { Screen } from "../../ui/Screen";
import { SLOT_WORDS, mealName, useMealChanges, useWeek, type Slot } from "./data";
import { MealSidePanel, useMealWeek, type MealPanel } from "./MealsRoom";
import { SavedMeals } from "./SavedMeals";

/** Meals on a phone (UX §5 "Meals"): the week as a list of days with the meal and who cooks,
 * "+ Add dinner" on empty days; or Saved meals. */
export function MealsTab({ path }: { path: string[] }) {
  if (path[0] === "saved") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-32">
        <SavedMeals />
      </main>
    );
  }
  return <MealsWeekPhone />;
}

function MealsWeekPhone() {
  const [offset, setOffset] = useState(0);
  const { today, days, start } = useMealWeek(offset);
  const { data: week } = useWeek(start);
  const { data: members = [] } = useMembers();
  const changes = useMealChanges();
  const [panel, setPanel] = useState<MealPanel>(null);
  const slots: Slot[] = week?.slots ?? ["dinner"];
  const entries = week?.entries ?? [];
  return (
    <Screen title="Meals" back="/more">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="quiet"
            aria-label="Last week"
            onClick={() => {
              setOffset(offset - 1);
            }}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="text-row font-bold">{weekSpan(days)}</span>
          <Button
            variant="quiet"
            aria-label="Next week"
            onClick={() => {
              setOffset(offset + 1);
            }}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <Link
          to="/$room/$"
          params={{ room: "meals", _splat: "saved" }}
          className="press inline-flex min-h-11 items-center gap-2 rounded-button border-2 border-line bg-surface px-3 text-body font-semibold"
        >
          <BookOpen aria-hidden="true" className="size-5" />
          Saved Meals
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-line rounded-chip border border-line bg-surface">
        {days.map((day) => (
          <li
            key={day}
            aria-current={day === today ? "date" : undefined}
            className={`flex flex-col gap-1 px-3 py-2 ${day === today ? "bg-lit" : ""}`}
          >
            <span className={`text-secondary ${day === today ? "font-bold" : "text-ink-soft"}`}>
              {shortDate(day)}
              {day === today ? " · today" : ""}
            </span>
            {slots.map((slot) => {
              const entry = entries.find((e) => e.day === day && e.slot === slot);
              const cook = members.find((m) => m.id === entry?.member_id);
              return entry ? (
                <button
                  key={slot}
                  type="button"
                  onClick={() => {
                    setPanel({ kind: "meal", entry });
                  }}
                  className="press-row flex min-h-11 items-center justify-between gap-3 rounded-chip px-1 text-left"
                >
                  <span className="text-body font-semibold">
                    {slots.length > 1 ? `${SLOT_WORDS[slot]}: ` : ""}
                    {mealName(entry)}
                  </span>
                  {cook ? <span className="text-secondary text-ink-soft">{cook.name}</span> : null}
                </button>
              ) : (
                <button
                  key={slot}
                  type="button"
                  onClick={() => {
                    setPanel({ kind: "add", day, slot });
                  }}
                  className="press-row flex min-h-11 items-center gap-2 rounded-chip px-1 text-left text-body font-semibold text-ink-soft"
                >
                  <Plus aria-hidden="true" className="size-5" />
                  Add {SLOT_WORDS[slot].toLowerCase()}
                  <span className="sr-only"> on {shortDate(day)}</span>
                </button>
              );
            })}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Button
          variant="secondary"
          block
          pending={changes.copyWeek.isPending}
          onClick={() => {
            changes.copyWeek.mutate({ from: addDays(start, -7), to: start });
          }}
        >
          Copy last week
        </Button>
      </div>
      <MealSidePanel
        panel={panel}
        days={days}
        onPanel={setPanel}
        onClose={() => {
          setPanel(null);
        }}
      />
    </Screen>
  );
}
