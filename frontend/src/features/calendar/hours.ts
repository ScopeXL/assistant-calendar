/**
 * The Week board's Hours layout (UX §4 "Week board, Hours layout", ADR 0028): how tall an hour
 * is at each zoom, where a chip sits and how much of it shows, how many lanes a day's column
 * holds, where the now line goes and where the grid scrolls to. Pure and unit-tested. Sizes are
 * in rem (`rem` is the root font size in px), so Extra large scales them all.
 *
 * Times are the household's wall time as the API sends it ("2026-10-08T14:30:00").
 */
import type { HoursZoom } from "../../lib/displayState";
import { clusters, type Placed } from "./layout";

export type { HoursZoom };
/** The zoom ladder: the whole day fits the grid at 24h, half of it at 12h, and each step after
 * at least doubles the one before. */
export const ZOOMS: readonly HoursZoom[] = ["24h", "12h", "1h", "15m"];

/** The wall's smallest tap target (UX §1), and a chip with a time row and a title under it. */
export const TAP_REM = 3.5;
export const FULL_CHIP_REM = 4.5;
const TITLE_REM = 1.75;
const TWO_LINES_REM = 6.5;
/** How much of a chip a later one in its column must leave uncovered: 24 px at standard size
 * (WCAG 2.5.8, axe's target-size). */
const UNCOVERED_REM = 1.5;
const LANE_GAP = 8;
const DAY_MINUTES = 24 * 60;

/** Pixels per hour. `gridHeight` is what the grid has under its sticky heads. */
export function pixelsPerHour(zoom: HoursZoom, gridHeight: number, rem: number): number {
  if (zoom === "24h") return gridHeight / 24;
  if (zoom === "12h") return gridHeight / 12;
  const hour = Math.max(2 * FULL_CHIP_REM * rem, gridHeight / 6);
  if (zoom === "1h") return hour; // a 30-minute event gets the full two-line chip
  return Math.max(4 * FULL_CHIP_REM * rem, 2 * hour); // and so does a 15-minute one
}

/** "2026-10-08T15:30:00" → 930. */
export function minuteOfDay(local: string): number {
  return Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
}

export function minutesToPixels(minutes: number, pph: number): number {
  return (minutes / 60) * pph;
}

export interface ChipBox {
  /** Where the chip's button starts. */
  top: number;
  /** The event's true length on the grid (never under 2 px). */
  visible: number;
  /** The button: never shorter than a tap target. */
  height: number;
  /** Where the visible block starts inside the button: 0, unless the button slid up to end at
   * midnight. */
  offset: number;
}

/** Where a timed event sits in its day's column. One that ends at the next midnight ends at
 * 24:00; one too short to tap gets a taller button, which slides up to stay inside the day. */
export function chipBox(occurrence: Placed, day: string, pph: number, rem: number): ChipBox {
  const startLocal = occurrence.start_local ?? `${day}T00:00:00`;
  const endLocal = occurrence.end_local ?? startLocal;
  const start = startLocal.slice(0, 10) < day ? 0 : minuteOfDay(startLocal);
  const end = endLocal.slice(0, 10) > day ? DAY_MINUTES : minuteOfDay(endLocal);
  const at = minutesToPixels(start, pph);
  const visible = Math.max(2, minutesToPixels(end, pph) - at);
  const height = Math.max(visible, TAP_REM * rem);
  const top = Math.max(0, Math.min(at, 24 * pph - height));
  return { top, visible, height, offset: at - top };
}

/** What a chip of that true height can show: a time row and a title (two title lines from
 * 6.5rem), one row with the title and time, one caption line with the title, or only its bar
 * (its accessible name still says everything). */
export type ChipTier = "lines" | "line" | "title" | "bar";

export function chipTier(visible: number, rem: number): { tier: ChipTier; titleLines: 1 | 2 } {
  if (visible >= TWO_LINES_REM * rem) return { tier: "lines", titleLines: 2 };
  if (visible >= FULL_CHIP_REM * rem) return { tier: "lines", titleLines: 1 };
  if (visible >= TAP_REM * rem) return { tier: "line", titleLines: 1 };
  if (visible >= TITLE_REM * rem) return { tier: "title", titleLines: 1 };
  return { tier: "bar", titleLines: 1 };
}

/** How many chips, each at least a tap target wide with 8 px between, fit side by side. */
export function laneCount(columnWidth: number, rem: number, max = 3): number {
  const lanes = Math.floor((columnWidth + LANE_GAP) / (TAP_REM * rem + LANE_GAP));
  return Math.max(1, Math.min(max, lanes));
}

export interface PlacedChip<T> {
  kind: "chip";
  occurrence: T;
  box: ChipBox;
  lane: number;
  lanes: number;
}

/** "+N" in a cluster's last lane when its events outnumber the lanes: it spans the cluster and
 * opens the day. */
