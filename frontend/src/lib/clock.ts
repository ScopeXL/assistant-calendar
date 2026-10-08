/**
 * Server clock offset, estimated from the X-Server-Time-Ms header on API responses (and the SSE
 * hello). Keeps the lowest-latency of the last 8 samples. The wall screen shows the server's time,
 * because a Raspberry Pi has no clock of its own until the network gives it one (PLAN §13.10).
 */

interface Sample {
  offset: number;
  roundTrip: number;
  /** This device's wall clock against its steady one when the sample came in. */
  skew: number;
}

const samples: Sample[] = [];
const MAX_SAMPLES = 8;
const MOVED_MS = 1_000;
const JUMPED_MS = 1_000;
const listeners = new Set<() => void>();
let lastIssued = 0;

export function recordClockSample(sentAt: number, receivedAt: number, serverTime: number): void {
  const roundTrip = receivedAt - sentAt;
  if (!Number.isFinite(serverTime) || roundTrip < 0) return;
  const before = clockOffset();
  samples.push({ offset: serverTime - (sentAt + receivedAt) / 2, roundTrip, skew: skewNow() });
  if (samples.length > MAX_SAMPLES) samples.shift();
  if (Math.abs(clockOffset() - before) > MOVED_MS) {
    for (const listener of listeners) listener();
  }
}

/** Told when the offset moves by more than a second: the first sample, or a Pi that just got
 * its time. Returns the unsubscribe. */
export function onClockMoved(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function skewNow(): number {
  return Date.now() - performance.now();
}

export function clockOffset(): number {
  const skew = skewNow();
  let best: Sample | undefined;
  for (const sample of samples) {
    // A sample from before this device's own clock jumped (a Pi that just got its time from the
    // network) no longer fits; the next response brings a fresh one.
    if (Math.abs(sample.skew - skew) > JUMPED_MS) continue;
    if (!best || sample.roundTrip < best.roundTrip) best = sample;
  }
  return best ? Math.round(best.offset) : 0;
}

/** Now, by the server's clock. */
export function serverNow(): number {
  return Date.now() + clockOffset();
}

/** Corrected time that never repeats or goes backwards on this device. */
export function nextTimestamp(now = Date.now()): number {
  lastIssued = Math.max(now + clockOffset(), lastIssued + 1);
  return lastIssued;
}

export function resetClockForTests(): void {
  samples.length = 0;
  lastIssued = 0;
}
