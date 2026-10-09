import { useDroppable } from "@dnd-kit/core";
import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type MouseEvent,
} from "react";

import { dayNumber, formatWallTime, longWeekday, shortWeekday } from "../../lib/dates";
import type { Member } from "../../lib/household";
import { Draggable, MoreButton } from "./Draggable";
import { EventChip, PeopleMarks, chipTone, occurrenceLabel, peopleOf } from "./EventChip";
import {
  chipTier,
  gridStepMinutes,
  gutterHours,
  initialScrollTop,
  laneStyle,
  minutesAtY,
  nowTop,
  pixelsPerHour,
  placeTimed,
  rescaledScrollTop,
  type ChipBox,
  type HoursZoom,
} from "./hours";
import { shownFor, type DayColumn, type DayEntry } from "./layout";
import type { Occurrence } from "./types";

const BAND_CHIPS = 3;

export interface HoursGridProps {
  days: string[];
  today: string;
  now: string;
  columns: Map<string, DayColumn<Occurrence>>;
  members: Member[];
  dimPast: boolean;
  people: string[];
  zoom: HoursZoom;
  lifted: Occurrence | null;
  lit: string | null;
  /** The plugins' marks for each day's header (its weather). */
  marks: ComponentType<{ day: string }>[];
  onOpen: (occurrence: Occurrence) => void;
  onAdd: (day: string, hour: number, minute: number) => void;
  onMore: (day: string) => void;
}

interface Measure {
  /** What the grid has under the sticky heads. */
  fit: number;
  /** The heads' height, kept clear when a focused chip scrolls into view. */
  head: number;
  /** A day's column. */
  width: number;
  /** The root font size: the Text size setting. */
  rem: number;
}

/**
 * The Week board's Hours layout (UX §4 "Week board, Hours layout", ADR 0028): each day from
 * midnight to midnight, events placed by their time and as tall as they last, the now line
 * creeping down today. At 24h the whole day fits and nothing scrolls; the other zooms scroll,
 * with a visible scrollbar. Each day's head (its name, then its all-day events) stays on top.
 * A tap on an empty spot adds an event there; a long press lifts a chip to another day.
 */
export function HoursGrid(props: HoursGridProps) {
  const { days, today, now, zoom } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const corner = useRef<HTMLDivElement>(null);
  const [measure, setMeasure] = useState<Measure | null>(null);

  useLayoutEffect(() => {
    const node = scroller.current;
    const head = corner.current;
    if (!node || !head) return;
    const update = () => {
      const column = node.querySelector<HTMLElement>("[data-day-body]");
      const next: Measure = {
        fit: Math.max(0, node.clientHeight - head.offsetHeight),
        head: head.offsetHeight,
        width: column?.clientWidth ?? 0,
        rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      };
      setMeasure((current) =>
        current?.fit === next.fit &&
        current.head === next.head &&
        current.width === next.width &&
        current.rem === next.rem
          ? current
          : next,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    observer.observe(head);
    return () => {
      observer.disconnect();
    };
  }, []);

  const pph = measure && measure.fit > 0 ? pixelsPerHour(zoom, measure.fit, measure.rem) : 0;

  // At 24h the grid never scrolls. Zooming in from it starts at now (or 7 AM on another week);
  // between the other zooms the minute in the middle of the view stays there.
  const previous = useRef<{ zoom: HoursZoom; pph: number } | null>(null);
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || !measure || pph <= 0) return;
    const before = previous.current;
    if (!before || before.zoom === "24h" || zoom === "24h") {
      if (before?.zoom !== zoom || before.pph !== pph) {
        node.scrollTop = initialScrollTop({ zoom, pph, fit: measure.fit, now, days });
      }
    } else if (before.pph !== pph) {
      node.scrollTop = rescaledScrollTop(node.scrollTop, measure.fit, before.pph, pph);
    }
    previous.current = { zoom, pph };
  }, [zoom, pph, measure, now, days]);

  const style = {
    "--pph": `${String(pph)}px`,
    "--step": String(gridStepMinutes(zoom)),
    "--grid-h": `${String(24 * pph)}px`,
    scrollPaddingTop: `${String(measure?.head ?? 0)}px`,
  } as CSSProperties;

  return (
    <div
      ref={scroller}
      data-hours=""
      style={style}
      className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain border-t border-line [scrollbar-gutter:stable] [touch-action:pan-y]"
    >
      <div className="grid grid-cols-[6rem_repeat(7,minmax(0,1fr))] grid-rows-[auto_var(--grid-h)]">
        <div className="row-span-2 grid grid-rows-subgrid">
          <div
            ref={corner}
            className="sticky top-0 z-20 flex items-end bg-wall px-3 pb-3 text-d-secondary font-semibold text-ink-soft"
          >
            all day
          </div>
          <div aria-hidden="true" className="relative">
            {pph > 0
              ? gutterHours(zoom, pph, measure?.rem).map((hour) => (
                  <span
                    key={hour}
                    className="absolute right-3 -translate-y-1/2 text-d-secondary whitespace-nowrap text-ink-soft"
                    style={{ top: `${String(hour * pph)}px` }}
                  >
                    {formatWallTime(`2026-01-01T${String(hour).padStart(2, "0")}:00:00`, {
                      compact: true,
                    })}
                  </span>
                ))
              : null}
          </div>
        </div>
        {days.map((day) => (
          <HoursColumn
            key={day}
            {...props}
            day={day}
            isToday={day === today}
            column={props.columns.get(day)}
            pph={pph}
            rem={measure?.rem ?? 16}
            width={measure?.width ?? 0}
          />
        ))}
      </div>
    </div>
  );
}

