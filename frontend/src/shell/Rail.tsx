import { Link } from "@tanstack/react-router";
import { CalendarDays, Lock, LockOpen } from "lucide-react";

import { clockSuffix, formatClock, longWeekday, monthDay, zonedParts } from "../lib/dates";
import { useMinute } from "../lib/time";
import { Digits } from "../ui/Digits";

/** The clock and date at the top of the rail (and of the Today band in portrait). Glance-sized
 * (UX §1): the clock is 56 px in weight 800, its digits in fixed boxes so it never jiggles. */
export function ClockBlock({ compact = false }: { compact?: boolean }) {
  const now = useMinute();
  const day = zonedParts(now).day;
  return (
    <div className={compact ? "flex items-baseline gap-4" : "flex flex-col gap-1"}>
      <p className="text-d-clock font-extrabold">
        <Digits value={formatClock(now)} />
        <span className="ml-1 text-d-secondary font-bold">{clockSuffix(now)}</span>
      </p>
      <p className="text-d-secondary font-semibold">
        <span className={compact ? "" : "block"}>{longWeekday(day)}</span>{" "}
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
  unlocked,
  onLock,
}: {
  home: "/display" | "/";
  room: string;
  unlocked: boolean;
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
          <li key={key} className="portrait:flex-1">
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
        {unlocked ? (
          <LockOpen aria-hidden="true" className="size-9" />
        ) : (
          <Lock aria-hidden="true" className="size-9" />
        )}
        <span aria-hidden="true">{unlocked ? "Unlocked" : "Settings"}</span>
      </button>
    </nav>
  );
}
