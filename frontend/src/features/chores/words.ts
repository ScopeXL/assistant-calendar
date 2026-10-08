/**
 * What chores say (UX §2, §4 "Chores room"): "by 5:00 PM · ★2 · Mia's turn", "Done by Mia ·
 * 7:42 AM", "2 of 3", "★ 42 · +12 this week · 6 days in a row". Stars are always the star glyph
 * with a number.
 */
import { formatTime, formatWallTime, shortWeekday } from "../../lib/dates";

export interface Named {
  id: string;
  name: string;
}

const nameOf = (people: Named[], id: string | null | undefined) =>
  id ? people.find((person) => person.id === id)?.name : undefined;

/** "17:00" → "5:00 PM" (or "17:00" on a 24-hour household). */
export function clockText(hhmm: string): string {
  return formatWallTime(`2000-01-01T${hhmm}:00`);
}

/** The line under a chore's title. */
export function boxLine(
  box: {
    due_time: string | null;
    points: number;
    since: string | null;
    turn_id: string | null;
    owner_id: string | null;
    completion: { status: string } | null;
  },
  people: Named[],
  stars: boolean,
): string {
  const parts: string[] = [];
  if (box.since) parts.push(`since ${shortWeekday(box.since)}`);
  if (box.due_time && !box.completion) parts.push(`by ${clockText(box.due_time)}`);
  if (stars && box.points > 0) parts.push(`★${String(box.points)}`);
  const turn = nameOf(people, box.turn_id);
  if (turn && !box.completion) parts.push(`${turn}'s turn`);
  return parts.join(" · ");
}

/** A box's spoken name (UX §10): "Feed the dog, Mia, 2 stars, due 5:00 PM"; screen readers
 * add "checkbox, not checked". */
export function boxLabel(
  box: {
    title: string;
    due_time: string | null;
    points: number;
    since: string | null;
    turn_id: string | null;
    owner_id: string | null;
    completion: { member_id: string; completed_at: string; status: string } | null;
  },
  people: Named[],
  stars: boolean,
): string {
  const parts = [box.title];
  const owner = nameOf(people, box.owner_id);
  const turn = nameOf(people, box.turn_id);
  parts.push(owner ?? (turn ? `${turn}'s turn` : "anyone"));
  if (stars && box.points > 0) {
    parts.push(box.points === 1 ? "1 star" : `${String(box.points)} stars`);
  }
  if (box.due_time && !box.completion) parts.push(`due ${clockText(box.due_time)}`);
  if (box.since) parts.push(`since ${shortWeekday(box.since)}`);
  if (box.completion) parts.push(doneLine(box.completion, people));
  return parts.join(", ");
}

/** "Done by Mia · 7:42 AM", or "Mia says it's done · 7:42 AM" while a parent hasn't checked. */
export function doneLine(
  completion: { member_id: string; completed_at: string; status: string },
  people: Named[],
): string {
  const who = nameOf(people, completion.member_id) ?? "someone";
  const at = formatTime(new Date(completion.completed_at));
  return completion.status === "pending"
    ? `${who} says it's done · waiting for a parent`
    : `Done by ${who} · ${at}`;
}

/** "2 of 3" (UX §2: never "2/3"). */
export function countText(done: number, total: number): string {
  return `${String(done)} of ${String(total)}`;
}

/** "★ 42 · +12 this week · 6 days in a row"; a broken streak just says 0 (UX §10). */
export function starsLine(stars: { balance: number; week: number; streak: number }): string {
  const days = stars.streak === 1 ? "1 day in a row" : `${String(stars.streak)} days in a row`;
  const week = stars.week > 0 ? ` · +${String(stars.week)} this week` : "";
  return `★ ${String(stars.balance)}${week} · ${days}`;
}

/** "All done, Mia!", or "All done!" for Anyone's chores. */
export function allDoneText(name: string | null): string {
  return name ? `All done, ${name}!` : "All done!";
}

/** "Leo's bedtime routine" unless its title already says whose it is. */
export function routineTitle(title: string, name: string | undefined): string {
  if (!name || title.toLowerCase().startsWith(name.toLowerCase())) return title;
  return `${name}'s ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
}
