/** Times of day as "HH:MM", for the editors' time picker (ui/TimeField). */

/** "HH:MM" from an hour and the minutes of another time (":00" when there is none). */
export function atHour(hour: number, value: string | null): string {
  return `${String(hour).padStart(2, "0")}:${value ? value.slice(3, 5) : "00"}`;
}

/** "HH:MM" from minutes and the hour of another time (9 AM when there is none). */
export function atMinute(minute: string, value: string | null): string {
  return `${value ? value.slice(0, 2) : "09"}:${minute}`;
}