function HoursColumn({
  day,
  isToday,
  now,
  column,
  members,
  dimPast,
  people,
  zoom,
  lifted,
  lit,
  marks,
  pph,
  rem,
  width,
  onOpen,
  onAdd,
  onMore,
}: HoursGridProps & {
  day: string;
  isToday: boolean;
  column: DayColumn<Occurrence> | undefined;
  pph: number;
  rem: number;
  width: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const filter = new Set(people);
  const allDay = column?.allDay ?? [];
  const timed = column?.timed ?? [];
  const placed =
    pph > 0
      ? placeTimed(
          timed.map((entry) => entry.occurrence),
          day,
          pph,
          rem,
          width,
        )
      : [];
  const entries = new Map(timed.map((entry) => [entry.occurrence.key, entry]));
  const y = pph > 0 ? nowTop(now, day, pph) : null;
  const lighted = isOver || lit === day;

  const add = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, [data-chip]") || pph <= 0) return;
    const at = event.clientY - event.currentTarget.getBoundingClientRect().top;
    const minutes = minutesAtY(at, pph);
    onAdd(day, Math.floor(minutes / 60), minutes % 60);
  };

  return (
    <section
      ref={setNodeRef}
      data-day={day}
      data-today={isToday ? "" : undefined}
      aria-current={isToday ? "date" : undefined}
      // No container here: a container's layout containment would stop it being a subgrid, and
      // the heads and bodies would no longer line up across the days.
      className="row-span-2 grid min-w-0 grid-rows-subgrid border-l border-line"
    >
      {/* Opaque, so the hours slide under it. */}
      <div
        className={`day-column sticky top-0 z-20 flex min-w-0 flex-col ${
          lighted
            ? "bg-[color-mix(in_oklab,var(--color-sun)_15%,var(--color-wall))]"
            : isToday
              ? "bg-lit"
              : "bg-wall"
        }`}
      >
        <h2
          className={`day-head flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 pt-4 pb-3 text-d-title ${
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
        {allDay.length ? (
          <div className="flex flex-col gap-2 px-1 pb-2">
            {allDay.slice(0, BAND_CHIPS).map((entry) => (
              <Draggable
                key={entry.occurrence.key}
                entry={entry}
                day={day}
                faded={!shownFor(entry.occurrence, filter)}
                lifted={lifted}
              >
                <EventChip
                  occurrence={entry.occurrence}
                  members={members}
                  now={now}
                  dimPast={dimPast && isToday}
                  continues={entry.continues}
                  compact
                  day={day}
                  onOpen={() => {
                    onOpen(entry.occurrence);
                  }}
                />
              </Draggable>
            ))}
            {allDay.length > BAND_CHIPS ? (
              <MoreButton count={allDay.length - BAND_CHIPS} day={day} onMore={onMore} />
            ) : null}
          </div>
        ) : null}
      </div>
      {/* A tap on an empty spot adds an event at that time: a shortcut for Add in the rail. */}
      <div
        data-dense=""
        data-day-body=""
        onClick={add}
        className={`hour-lines relative min-w-0 @container ${lighted ? "bg-sun/15" : isToday ? "bg-lit" : ""}`}
      >
        <div className="absolute inset-y-0 inset-x-1">
          {placed.map((item) => {
            if (item.kind === "more") {
              return (
                <button
                  key={`more-${item.hidden[0]?.key ?? ""}`}
                  type="button"
                  onClick={() => {
                    onMore(day);
                  }}
                  className="press absolute rounded-chip-d bg-line/60 px-1 text-center text-d-secondary font-semibold text-ink [touch-action:manipulation]"
                  style={{
                    top: `${String(item.top)}px`,
                    height: `${String(item.height)}px`,
                    ...laneStyle(item.lane, item.lanes),
                  }}
                  aria-label={`${String(item.hidden.length)} more on ${longWeekday(day)}`}
                >
                  {`+${String(item.hidden.length)}`}
                </button>
              );
            }
            const entry = entries.get(item.occurrence.key);
            if (!entry) return null;
            return (
              <Draggable
                key={item.occurrence.key}
                entry={entry}
                day={day}
                faded={!shownFor(item.occurrence, filter)}
                lifted={lifted}
                className="absolute"
                style={{
                  top: `${String(item.box.top)}px`,
                  height: `${String(item.box.height)}px`,
                  ...laneStyle(item.lane, item.lanes),
                }}
              >
                <HoursChip
                  entry={entry}
                  box={item.box}
                  rem={rem}
                  members={members}
                  now={now}
                  dimPast={dimPast && isToday}
                  day={day}
                  onOpen={() => {
                    onOpen(item.occurrence);
                  }}
                />
              </Draggable>
            );
          })}
        </div>
        {y !== null ? <NowMinute key={`${zoom}:${String(pph)}`} y={y} now={now} /> : null}
      </div>
    </section>
  );
}

/**
 * An event on the Hours grid: a button at least a tap target tall, holding the tinted block as
 * tall as the event lasts. What the block shows depends on its height: a time row and the title,
 * one row with both, the title alone, or only the tint (the button's name still says it all).
 */
function HoursChip({
  entry,
  box,
  rem,
  members,
  now,
  dimPast,
  day,
  onOpen,
}: {
  entry: DayEntry<Occurrence>;
  box: ChipBox;
  rem: number;
  members: Member[];
  now: string;
  dimPast: boolean;
  day: string;
  onOpen: () => void;
}) {
  const { occurrence } = entry;
  const people = peopleOf(occurrence, members);
  const tone = chipTone(occurrence, people, now, dimPast, "bg-line/60");
  const { tier, titleLines } = chipTier(box.visible, rem);
  const time = occurrence.start_local ? formatWallTime(occurrence.start_local) : "";
  return (
    <button
      type="button"
      data-chip=""
      data-key={occurrence.key}
      aria-label={occurrenceLabel(occurrence, people, day)}
      onClick={onOpen}
      // A column from the top: a button would center the block in itself, off its time.
      className="press flex h-full w-full flex-col rounded-chip-d text-left [touch-action:manipulation] focus-visible:z-40"
    >
      <span
        data-person={tone.person}
        className={`flex min-w-0 shrink-0 overflow-hidden rounded-chip-d pr-1 ${tone.className} ${
          tier === "lines" ? "flex-col gap-0.5 py-1.5" : "items-center gap-2"
        }`}
        style={{ marginTop: `${String(box.offset)}px`, height: `${String(box.visible)}px` }}
      >
        {tier === "lines" ? (
          <>
            <span className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate text-d-secondary font-semibold @max-[10rem]:hidden">
                {time}
              </span>
              <PeopleMarks people={people} />
            </span>
            <span
              className={`${titleLines === 2 ? "line-clamp-2" : "line-clamp-1"} text-d-body font-semibold break-words`}
            >
              {occurrence.title}
            </span>
          </>
        ) : tier === "line" ? (
          <>
            <span className="min-w-0 flex-1 truncate text-d-body font-semibold">
              {occurrence.title}
            </span>
            <span className="shrink-0 text-d-secondary font-semibold @max-[10rem]:hidden">
              {time}
            </span>
          </>
        ) : tier === "title" ? (
          <span className="min-w-0 flex-1 truncate py-0.5 text-d-caption font-semibold">
            {occurrence.title}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** Today's now line (UX §9): it glides a minute's worth each minute, and with Reduce Motion
 * steps instead. Remounted on a zoom or resize, so it never glides across a change of scale. */
function NowMinute({ y, now }: { y: number; now: string }) {
  return (
    <div
      aria-hidden="true"
      data-now-line=""
      className="now-minute now-glow pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 rounded-full bg-sun-ink"
      style={{ transform: `translateY(${String(y)}px)` }}
    >
      <span
        className={`now-label absolute left-1 rounded-sm bg-lit/90 px-1 font-semibold whitespace-nowrap text-sun-ink ${
          y < 32 ? "top-1.5" : "bottom-1.5"
        }`}
      >
        now {formatWallTime(now).replace(/ [AP]M$/, "")}
      </span>
    </div>
  );
}