export interface MoreLane<T> {
  kind: "more";
  hidden: T[];
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

/**
 * The groups that share a column side by side: events that overlap in time, joined by any that
 * would start less than 1.5rem below the group's last chip. A chip's button is at least a tap
 * target tall, so the next chip may sit on its tail, but never so close that less than 24 px of
 * it stays uncovered.
 */
function hourGroups<T extends Placed>(
  timed: readonly T[],
  day: string,
  pph: number,
  rem: number,
): T[][] {
  const groups: { items: T[]; lastTop: number }[] = [];
  for (const cluster of clusters(timed)) {
    const tops = cluster.items.map((occurrence) => chipBox(occurrence, day, pph, rem).top);
    const previous = groups.at(-1);
    if (previous && Math.min(...tops) - previous.lastTop < UNCOVERED_REM * rem) {
      previous.items.push(...cluster.items);
      previous.lastTop = Math.max(previous.lastTop, ...tops);
    } else {
      groups.push({ items: [...cluster.items], lastTop: Math.max(...tops) });
    }
  }
  return groups.map((group) => group.items);
}

/** A day's timed events in lanes: events that overlap (or start too close to cover less than
 * 24 px of the one before) share the column, in start order; when a group has more than the
 * lanes hold, the last lane says "+N" for the rest. */
export function placeTimed<T extends Placed>(
  timed: readonly T[],
  day: string,
  pph: number,
  rem: number,
  columnWidth: number,
): (PlacedChip<T> | MoreLane<T>)[] {
  const most = laneCount(columnWidth, rem);
  const out: (PlacedChip<T> | MoreLane<T>)[] = [];
  for (const items of hourGroups(timed, day, pph, rem)) {
    const lanes = Math.min(items.length, most);
    const overflow = items.length > lanes;
    const shown = overflow ? items.slice(0, lanes - 1) : items;
    shown.forEach((occurrence, lane) => {
      out.push({ kind: "chip", occurrence, box: chipBox(occurrence, day, pph, rem), lane, lanes });
    });
    if (overflow) {
      const boxes = items.map((occurrence) => chipBox(occurrence, day, pph, rem));
      const top = Math.min(...boxes.map((box) => box.top + box.offset));
      const bottom = Math.max(...boxes.map((box) => box.top + box.offset + box.visible));
      const height = Math.max(bottom - top, TAP_REM * rem);
      out.push({
        kind: "more",
        hidden: items.slice(lanes - 1),
        top: Math.max(0, Math.min(top, 24 * pph - height)),
        height,
        lane: lanes - 1,
        lanes,
      });
    }
  }
  return out;
}

/** A lane's place across its column, 8 px between lanes. */
export function laneStyle(lane: number, lanes: number): { left: string; width: string } {
  return {
    left: `calc(${String(lane)} * (100% + ${String(LANE_GAP)}px) / ${String(lanes)})`,
    width: `calc((100% - ${String((lanes - 1) * LANE_GAP)}px) / ${String(lanes)})`,
  };
}

/** Where today's now line goes in its column; null on any other day. */
export function nowTop(now: string, day: string, pph: number): number | null {
  if (now.slice(0, 10) !== day) return null;
  return minutesToPixels(minuteOfDay(now), pph);
}

function clampScroll(scrollTop: number, fit: number, pph: number): number {
  return Math.max(0, Math.min(scrollTop, 24 * pph - fit));
}

/** Where the grid starts scrolled: at 24h it never scrolls; on this week the now line sits a
 * third of the way down; on another week 7 AM is at the top. */
export function initialScrollTop({
  zoom,
  pph,
  fit,
  now,
  days,
}: {
  zoom: HoursZoom;
  pph: number;
  fit: number;
  now: string;
  days: readonly string[];
}): number {
  if (zoom === "24h") return 0;
  const today = now.slice(0, 10);
  if (days.includes(today)) {
    return clampScroll(minutesToPixels(minuteOfDay(now), pph) - fit / 3, fit, pph);
  }
  return clampScroll(7 * pph, fit, pph);
}

/** After a zoom, the minute that was at the middle of the view stays there. */
export function rescaledScrollTop(
  scrollTop: number,
  fit: number,
  fromPph: number,
  toPph: number,
): number {
  const middle = (scrollTop + fit / 2) / fromPph;
  return clampScroll(middle * toPph - fit / 2, fit, toPph);
}

/** The hours the gutter names: every other one at 24h, every one otherwise; never 0 or 24. */
export function gutterHours(zoom: HoursZoom): number[] {
  const every = zoom === "24h" ? 2 : 1;
  return Array.from({ length: 24 / every - 1 }, (_, n) => (n + 1) * every);
}

/** The faint lines between the hour lines. */
export function gridStepMinutes(zoom: HoursZoom): number {
  if (zoom === "1h") return 30;
  if (zoom === "15m") return 15;
  return 60;
}

/** The minute a tap at `y` on a day's column means, to the nearest `step` (a new event starts
 * there), never before midnight or at the next one. */
export function minutesAtY(y: number, pph: number, step = 15): number {
  const minutes = Math.round((y / pph) * (60 / step)) * step;
  return Math.max(0, Math.min(DAY_MINUTES - step, minutes));
}
