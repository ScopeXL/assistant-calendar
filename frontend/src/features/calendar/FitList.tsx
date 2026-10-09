import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Where an item of the invisible copy landed (px, inside the list). */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
  marginBottom: number;
}

/** How the list lays its items out: one per line (a column), or wrapping across (a row). */
export interface Flow {
  row: boolean;
  width: number;
  rowGap: number;
  columnGap: number;
}

/**
 * How many items to show, the rest behind "+N more" (pure, for FitList): every item shown ends
 * inside `space`, and when some are left out, "+N more" does too, where it would really land:
 * right after the last item shown, beside it if its line has room, else on the next line.
 * `pinned` (an index, or -1) always shows, after the items shown when it would be among the
 * hidden ones, and is never counted as hidden: the board's now line.
 */
export function fitCount(
  cells: readonly Box[],
  more: { width: number; height: number },
  space: number,
  flow: Flow,
  pinned = -1,
): number {
  let natural = 0;
  while (natural < cells.length && bottomOf(cells[natural]) <= space) natural += 1;
  if (natural === cells.length) return natural;
  for (let shown = natural; shown > 0; shown -= 1) {
    if (fitsWith(shown)) return shown;
  }
  return 0;

  function fitsWith(shown: number): boolean {
    let sequence = cells.slice(0, shown);
    const pin = cells[pinned];
    if (pin && pinned >= shown) {
      const box = placeAfter(sequence, pin, flow);
      if (bottomOf(box) > space) return false;
      sequence = [...sequence, box];
    }
    const hidden = cells.length - shown - (pin && pinned >= shown ? 1 : 0);
    if (hidden <= 0) return true;
    return bottomOf(placeAfter(sequence, { ...more, marginBottom: 0 }, flow)) <= space;
  }
}

function bottomOf(cell: Box | undefined): number {
  return cell ? cell.top + cell.height : Number.POSITIVE_INFINITY;
}

/** Where something that size lands after `sequence`: beside the last item if its line has room,
 * else at the start of the next line, under everything on the last item's line. */
function placeAfter(
  sequence: readonly Box[],
  size: { width: number; height: number; marginBottom: number },
  flow: Flow,
): Box {
  const last = sequence.at(-1);
  const box = { width: size.width, height: size.height, marginBottom: size.marginBottom };
  if (!last) return { ...box, top: 0, left: 0 };
  const left = last.left + last.width + flow.columnGap;
  if (flow.row && left + size.width <= flow.width) return { ...box, top: last.top, left };
  let lineBottom = 0;
  for (const cell of sequence) {
    if (Math.abs(cell.top - last.top) < 1) {
      lineBottom = Math.max(lineBottom, cell.top + cell.height + cell.marginBottom);
    }
  }
  return { ...box, top: lineBottom + flow.rowGap, left: 0 };
}

function boxOf(element: HTMLElement): Box {
  return {
    top: element.offsetTop,
    left: element.offsetLeft,
    width: element.offsetWidth,
    height: element.offsetHeight,
    marginBottom: Number.parseFloat(getComputedStyle(element).marginBottom) || 0,
  };
}

/**
 * As many items as fit in the space, then "+N more" (UX §4: a day column shows its chips until
 * they don't fit, and the last one opens the Day view). It lays out an invisible copy of the
 * whole list the same way and counts the items whose bottom edge is inside, so it works for a
 * column and for a wrapping row alike, and the visible list never flickers between counts.
 */
export function FitList<T>({
  items,
  itemKey,
  render,
  renderMore,
  pinned = () => false,
  listClassName = "flex flex-col gap-2",
  itemClassName = () => "",
  moreClassName = "",
}: {
  items: readonly T[];
  itemKey: (item: T) => string;
  /** `measuring` is true for the invisible copy: render it without drag handles or focus. */
  render: (item: T, index: number, measuring: boolean) => ReactNode;
  /** "+N more" for the items left out. */
  renderMore: (hidden: readonly T[]) => ReactNode;
  /** The one item that always shows (the now line): never left out, never counted. */
  pinned?: (item: T) => boolean;
  listClassName?: string;
  itemClassName?: (item: T) => string;
  moreClassName?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(items.length);
  const pinnedIndex = items.findIndex(pinned);

  useLayoutEffect(() => {
    const node = box.current;
    const copy = measure.current;
    if (!node || !copy) return;
    const update = () => {
      const children = Array.from(copy.children) as HTMLElement[];
      const more = children.at(-1);
      const style = getComputedStyle(copy);
      setFits(
        fitCount(
          children.slice(0, -1).map(boxOf),
          { width: more?.offsetWidth ?? 0, height: more?.offsetHeight ?? 0 },
          node.clientHeight,
          {
            row: style.flexDirection === "row",
            width: copy.clientWidth,
            rowGap: Number.parseFloat(style.rowGap) || 0,
            columnGap: Number.parseFloat(style.columnGap) || 0,
          },
          pinnedIndex,
        ),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [items, pinnedIndex]);

  const shown = items.slice(0, fits);
  const pin = pinnedIndex >= fits ? items[pinnedIndex] : undefined;
  if (pin !== undefined) shown.push(pin);
  const hidden = items.filter((_, index) => index >= fits && index !== pinnedIndex);
  return (
    <div ref={box} className="relative min-h-0 flex-1 overflow-hidden">
      <div className={listClassName}>
        {shown.map((item, index) => (
          <div key={itemKey(item)} className={itemClassName(item)}>
            {render(item, index, false)}
          </div>
        ))}
        {hidden.length > 0 ? <div className={moreClassName}>{renderMore(hidden)}</div> : null}
      </div>
      <div
        ref={measure}
        aria-hidden="true"
        inert
        className={`pointer-events-none invisible absolute inset-x-0 top-0 ${listClassName}`}
      >
        {items.map((item, index) => (
          <div key={itemKey(item)} className={itemClassName(item)}>
            {render(item, index, true)}
          </div>
        ))}
        <div className={moreClassName}>{renderMore(items)}</div>
      </div>
    </div>
  );
}
