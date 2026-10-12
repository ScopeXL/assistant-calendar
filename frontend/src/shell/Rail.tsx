import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Brand } from "../ui/Brand";
import { Button } from "../ui/Button";

export interface RailRoom {
  key: string;
  label: string;
  icon: LucideIcon;
}

const ROOM_LINK =
  "press-row flex flex-col items-center justify-center gap-1 text-d-secondary font-semibold text-ink-soft aria-[current=page]:bg-wall aria-[current=page]:text-ink portrait:h-24 landscape:min-h-0 landscape:flex-1";
// A room is 6rem tall, and gives way down to a tap target when the screen is short (Extra large
// text, a laptop), so Add and Settings always stay on screen. Folded, it's a 4.5rem square.
const ROOM_ITEM =
  "portrait:max-w-40 portrait:min-w-0 portrait:flex-1 landscape:flex landscape:min-h-tap landscape:flex-col";

/**
 * The display's rail (UX §3, ADR 0029): the Sunroom mark and Hide the rail at its top, the
 * Calendar room then each enabled plugin's (Lists, Tasks…), Add, and Settings: a gear, or a
 * padlock while Settings are locked behind the PIN on a paired screen. `compact` folds it to its
 * icons (never away): every room, Add and Settings stay one tap off, and Show the rail opens it
 * back out. The clock, date and weather are in the header (shell/Header). In portrait it's the
 * bottom bar, always with its words.
 */
export function Rail({
  home,
  room,
  rooms,
  lock,
  compact,
  side,
  settled,
  onFold,
  onAdd,
  onLock,
}: {
  home: "/display" | "/";
  room: string;
  /** The plugins' rooms, in their order (the Calendar room comes first, always). */
  rooms: RailRoom[];
  /** locked: behind the PIN; unlocked: a PIN grant is open; open: no PIN is set. */
  lock: "locked" | "unlocked" | "open";
  /** Only the icons (landscape; the bottom bar keeps its words). */
  compact: boolean;
  side: "left" | "right";
  /** The household's settings have arrived: from the next frame on, a fold may animate. */
  settled: boolean;
  onFold: (compact: boolean) => void;
  onAdd: () => void;
  onLock: () => void;
}) {
  // Never on first paint: a rail that starts folded is simply drawn folded (UX §1).
  const [moves, setMoves] = useState(false);
  useEffect(() => {
    if (!settled) return;
    const frame = requestAnimationFrame(() => {
      setMoves(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [settled]);

  const Fold = compact
    ? side === "right"
      ? PanelRightOpen
      : PanelLeftOpen
    : side === "right"
      ? PanelRightClose
      : PanelLeftClose;
  // In landscape a folded rail keeps each name for screen readers only.
  const word = compact ? "landscape:sr-only" : "";
  const item = `${ROOM_ITEM} ${compact ? "landscape:flex-[0_1_4.5rem]" : "landscape:flex-[0_1_6rem]"}`;
  return (
    <nav
      aria-label="Rooms"
      data-surface=""
      data-segmented=""
      data-rail-motion={moves ? "" : undefined}
      className="flex flex-col bg-surface landscape:h-full landscape:w-[var(--rail-w)] landscape:overflow-clip landscape:border-r landscape:border-line portrait:h-28 portrait:flex-row portrait:items-center portrait:border-t portrait:border-line"
    >
      <div
        className={`flex portrait:hidden ${
          compact
            ? "flex-col items-center gap-2 px-2 pt-4 pb-3"
            : "items-start justify-between gap-2 pt-4 pr-2 pb-3 pl-4"
        }`}
      >
        <Brand size="rail" markOnly={compact} />
        <Button
          variant="quiet"
          icon
          aria-expanded={!compact}
          aria-label={compact ? "Show the rail" : "Hide the rail"}
          onClick={() => {
            onFold(!compact);
          }}
        >
          <Fold aria-hidden="true" className="size-8 text-ink-soft" />
        </Button>
      </div>
      <ul className="flex flex-col landscape:min-h-0 landscape:border-t landscape:border-line portrait:flex-1 portrait:flex-row">
        <li className={item}>
          <Link
            to={home}
            aria-current={room === "calendar" ? "page" : undefined}
            className={ROOM_LINK}
          >
            <CalendarDays aria-hidden="true" className="size-9 shrink-0" strokeWidth={2} />
            <span className={word}>Calendar</span>
          </Link>
        </li>
        {rooms.map(({ key, label, icon: Icon }) => (
          <li key={key} className={item}>
            <Link
              to="/$room"
              params={{ room: key }}
              aria-current={room === key ? "page" : undefined}
              className={ROOM_LINK}
            >
              <Icon aria-hidden="true" className="size-9 shrink-0" strokeWidth={2} />
              <span className={word}>{label}</span>
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
          <span className={word}>Add</span>
        </button>
      </div>
      <button
        type="button"
        onClick={onLock}
        aria-label="Settings"
        aria-current={room === "settings" ? "page" : undefined}
        data-icon={lock === "locked" ? "lock" : "gear"}
        className={`press-row flex flex-col items-center justify-center gap-1 text-d-caption font-semibold text-ink-soft aria-[current=page]:bg-wall aria-[current=page]:text-ink landscape:border-t landscape:border-line portrait:h-24 portrait:w-32 ${
          compact ? "landscape:h-18" : "landscape:h-24"
        }`}
      >
        {lock === "locked" ? (
          <Lock aria-hidden="true" className="size-9 shrink-0" />
        ) : (
          <Settings aria-hidden="true" className="size-9 shrink-0" />
        )}
        <span aria-hidden="true" className={word}>
          {lock === "unlocked" ? "Unlocked" : "Settings"}
        </span>
      </button>
    </nav>
  );
}
