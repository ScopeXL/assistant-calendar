/** Countdowns in the family's words (UX §2, §4 "Countdowns room"). */

/** The tile's big line: "12 days", then "Tomorrow" and "Today!" on the last days. */
export function daysText(days: number): string {
  if (days <= 0) return "Today!";
  if (days === 1) return "Tomorrow";
  return `${String(days)} days`;
}

/** A Coming up line: "Mia's birthday · 12 days"; on the day, "Today: Mia's birthday!". */
export function comingUpText(title: string, days: number): string {
  if (days <= 0) return `Today: ${title}!`;
  if (days === 1) return `Tomorrow: ${title}`;
  return `${title} · ${String(days)} days`;
}

/** What a kid's birthday brings: "Turns 9". */
export function turningText(turning: number | null | undefined): string | null {
  return turning != null && turning > 0 ? `Turns ${String(turning)}` : null;
}
