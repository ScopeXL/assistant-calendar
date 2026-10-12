/**
 * How big the cells of a one-line row can be (the Who picker, UX §4): the largest of `cells`
 * (px, biggest first) at which `count` of them fit `width` with `gap` between, or the smallest
 * with `scroll` when even that doesn't fit and the row must scroll sideways. A width of 0 means
 * "not measured yet" (a closed sheet): the largest, no scrolling, until a real width arrives.
 */
export function fitRow(
  width: number,
  count: number,
  cells: readonly number[],
  gap: number,
): { cell: number; scroll: boolean } {
  const largest = cells[0] ?? 0;
  const smallest = cells[cells.length - 1] ?? largest;
  if (width <= 0 || count <= 0) return { cell: largest, scroll: false };
  for (const cell of cells) {
    if (count * cell + (count - 1) * gap <= width) return { cell, scroll: false };
  }
  return { cell: smallest, scroll: true };
}
