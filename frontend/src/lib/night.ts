/**
 * The sleep schedule (Settings → Display → Sleep; UX §4 "Night"): between `from` and `to` the
 * wall goes dark. The window may wrap past midnight (22:00 to 06:30).
 */
function minutes(clock: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isNight(
  from: string | null | undefined,
  to: string | null | undefined,
  hour: number,
  minute: number,
): boolean {
  if (!from || !to) return false;
  const start = minutes(from);
  const end = minutes(to);
  if (start === null || end === null || start === end) return false;
  const now = hour * 60 + minute;
  return start < end ? now >= start && now < end : now >= start || now < end;
}
