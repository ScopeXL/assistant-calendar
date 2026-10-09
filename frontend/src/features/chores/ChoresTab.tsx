import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

import { weekOf, zonedParts } from "../../lib/dates";
import type { BoardPanel } from "../../lib/displayState";
import { useMembers, useSettings } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Screen } from "../../ui/Screen";
import { Segmented } from "../../ui/Segmented";
import { AddPanel } from "../calendar/AddPanel";
import { ChoreColumn, personOf, useViewer, WaitingStrip } from "./ChoreBoard";
import { useChoresDay, useChoresWeek, useRewards, type Column, type Day } from "./data";
import { AskedStrip, RewardsPage } from "./RewardsPage";
import { RoutineRunner } from "./RoutineRunner";
import { WeekRows } from "./ChoresRoom";
import { allDoneText, countText } from "./words";

/** Chores on a phone (UX §5): Today or This week, Stars & rewards, and the routine runner. */
export function ChoresTab({ path }: { path: string[] }) {
  const [page, ...rest] = path;
  if (page === "rewards") return <RewardsPage />;
  if (page === "run") {
    const [routineId, memberId, day] = rest;
    if (routineId && memberId && day) {
      return <RoutineRunner routineId={routineId} memberId={memberId} day={day} />;
    }
  }
  return <PhoneChores />;
}

function PhoneChores() {
  const today = zonedParts(useMinute()).day;
  const { data: day, isSuccess } = useChoresDay(today);
  const viewer = useViewer();
  const { data: rewards } = useRewards({ enabled: viewer.answers });
  const [mode, setMode] = useState<"today" | "week">("today");
  const [panel, setPanel] = useState<BoardPanel>(null);
  const mine = day?.stars.find((s) => s.member_id === viewer.memberId);
  const { data: members = [] } = useMembers();
  const me = personOf(members, viewer.memberId);
  return (
    <Screen
      title="Chores"
      actions={
        <Button
          block
          onClick={() => {
            setPanel({ kind: "add", day: null, hour: null, type: "chore" });
          }}
        >
          <Plus aria-hidden="true" className="size-5" />
          Add
        </Button>
      }
    >
      <div className="-mt-3 mb-4 flex flex-col gap-3">
        {me && mine && day?.stars_on ? (
          <p className="text-body font-bold">{`★ ${String(mine.balance)} ${me.name}`}</p>
        ) : null}
        <Segmented
          label="Show"
          value={mode}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "This Week" },
          ]}
          onChange={setMode}
        />
      </div>
      <div className="flex flex-col gap-4">
        {rewards?.asked.length && viewer.answers ? <AskedStrip asked={rewards.asked} /> : null}
        {day?.waiting.length ? <WaitingStrip waiting={day.waiting} /> : null}
        {isSuccess && day.columns.length === 0 ? (
          <EmptyState message="Chores live here. Give each person a few, and watch them get stamped." />
        ) : day && mode === "today" ? (
          <Sections day={day} first={viewer.memberId} />
        ) : day ? (
          <PhoneWeek day={day} today={today} />
        ) : null}
        {day && (day.stars_on || day.rewards_on) ? (
          <Link
            to="/$room/$"
            params={{ room: "chores", _splat: "rewards" }}
            className="press-row flex min-h-14 items-center justify-between rounded-chip border border-line bg-surface px-4 text-row font-semibold"
          >
            {day.rewards_on ? "Stars & Rewards" : "Stars"}
            <ChevronRight aria-hidden="true" className="text-ink-soft" />
          </Link>
        ) : null}
      </div>
      <AddPanel
        panel={panel?.kind === "add" ? panel : null}
        today={today}
        room="chores"
        onClose={() => {
          setPanel(null);
        }}
        onType={(type) => {
          setPanel((open) => (open?.kind === "add" ? { ...open, type } : open));
        }}
      />
    </Screen>
  );
}

/** The phone's person first and open; everyone else folded, with how they're doing. */
function Sections({ day, first }: { day: Day; first: string | null }) {
  const ordered = [
    ...day.columns.filter((c) => c.member_id === first && first !== null),
    ...day.columns.filter((c) => c.member_id !== first || first === null),
  ];
  return (
    <div className="flex flex-col gap-3">
      {ordered.map((column, index) => (
        <Section
          key={column.member_id ?? "anyone"}
          column={column}
          day={day}
          open={index === 0 || column.member_id === null}
        />
      ))}
    </div>
  );
}

function Section({
  column,
  day,
  open: initiallyOpen,
}: {
  column: Column;
  day: Day;
  open: boolean;
}) {
  const { data: members = [] } = useMembers();
  const [open, setOpen] = useState(initiallyOpen);
  const person = personOf(members, column.member_id);
  const name = person ? person.name : "Anyone";
  const allDone = column.total > 0 && column.done === column.total;
  const status = allDone
    ? allDoneText(null).toLowerCase().replace("!", "")
    : column.total > 0
      ? countText(column.done, column.total)
      : "nothing today";
  return (
    <section className="rounded-chip border border-line bg-surface px-3 py-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        className="press-row flex min-h-12 w-full items-center gap-2 rounded-button text-left text-row font-bold"
      >
        {open ? (
          <ChevronDown aria-hidden="true" className="size-5" />
        ) : (
          <ChevronRight aria-hidden="true" className="size-5" />
        )}
        {`${name} · ${status}`}
      </button>
      {open ? (
        <ChoreColumn
          column={column}
          day={day}
          starsOn={day.stars_on}
          stars={day.stars.find((s) => s.member_id === column.member_id)?.balance}
          header={false}
        />
      ) : null}
    </section>
  );
}

function PhoneWeek({ day, today }: { day: Day; today: string }) {
  const { data: settings } = useSettings();
  const { data: members = [] } = useMembers();
  const start = weekOf(today, settings?.week_starts_on ?? 6)[0] ?? today;
  const { data: week } = useChoresWeek(start);
  if (!week) return null;
  return (
    <div className="flex flex-col gap-3">
      {week.columns.map((column) => {
        const person = personOf(members, column.member_id);
        return (
          <section
            key={column.member_id ?? "anyone"}
            data-person={person?.color ?? "everyone"}
            className="rounded-chip border border-line bg-surface px-3 py-2"
          >
            <h2 className="py-2 text-row font-bold">{person ? person.name : "Anyone"}</h2>
            <WeekRows column={column} today={today} />
          </section>
        );
      })}
      <span hidden>{day.date}</span>
    </div>
  );
}
