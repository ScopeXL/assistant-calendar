import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRef, useState, type ComponentType, type ReactNode } from "react";

import { dayNumber, formatWallTime, shortWeekday } from "../../lib/dates";
import type { Member } from "../../lib/household";
import { useDayHeaders } from "../usePluginModules";
import { EventChip } from "./EventChip";
import { FitList } from "./FitList";
import { byDay, nowSlot, shownFor, type DayEntry } from "./layout";
import type { Occurrence } from "./types";

const LONG_PRESS_MS = 400;
// Portrait (UX §3): days are rows, chips 224 px wide in lines across, the now line a divider.
// Lines are spaced by each cell's margin, not a row gap, so the all-day band's line break adds
// no height of its own.
const PORTRAIT_ROW = "portrait:flex-row portrait:flex-wrap portrait:content-start portrait:gap-y-0";
const PORTRAIT_CELL = "portrait:w-56 portrait:mb-2";

export interface WeekViewProps {
  days: string[];
  today: string;
  now: string;
  occurrences: Occurrence[];
  members: Member[];
  dimPast: boolean;
  people: string[];
  onOpen: (occurrence: Occurrence) => void;
  onAdd: (day: string) => void;
  onMore: (day: string) => void;
  onMove: (occurrence: Occurrence, toDay: string) => void;
  onSwipe: (step: -1 | 1) => void;
  onDragging: (dragging: boolean) => void;
  /** The day the open editor is adding to, lit behind the panel (UX §6). */
  lit?: string | null;
}

/**
 * The week board (UX §4): a column per day (a row in portrait), the all-day band on top, chips
 * in time order, "+N more" when they don't fit, and today's now line under the last finished
 * chip. Long-press a chip to drag it to another day; swipe sideways for the next week. Every
 * gesture has a button twin (Move in the event sheet; the arrows in the header).
 */
