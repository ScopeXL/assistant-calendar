import { Link, useNavigate } from "@tanstack/react-router";

import { zonedParts } from "../../lib/dates";
import { useMembers } from "../../lib/household";
import { useMinute } from "../../lib/time";
import { Avatar } from "../../ui/Avatar";
import { useShell } from "../../ui/shell";
import { ChoreColumn, personOf, useViewer, WaitingStrip } from "./ChoreBoard";
import { useChoresDay, useRewards, type Column } from "./data";
import { AskedStrip } from "./RewardsPage";
import { countText, routineTitle } from "./words";

/** A small ring that fills as a person's chores get done (UX §3 "Chores today"). */
function Ring({ done, total }: { done: number; total: number }) {
  const display = useShell() === "display";
  const share = total > 0 ? done / total : 0;
  const around = 2 * Math.PI * 9;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`shrink-0 -rotate-90 ${display ? "size-8" : "size-6"}`}
    >
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="4" className="stroke-line" />
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${String(around * share)} ${String(around)}`}
        className="stroke-p"
      />
    </svg>
  );
}

function statusOf(column: Column): string {
  if (column.total === 0) return "nothing today";
  return column.done === column.total ? "all done" : countText(column.done, column.total);
}

/**
 * The Today panel's Chores today (UX §3): a line per person with a ring and "2 of 3", then a
 * routine whose window is open ("Leo's bedtime routine · Start"). A line opens the Chores room.
 */
export function ChoresTodayWall() {
  const today = zonedParts(useMinute()).day;
  const { data: day } = useChoresDay(today);
  const { data: members = [] } = useMembers();
  const navigate = useNavigate();
  if (!day) return null;
  const people = day.columns.filter((c) => c.member_id !== null && c.total > 0);
  const routines = day.columns.flatMap((c) => c.routines.filter((r) => r.open_now && !r.finished));
  if (!people.length && !routines.length) return null;
  return (
    <section aria-labelledby="today-chores" className="flex flex-col gap-2">
      <h2 id="today-chores" className="text-d-body font-bold text-ink-soft">
        Chores today
      </h2>
      {people.map((column) => {
        const person = personOf(members, column.member_id);
        if (!person) return null;
        return (
          <button
            key={person.id}
            type="button"
            data-person={person.color}
            onClick={() => {
              void navigate({ to: "/$room", params: { room: "chores" } });
            }}
            className="press-row -mx-3 flex min-h-16 items-center gap-3 rounded-chip-d px-3 py-2 text-left"
          >
            <span data-points-to={person.id} className="inline-flex shrink-0">
              <Avatar member={person} size="sm" />
            </span>
            <span className="flex-1 text-d-body font-bold">{person.name}</span>
            <span className="text-d-body font-semibold">{statusOf(column)}</span>
            <Ring done={column.done} total={column.total} />
          </button>
        );
      })}
      {routines.map((run) => {
        const kid = personOf(members, run.member_id);
        return (
          <Link
            key={`${run.routine_id}|${run.member_id}`}
            to="/$room/$"
            params={{ room: "chores", _splat: `run/${run.routine_id}/${run.member_id}/${today}` }}
            data-person={kid?.color ?? "everyone"}
            className="press-row -mx-3 flex min-h-16 items-center justify-between gap-3 rounded-chip-d px-3 py-2"
          >
            <span className="text-d-body font-semibold">{routineTitle(run.title, kid?.name)}</span>
            <span className="rounded-full bg-p px-4 py-1 text-d-secondary font-bold text-on-ink">
              {run.checked.length ? "Continue" : "Start"}
            </span>
          </Link>
        );
      })}
    </section>
  );
}

/**
 * Today on a phone (UX §5): the phone's person's chores ("Mia · 2 of 3", See chores), and on a
 * parent's phone what's waiting for them: rewards asked for and chores to check.
 */
export function ChoresTodayPhone() {
  const today = zonedParts(useMinute()).day;
  const { data: day } = useChoresDay(today);
  const { data: members = [] } = useMembers();
  const viewer = useViewer();
  const { data: rewards } = useRewards({ enabled: viewer.answers });
  if (!day) return null;
  const mine = day.columns.find((c) => c.member_id === viewer.memberId && c.member_id !== null);
  const shown = mine ? [mine] : day.columns.filter((c) => c.member_id !== null && c.total > 0);
  const asked = viewer.answers ? (rewards?.asked ?? []) : [];
  if (!shown.length && !asked.length && !day.waiting.length) return null;
  return (
    <section aria-labelledby="phone-chores" className="flex flex-col gap-2">
      <h2 id="phone-chores" className="text-row font-bold text-ink-soft">
        Chores
      </h2>
      {asked.length ? <AskedStrip asked={asked} /> : null}
      {day.waiting.length ? <WaitingStrip waiting={day.waiting} /> : null}
      {shown.map((column) => {
        const person = personOf(members, column.member_id);
        if (!person) return null;
        return (
          <Link
            key={person.id}
            to="/$room"
            params={{ room: "chores" }}
            data-person={person.color}
            className="press-row flex min-h-14 items-center gap-3 rounded-chip px-1"
          >
            <Avatar member={person} size="sm" />
            <span className="flex-1 text-body font-bold">{`${person.name} · ${statusOf(column)}`}</span>
            <span className="text-secondary font-semibold text-ink-soft">See chores</span>
          </Link>
        );
      })}
    </section>
  );
}

/** Who's doing what (UX §4): the person's chores under their events, with working boxes; the
 * Everyone column gets Anyone's. */
export function ChoresPersonColumn({ memberId }: { memberId: string | null; day: string }) {
  const today = zonedParts(useMinute()).day;
  const { data: day } = useChoresDay(today);
  const column = day?.columns.find((c) => c.member_id === memberId);
  if (!day || !column || column.total === 0) return null;
  return (
    <div className="mt-2 border-t border-line pt-2">
      <ChoreColumn
        column={{ ...column, routines: [] }}
        day={day}
        starsOn={day.stars_on}
        header={false}
      />
    </div>
  );
}
