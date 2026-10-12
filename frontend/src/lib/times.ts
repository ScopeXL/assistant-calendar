/** Times of day as "HH:MM", for the editors' time rows (ui/TimeField). */

/** The times an event most often starts at, offered as chips beside All day. */
export const EVENT_TIMES = ["09:00", "12:00", "15:00", "18:00"] as const;

/**
 * The chips a time row shows: its suggestions and the chosen time, in clock order and without
 * repeats, so an odd time ("10:30" from a tap on the Hours grid, or one picked by hand) sits
 * where it belongs and reads as pressed.
 */
export function timeChips(suggestions: readonly string[], value: string | null): string[] {
  const all = new Set(suggestions);
  if (value) all.add(value);
  return [...all].sort();
}

/** "HH:MM" from an hour and the minutes of another time (":00" when there is none). */
export function atHour(hour: number, value: string | null): string {
  return `${String(hour).padStart(2, "0")}:${value ? value.slice(3, 5) : "00"}`;
}

/** "HH:MM" from minutes and the hour of another time (9 AM when there is none). */
export function atMinute(minute: string, value: string | null): string {
  return `${value ? value.slice(0, 2) : "09"}:${minute}`;
}
