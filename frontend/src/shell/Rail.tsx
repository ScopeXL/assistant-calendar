import { Link } from "@tanstack/react-router";
import { CalendarDays, Lock, LockOpen, Plus, type LucideIcon } from "lucide-react";

export interface RailRoom {
  key: string;
  label: string;
  icon: LucideIcon;
}

const ROOM_LINK =
  "press-row flex flex-col items-center justify-center gap-1 text-d-secondary font-semibold text-ink-soft aria-[current=page]:bg-wall aria-[current=page]:text-ink portrait:h-24 landscape:min-h-0 landscape:flex-1";
// A room is 6rem tall, and gives way down to a tap target (3.5rem) when the screen is short
// (Extra large text, a laptop), so Add and the lock always stay on screen.
const ROOM_ITEM =
  "portrait:max-w-40 portrait:min-w-0 portrait:flex-1 landscape:flex landscape:min-h-tap landscape:flex-[0_1_6rem] landscape:flex-col";

/**
 * The display's rail (UX §3): the Calendar room then each enabled plugin's (Lists, Tasks…), Add,
 * and the lock, which opens Settings (behind the PIN when there is one). The clock, date and
 * weather are in the header (shell/Header). In portrait it's the bottom bar.
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
  return (
    <nav
      aria-label="Rooms"
      data-surface=""
      data-segmented=""
      className="flex flex-col bg-surface landscape:h-full landscape:w-[var(--rail-w)] landscape:border-r landscape:border-line portrait:h-28 portrait:flex-row portrait:items-center portrait:border-t portrait:border-line"
    >
      <ul className="flex flex-col landscape:min-h-0 portrait:flex-1 portrait:flex-row">
        <li className={ROOM_ITEM}>
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
          <li key={key} className={ROOM_ITEM}>
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
