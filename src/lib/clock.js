/**
 * Workers freeze both Date.now() and performance.now() during CPU-only work.
 * The clocks advance when the isolate awaits I/O. A span that does not cross
 * an await cannot be measured there. elapsedMs returns null (n/a) instead of
 * 0 so a frozen clock is not reported as a real duration.
 */
export function monotonicNow() {
  return performance.now();
}

/** Elapsed milliseconds since monotonicNow(), or null when the clock did not move. */
export function elapsedMs(start) {
  const ms = performance.now() - start;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms * 1000) / 1000;
}
