import { Link } from "@tanstack/react-router";
import { Check, Minus, Star } from "lucide-react";
import { useState } from "react";

import { dayNumber, shortWeekday, weekOf, zonedParts } from "../../lib/dates";
import { updateDisplay } from "../../lib/displayState";
import { useMembers, useSettings } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Segmented } from "../../ui/Segmented";
import { ChoreColumn, personOf, WaitingStrip } from "./ChoreBoard";
import { useChoresDay, useChoresWeek, type Day, type Week } from "./data";
import { RewardsPage } from "./RewardsPage";
import { RoutineRunner } from "./RoutineRunner";
import { countText } from "./words";

const MOST_COLUMNS = 5;

/** The Chores room on the wall screen (UX §4): today in columns, the week, Stars & rewards,
 * and the routine runner. */
export function ChoresRoom({ path }: { path: string[] }) {
  const [page, ...rest] = path;
  if (page === "rewards") return <RewardsPage />;
  if (page === "run") {
    const [routineId, memberId, day] = rest;
    if (routineId && memberId && day) {
      return <RoutineRunner routineId={routineId} memberId={memberId} day={day} />;
    }
  }
  return <ChoresBoard />;
}

function ChoresBoard() {
  const today = zonedParts(useMinute()).day;
  const { data: day, isSuccess } = useChoresDay(today);
  const [mode, setMode] = useState<"today" | "week">("today");
  const add = () => {
    updateDisplay({ panel: { kind: "add", day: null, hour: null, type: "chore" } });
  };
  return (
    <section aria-labelledby="chores-title" className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-6 py-4">
        <h1 id="chores-title" className="text-d-title font-bold">
          {mode === "today" ? "Chores · Today" : "Chores · This week"}
        </h1>
        <Segmented
          label="Show"
          value={mode}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "This week" },
          ]}
          onChange={setMode}
        />
        {day?.stars_on || day?.rewards_on ? (
          <Link
            to="/$room/$"
            params={{ room: "chores", _splat: "rewards" }}
            className="press ml-auto inline-flex min-h-14 items-center gap-2 rounded-button-d border-2 border-line bg-surface px-6 text-d-body font-semibold"
          >
            <Star aria-hidden="true" className="size-7 fill-sun stroke-sun-ink" />
            {day.rewards_on ? "Stars & rewards" : "Stars"}
          </Link>
        ) : null}
      </header>
      {day?.waiting.length ? (
        <div className="px-6 pt-4">
          <WaitingStrip waiting={day.waiting} />
        </div>
      ) : null}
      {isSuccess && day.columns.length === 0 ? (
        <div className="px-6">
          <EmptyState
            message="Chores live here. Give each person a few, and watch them get stamped."
            action={<Button onClick={add}>Add chore</Button>}
          />
        </div>
      ) : mode === "today" && day ? (
        <TodayColumns day={day} />
      ) : day ? (
        <WeekColumns today={today} />
      ) : null}
    </section>
  );
}

function TodayColumns({ day }: { day: Day }) {
  const width = `${String(100 / Math.min(day.columns.length, MOST_COLUMNS))}%`;
  return (
    <div tabIndex={0} className="flex min-h-0 flex-1 snap-x overflow-x-auto">
      {day.columns.map((column) => (
        <div
          key={column.member_id ?? "anyone"}
          className="min-h-0 min-w-[16rem] shrink-0 snap-start overflow-y-auto border-r border-line px-4 py-4"
          style={{ width }}
        >
          <ChoreColumn
            column={column}
            day={day}
            starsOn={day.stars_on}
            stars={day.stars.find((s) => s.member_id === column.member_id)?.balance}
          />
        </div>
      ))}
    </div>
  );
}

/** This week (UX §4): seven compact rows a column, a check or a dash, the fridge-chart feel. */
function WeekColumns({ today }: { today: string }) {
  const { data: settings } = useSettings();
  const { data: members = [] } = useMembers();
  const start = weekOf(today, settings?.week_starts_on ?? 6)[0] ?? today;
  const { data: week } = useChoresWeek(start);
  if (!week) return null;
  const width = `${String(100 / Math.min(week.columns.length, MOST_COLUMNS))}%`;
  return (
    // Focusable, so a keyboard can scroll it sideways when the columns don't fit (portrait).
    <div tabIndex={0} className="flex min-h-0 flex-1 overflow-x-auto">
      {week.columns.map((column) => {
        const person = personOf(members, column.member_id);
        return (
          <section
            key={column.member_id ?? "anyone"}
            aria-label={person ? person.name : "Anyone"}
            data-person={person?.color ?? "everyone"}
            className="min-w-[16rem] shrink-0 overflow-y-auto border-r border-line px-4 py-4"
            style={{ width }}
          >
            <header className="flex items-center gap-3 pb-3">
              <Avatar member={person ?? null} size="lg" />
              <h2 className="text-d-title font-bold">{person ? person.name : "Anyone"}</h2>
            </header>
            <WeekRows column={column} today={today} />
          </section>
        );
      })}
    </div>
  );
}

export function WeekRows({ column, today }: { column: Week["columns"][number]; today: string }) {
  return (
    <ul className="flex flex-col">
      {column.days.map((cell) => {
        const all = cell.total > 0 && cell.done === cell.total;
        return (
          <li
            key={cell.date}
            aria-current={cell.date === today ? "date" : undefined}
            className="flex min-h-16 items-center justify-between gap-3 border-b border-line px-2 aria-[current=date]:bg-surface"
          >
            <span className="text-d-body font-semibold">
              {shortWeekday(cell.date)} {dayNumber(cell.date)}
            </span>
            <span className="flex items-center gap-2 text-d-secondary">
              {cell.total > 0 ? countText(cell.done, cell.total) : null}
              {all ? (
                <Check aria-label="all done" className="size-7 text-p-text" strokeWidth={3} />
              ) : cell.total === 0 || cell.date > today ? (
                <Minus aria-hidden="true" className="size-6 text-ink-soft" />
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
