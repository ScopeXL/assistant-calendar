import { Link } from "@tanstack/react-router";
import { CalendarDays, Lock, LockOpen, Plus, type LucideIcon } from "lucide-react";

import {
  clockSuffix,
  formatClock,
  longWeekday,
  monthDay,
  shortWeekday,
  zonedParts,
} from "../lib/dates";
import { useRailBlocks } from "../features/usePluginModules";
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

export interface RailRoom {
  key: string;
  label: string;
  icon: LucideIcon;
}

const ROOM_LINK =
  "press-row flex h-24 flex-col items-center justify-center gap-1 text-d-secondary font-semibold text-ink-soft aria-[current=page]:bg-wall aria-[current=page]:text-ink";

/**
 * The display's rail (UX §3): clock and date, the Calendar room then each enabled plugin's
 * (Lists, Chores…), Add, and the lock, which opens Settings (behind the PIN when there is one).
 * In portrait it's the bottom bar.
 */
export function Rail({
  home,
  room,
  rooms,
  lock,
  onAdd,
  onLock,
}: {
  home: "/display" | "/";
  room: string;
  /** The plugins' rooms, in their order (the Calendar room comes first, always). */
  rooms: RailRoom[];
  /** locked: behind the PIN; unlocked: a PIN grant is open; open: no PIN is set. */
  lock: "locked" | "unlocked" | "open";
  onAdd: () => void;
  onLock: () => void;
}) {
  const blocks = useRailBlocks();
  return (
    <nav
      aria-label="Rooms"
      data-surface=""
      data-segmented=""
      className="flex flex-col bg-surface landscape:h-full landscape:w-[var(--rail-w)] landscape:border-r landscape:border-line portrait:h-28 portrait:flex-row portrait:items-center portrait:border-t portrait:border-line"
    >
      <div className="flex flex-col gap-4 px-5 pt-6 pb-5 portrait:hidden">
        <ClockBlock />
        {blocks.map((Block, index) => (
          <Block key={index} place="rail" />
        ))}
      </div>
      <ul className="flex flex-col landscape:border-t landscape:border-line portrait:flex-1 portrait:flex-row">
        <li className="portrait:max-w-40 portrait:min-w-0 portrait:flex-1">
          <Link
            to={home}
            aria-current={room === "calendar" ? "page" : undefined}
            className={ROOM_LINK}
          >
            <CalendarDays aria-hidden="true" className="size-9" strokeWidth={2} />
            Calendar
          </Link>
        </li>
        {rooms.map(({ key, label, icon: Icon }) => (
          <li key={key} className="portrait:max-w-40 portrait:min-w-0 portrait:flex-1">
            <Link
              to="/$room"
              params={{ room: key }}
              aria-current={room === key ? "page" : undefined}
              className={ROOM_LINK}
            >
              <Icon aria-hidden="true" className="size-9" strokeWidth={2} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex-1 portrait:hidden" />
      <div className="flex justify-center py-4 portrait:px-6">
        <button
          type="button"
          onClick={onAdd}
          className="press flex flex-col items-center gap-1 text-d-caption font-semibold"
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-ink text-wall">
            <Plus aria-hidden="true" className="size-9" strokeWidth={2.5} />
          </span>
          Add
        </button>
      </div>
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
