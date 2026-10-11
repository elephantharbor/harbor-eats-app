/**
 * Member ids are unique in D1, not per household. A second live eval must not
 * reuse "a" / "b", and every corpus profile has to be created even when the
 * cases only mention one of them.
 */

export function memberIdForRun(runId, profile, localId) {
  const local = String(localId || "m").replace(/[^a-z0-9]/gi, "").slice(0, 16) || "m";
  const name = String(profile || "hh").replace(/[^a-z0-9]/gi, "").slice(0, 16) || "hh";
  const run = String(runId || "run").replace(/[^a-z0-9]/gi, "").slice(0, 16) || "run";
  return `m_${name}_${local}_${run}`;
}

export function profileKeys(corpus) {
  return Object.keys(corpus?.households || {});
}

export function newRunId() {
  return Math.random().toString(36).slice(2, 10);
}
