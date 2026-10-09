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
 */
export function fitCount(
  cells: readonly Box[],
  more: { width: number; height: number },
  space: number,
  flow: Flow,
): number {
  let count = 0;
  while (count < cells.length && bottomOf(cells[count]) <= space) count += 1;
  if (count === cells.length) return count;
  while (count > 0 && moreBottom(cells, count, more, flow) > space) count -= 1;
  return count;
}

function bottomOf(cell: Box | undefined): number {
  return cell ? cell.top + cell.height : Number.POSITIVE_INFINITY;
}

function moreBottom(
  cells: readonly Box[],
  shown: number,
  more: { width: number; height: number },
  flow: Flow,
): number {
  const last = cells[shown - 1];
  if (!last) return more.height;
  if (flow.row && last.left + last.width + flow.columnGap + more.width <= flow.width) {
    return last.top + more.height;
  }
  // The next line starts under everything on the last item's line.
  let lineBottom = 0;
  for (const cell of cells.slice(0, shown)) {
    if (Math.abs(cell.top - last.top) < 1) {
      lineBottom = Math.max(lineBottom, cell.top + cell.height + cell.marginBottom);
    }
  }
  return lineBottom + flow.rowGap + more.height;
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
  listClassName = "flex flex-col gap-2",
  itemClassName = () => "",
  moreClassName = "",
}: {
  items: readonly T[];
  itemKey: (item: T) => string;
  /** `measuring` is true for the invisible copy: render it without drag handles or focus. */
  render: (item: T, index: number, measuring: boolean) => ReactNode;
  renderMore: (hidden: number) => ReactNode;
  listClassName?: string;
  itemClassName?: (item: T) => string;
  moreClassName?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(items.length);

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
        ),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [items]);

  const hidden = items.length - fits;
  return (
    <div ref={box} className="relative min-h-0 flex-1 overflow-hidden">
      <div className={listClassName}>
        {items.slice(0, fits).map((item, index) => (
          <div key={itemKey(item)} className={itemClassName(item)}>
            {render(item, index, false)}
          </div>
        ))}
        {hidden > 0 ? <div className={moreClassName}>{renderMore(hidden)}</div> : null}
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
        <div className={moreClassName}>{renderMore(items.length)}</div>
      </div>
    </div>
  );
}
