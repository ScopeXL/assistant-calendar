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

/**
 * The evening dim (Settings → Display → Sleep): from `dimFrom` until the sleep starts, the screen
 * is at `level` percent. Only with a sleep schedule, as on the server (domain/screen.py). Null
 * when it isn't dimming now.
 */
export function dimmedTo(
  dimFrom: string | null | undefined,
  sleepFrom: string | null | undefined,
  sleepTo: string | null | undefined,
  level: number,
  hour: number,
  minute: number,
): number | null {
  if (!sleepTo || !dimFrom || !sleepFrom) return null;
  return isNight(dimFrom, sleepFrom, hour, minute) ? level : null;
}
