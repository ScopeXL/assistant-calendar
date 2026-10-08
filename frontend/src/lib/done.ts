/**
 * The signature moment, Done (UX §7, §9), played on a row once the box is ticked: the row is
 * pressed into the wall (the `stamp` class, styles/motion.css), the burst rises from the box in
 * the person's color (ui/Celebration), and the pop sounds if the wall screen's Sounds are on.
 * The box's own fill and check are TickBox's. With Reduce Motion the stamp is instant and
 * nothing bursts.
 */
import { celebrate, type BurstSize } from "../ui/Celebration";
import { pop } from "./sound";

export function playDone({
  row,
  box,
  person,
  size = "row",
  sound = false,
}: {
  row: HTMLElement | null;
  box: Element | null;
  /** The person's color name, or "everyone". */
  person: string;
  size?: BurstSize;
  sound?: boolean;
}): void {
  if (row) {
    // Replays even when the row was stamped a moment ago.
    row.classList.remove("stamp");
    void row.getBoundingClientRect();
    row.classList.add("stamp");
  }
  celebrate(box, person, size);
  if (sound) pop();
}
