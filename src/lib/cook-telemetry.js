/** Cook completion telemetry. Closed values only; no identities or free text. */
export const COOK_EVENT_NAMES = Object.freeze(["cook_completed", "cook_recorded", "cook_undone"]);
/** The two writes that record a cooked meal (plan-mutations.js finishCook / markCooked). */
export const COMPLETION_SOURCES = Object.freeze(["mark_cooked", "finish_cook"]);

/**
 * Keep completion_source only when it is a known op. Anything else is dropped,
 * not rejected, so a bad value never loses the cook event itself.
 * Non-cook events are returned unchanged.
 */
export function cleanCookEventProps(eventName, props) {
  if (!COOK_EVENT_NAMES.includes(eventName)) return props;
  const out = { ...(props || {}) };
  if (!COMPLETION_SOURCES.includes(out.completion_source)) delete out.completion_source;
  return out;
}
