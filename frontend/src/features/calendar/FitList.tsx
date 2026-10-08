import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

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
      const space = node.clientHeight;
      const children = Array.from(copy.children) as HTMLElement[];
      const more = children.at(-1);
      const cells = children.slice(0, -1);
      let count = 0;
      for (const cell of cells) {
        if (cell.offsetTop + cell.offsetHeight > space) break;
        count += 1;
      }
      if (count < cells.length && more) {
        // "+N more" takes the place of the first item left out: give up items until it fits.
        while (count > 0 && (cells[count]?.offsetTop ?? 0) + more.offsetHeight > space) count -= 1;
      }
      setFits(count);
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
