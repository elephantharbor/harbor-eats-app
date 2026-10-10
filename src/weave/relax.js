/**
 * Soft filters to drop after a conflict repair returns nothing.
 * Hard eligibility and the dish or format stay.
 */

function clone(state) {
  return JSON.parse(JSON.stringify(state || {}));
}

function dropTime(state) {
  const next = clone(state);
  const changed = next.quick === true || next.max_minutes != null;
  next.quick = false;
  next.max_minutes = null;
  next.max_minutes_hard = false;
  return { state: next, changed };
}

function dropSoft(state) {
  const next = clone(state);
  const changed =
    (next.intent_cues || []).length > 0 ||
    next.keep_it_easy != null ||
    next.keep_ingredients_simple != null ||
    (next.flavors || []).length > 0 ||
    (next.effort_levels || []).length > 0 ||
    (next.ingredient_complexities || []).length > 0 ||
    next.different === true ||
    Boolean(next.text_residue);
  next.intent_cues = [];
  next.keep_it_easy = null;
  next.keep_ingredients_simple = null;
  next.flavors = [];
  next.effort_levels = [];
  next.ingredient_complexities = [];
  next.different = false;
  next.text_residue = null;
  return { state: next, changed };
}

/**
 * Protein is already swapped on the repaired state. Next, drop time, then other soft cues.
 * @returns {{ state: object, relaxed: string }[]}
 */
export function discoveryRelaxations(state) {
  const steps = [];
  const timed = dropTime(state);
  const softened = dropSoft(timed.state);
  if (timed.changed) steps.push({ state: timed.state, relaxed: "the time limit" });
  if (softened.changed) {
    const relaxed = timed.changed ? "the time limit and the extra preferences" : "the extra preferences";
    steps.push({ state: softened.state, relaxed });
  }
  return steps;
}
