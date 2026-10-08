import { Link } from "@tanstack/react-router";
import { CalendarDays, Lock, LockOpen } from "lucide-react";

import {
  clockSuffix,
  formatClock,
  longWeekday,
  monthDay,
  shortWeekday,
  zonedParts,
} from "../lib/dates";
import { useMinute } from "../lib/time";
import { Digits } from "../ui/Digits";

/**
 * The clock and date at the top of the rail, glance-sized (UX §1): weight 800, digits in fixed
 * boxes so it never jiggles, as large as the rail allows. The rail shows no AM/PM, like a wall
 * clock (UX §3); screen readers still hear it. In portrait's Today band (compact) it has room
 * for AM/PM and the full weekday.
 */
export function ClockBlock({ compact = false }: { compact?: boolean }) {
  const now = useMinute();
  const day = zonedParts(now).day;
  const time = formatClock(now);
  const suffix = clockSuffix(now);
  if (compact) {
    return (
      <div className="flex items-baseline gap-4">
        <p className="text-d-clock font-extrabold whitespace-nowrap">
          <Digits value={time} />
          {suffix ? <span className="ml-1 text-d-secondary font-bold">{suffix}</span> : null}
        </p>
        <p className="text-d-secondary font-semibold">
          {longWeekday(day)} {monthDay(day)}
        </p>
      </div>
    );
  }
  return (
    <div className="rail-clock flex flex-col gap-1">
      <p className="rail-clock-time font-extrabold whitespace-nowrap">
        <Digits value={time} spoken={suffix ? `${time} ${suffix}` : time} />
      </p>
      <p className="text-d-secondary font-semibold">
        <span className="block">{shortWeekday(day)}</span>
        <span>{monthDay(day)}</span>
      </p>
    </div>
  );
}

const ROOMS = [{ key: "calendar", label: "Calendar", icon: CalendarDays }] as const;

/**
 * The display's rail (UX §3): clock and date, the rooms in the household's order, and the lock,
 * which opens Settings (behind the PIN when there is one). In portrait it's the bottom bar.
 */
export function Rail({
  home,
  room,
  lock,
  onLock,
}: {
  home: "/display" | "/";
  room: string;
  /** locked: behind the PIN; unlocked: a PIN grant is open; open: no PIN is set. */
  lock: "locked" | "unlocked" | "open";
  onLock: () => void;
}) {
  return (
    <nav
      aria-label="Rooms"
      data-surface=""
      data-segmented=""
      className="flex flex-col bg-surface landscape:h-full landscape:w-[var(--rail-w)] landscape:border-r landscape:border-line portrait:h-28 portrait:flex-row portrait:items-center portrait:border-t portrait:border-line"
    >
      <div className="px-5 pt-6 pb-5 portrait:hidden">
        <ClockBlock />
      </div>
      <ul className="flex flex-col landscape:border-t landscape:border-line portrait:flex-1 portrait:flex-row">
        {ROOMS.map(({ key, label, icon: Icon }) => (
          <li key={key} className="portrait:w-40">
            <Link
              to={home}
              aria-current={room === key ? "page" : undefined}
              className="press-row flex h-24 flex-col items-center justify-center gap-1 text-d-secondary font-semibold text-ink-soft aria-[current=page]:bg-wall aria-[current=page]:text-ink"
            >
              <Icon aria-hidden="true" className="size-9" strokeWidth={2} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex-1 portrait:hidden" />
      <button
        type="button"
        onClick={onLock}
        aria-label="Settings"
        aria-current={room === "settings" ? "page" : undefined}
        className="press-row flex h-24 flex-col items-center justify-center gap-1 text-d-caption font-semibold text-ink-soft aria-[current=page]:bg-wall aria-[current=page]:text-ink landscape:border-t landscape:border-line portrait:w-32"
      >
        {lock === "locked" ? (
          <Lock aria-hidden="true" className="size-9" />
        ) : (
          <LockOpen aria-hidden="true" className="size-9" />
        )}
        <span aria-hidden="true">{lock === "unlocked" ? "Unlocked" : "Settings"}</span>
      </button>
    </nav>
  );
}
