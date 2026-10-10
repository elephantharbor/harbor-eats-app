/**
 * Workers freeze Date.now() during CPU-only work. It advances when the
 * isolate yields for I/O, so a synchronous planner measured with Date.now()
 * always reports 0. performance.now() is the monotonic clock and includes
 * that CPU time (Node and workerd).
 */
export function monotonicNow() {
  return performance.now();
}

/** Elapsed milliseconds since monotonicNow(), with sub-ms precision. */
export function elapsedMs(start) {
  const ms = performance.now() - start;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms * 1000) / 1000;
}