export function WeekView(props: WeekViewProps) {
  const { days, occurrences, onMove, onDragging, onSwipe } = props;
  const columns = byDay(occurrences, days);
  const marks = useDayHeaders();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 } }),
  );
  const [lifted, setLifted] = useState<Occurrence | null>(null);
  const swipe = useRef<{ x: number; y: number; at: number } | null>(null);

  const start = (event: DragStartEvent) => {
    const occurrence = (event.active.data.current as { occurrence?: Occurrence } | undefined)
      ?.occurrence;
    setLifted(occurrence ?? null);
    onDragging(true);
  };
  const end = (event: DragEndEvent) => {
    const data = event.active.data.current as { occurrence?: Occurrence; day?: string } | undefined;
    setLifted(null);
    onDragging(false);
    const to = event.over?.id;
    if (data?.occurrence && typeof to === "string" && to !== data.day) onMove(data.occurrence, to);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={start}
      onDragEnd={end}
      onDragCancel={() => {
        setLifted(null);
        onDragging(false);
      }}
    >
      <div
        className="grid min-h-0 flex-1 grid-cols-7 border-t border-line portrait:grid-cols-1 portrait:grid-rows-7"
        onPointerDown={(event) => {
          swipe.current = { x: event.clientX, y: event.clientY, at: event.timeStamp };
        }}
        onPointerUp={(event) => {
          const from = swipe.current;
          swipe.current = null;
          if (!from || lifted) return;
          const dx = event.clientX - from.x;
          const dy = event.clientY - from.y;
          if (Math.abs(dx) > 120 && Math.abs(dy) < 60 && event.timeStamp - from.at < 700) {
            onSwipe(dx < 0 ? 1 : -1);
          }
        }}
      >
        {days.map((day) => (
          <DayColumn
            key={day}
            {...props}
            day={day}
            column={columns.get(day)}
            lifted={lifted}
            marks={marks}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {lifted ? (
          <div className="scale-[1.04] rounded-chip-d shadow-[0_8px_24px_rgb(0_0_0/0.22)]">
            <EventChip
              occurrence={lifted}
              members={props.members}
              now={props.now}
              dimPast={false}
              onOpen={() => undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DayColumn({
  day,
  today,
  now,
  column,
  members,
  dimPast,
  people,
  lifted,
  lit = null,
  marks,
  onOpen,
  onAdd,
  onMore,
}: WeekViewProps & {
  day: string;
  column: { allDay: DayEntry<Occurrence>[]; timed: DayEntry<Occurrence>[] } | undefined;
  lifted: Occurrence | null;
  /** The plugins' marks for the day's header (its weather). */
  marks: ComponentType<{ day: string }>[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const isToday = day === today;
  const timed = column?.timed ?? [];
  const allDay = column?.allDay ?? [];
  const slot = isToday ? nowSlot(timed, now) : -1;
  const filter = new Set(people);
  // One list, so whatever doesn't fit becomes "+N more" and nothing is lost off the end (UX §4):
  // the all-day band on top in compact chips, then the timed ones, with today's now line under
  // the last finished one. In portrait the band keeps a line of its own.
  type Row =
    | { kind: "chip"; entry: DayEntry<Occurrence>; allDay: boolean }
    | { kind: "now" }
    | { kind: "break" };
  const rows: Row[] = allDay.map((entry): Row => ({ kind: "chip", entry, allDay: true }));
  if (allDay.length && (timed.length || isToday)) rows.push({ kind: "break" });
  const firstTimed = rows.length;
  rows.push(...timed.map((entry): Row => ({ kind: "chip", entry, allDay: false })));
  if (isToday) rows.splice(firstTimed + slot, 0, { kind: "now" });
  // "+N more" counts events, not the band's line break or the now line.
  const hiddenEvents = (hidden: number) =>
    rows.slice(rows.length - hidden).filter((row) => row.kind === "chip").length;

  const chip = (entry: DayEntry<Occurrence>, compact: boolean, measuring: boolean) => {
    const faded = !shownFor(entry.occurrence, filter);
    const content = (
      <EventChip
        occurrence={entry.occurrence}
        members={members}
        now={now}
        dimPast={dimPast && isToday}
        continues={entry.continues}
        compact={compact}
        day={day}
        measuring={measuring}
        onOpen={() => {
          onOpen(entry.occurrence);
        }}
      />
    );
    if (measuring) return content;
    return (
      <Draggable entry={entry} day={day} faded={faded} lifted={lifted}>
        {content}
      </Draggable>
    );
  };

  return (
    <div
      ref={setNodeRef}
      data-day={day}
      data-today={isToday ? "" : undefined}
      aria-current={isToday ? "date" : undefined}
      className={`day-column flex min-h-0 min-w-0 flex-col border-l border-line first:border-l-0 portrait:flex-row portrait:border-t portrait:border-l-0 portrait:first:border-t-0 ${
        isOver || lit === day ? "bg-sun/15" : isToday ? "bg-lit" : ""
      }`}
    >
      <h2
        className={`day-head flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 pt-4 pb-3 text-d-title portrait:w-40 portrait:shrink-0 portrait:flex-col portrait:gap-0 ${
          isToday ? "font-bold" : "font-semibold text-ink-soft"
        }`}
      >
        <span>{shortWeekday(day)}</span>
        {isToday ? (
          <span className="inline-flex h-[1.35em] min-w-[1.35em] shrink-0 items-center justify-center rounded-full bg-sun px-[0.15em] text-on-sun">
            {dayNumber(day)}
          </span>
        ) : (
          <span>{dayNumber(day)}</span>
        )}
        {isToday ? <span className="sr-only">today</span> : null}
        {marks.map((Mark, index) => (
          <Mark key={index} day={day} />
        ))}
      </h2>
      {/* A tap on empty space adds an event on this day: a shortcut for Add in the rail. */}
      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 px-2 pb-2 portrait:py-2"
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest("button, [data-chip]")) onAdd(day);
        }}
      >
        <FitList
          items={rows}
          itemKey={(row) => (row.kind === "chip" ? row.entry.occurrence.key : row.kind)}
          render={(row, _index, measuring) =>
            row.kind === "now" ? (
              <NowLine now={now} />
            ) : row.kind === "chip" ? (
              chip(row.entry, row.allDay, measuring)
            ) : null
          }
          renderMore={(hidden) =>
            hiddenEvents(hidden) ? (
              <MoreButton count={hiddenEvents(hidden)} day={day} onMore={onMore} />
            ) : null
          }
          listClassName={`flex flex-col gap-2 ${PORTRAIT_ROW}`}
          itemClassName={(row) =>
            row.kind === "now"
              ? "portrait:mb-2 portrait:self-stretch"
              : row.kind === "break"
                ? "hidden portrait:block portrait:basis-full"
                : PORTRAIT_CELL
          }
          moreClassName="portrait:mb-2"
        />
      </div>
    </div>
  );
}

function Draggable({
  entry,
  day,
  faded,
  lifted,
  children,
}: {
  entry: DayEntry<Occurrence>;
  day: string;
  faded: boolean;
  lifted: Occurrence | null;
  children: ReactNode;
}) {
  const fixed = entry.occurrence.read_only || entry.occurrence.overlay !== null;
  const { setNodeRef, listeners, attributes } = useDraggable({
    id: `${entry.occurrence.key}|${day}`,
    data: { occurrence: entry.occurrence, day },
    disabled: fixed,
  });
  const origin = lifted?.key === entry.occurrence.key;
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      // The chip inside is the control: dnd-kit's attributes would make this box a second one,
      // and its aria-disabled (on what can't move) would mark the chip itself unavailable.
      role={undefined}
      tabIndex={undefined}
      aria-roledescription={undefined}
      aria-describedby={undefined}
      aria-disabled={undefined}
      className={`rounded-chip-d ${faded ? "opacity-30" : ""} ${
        origin ? "opacity-50 outline-2 outline-ink-soft outline-dashed" : ""
      }`}
    >
      {children}
    </div>
  );
}

function MoreButton({
  count,
  day,
  onMore,
}: {
  count: number;
  day: string;
  onMore: (day: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onMore(day);
      }}
      // In portrait's rows it's only as wide as its words, so another chip fits on its line.
      className="press min-h-14 w-full rounded-chip-d px-3 text-left text-d-secondary font-semibold whitespace-nowrap text-ink-soft portrait:w-auto portrait:px-5"
    >
      {`+${String(count)} more`}
    </button>
  );
}

/** "now 9:41" and a 2 px amber line (UX §4), under the last finished chip. */
function NowLine({ now }: { now: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-1 px-1 py-1 portrait:flex-row-reverse portrait:items-center portrait:justify-end portrait:gap-2 portrait:self-stretch portrait:py-3"
    >
      <span className="now-label font-semibold whitespace-nowrap text-sun-ink">
        now {formatWallTime(now).replace(/ [AP]M$/, "")}
      </span>
      <span className="now-glow h-0.5 w-full rounded-full bg-sun-ink portrait:h-auto portrait:w-0.5 portrait:self-stretch" />
    </div>
  );
}
