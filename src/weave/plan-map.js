import { parsePlanIntent } from "../lib/plan-contract.js";

/**
 * Map canonical weave planning state to planner intent (extended fields).
 */
export function planningStateToPlannerInput(state, { participant_ids, entry_point = "plan_dinners" }) {
  const intent = {
    dinner_count: state.dinner_count,
    entry_point,
    participant_ids,
    keep_it_easy: state.keep_it_easy === true,
    keep_ingredients_simple: state.keep_ingredients_simple === true,
    meal_styles: [...(state.meal_styles || [])],
    practical_hints: [],
    scheduled_dates: null,
    slots: null,
    max_cook_minutes: state.max_minutes ?? null,
    max_cook_minutes_hard: state.max_minutes_hard === true,
    require_effort: state.effort || null,
    require_ingredient_complexity:
      state.ingredient_complexity_hard === true ? state.ingredient_complexity : null,
    frequencies: [...(state.frequencies || [])],
    exclude_ingredients: [...(state.exclude_ingredients || [])],
    exclude_categories: [...(state.exclude_categories || [])],
    include_ingredients: [...(state.include_ingredients || [])],
    cuisines: [...(state.cuisines || [])],
    intent_cues: [...(state.intent_cues || [])],
    special_count: state.special_count,
    weave_slots: [...(state.slots || [])],
    date_start: state.date_start,
    date_end: state.date_end,
  };
  return intent;
}

export function parsePlannerFromState(state, opts) {
  const raw = planningStateToPlannerInput(state, opts);
  const parsed = parsePlanIntent({
    dinner_count: raw.dinner_count,
    entry_point: raw.entry_point,
    participant_ids: raw.participant_ids,
    keep_it_easy: raw.keep_it_easy,
    keep_ingredients_simple: raw.keep_ingredients_simple,
    meal_styles: raw.meal_styles,
    max_cook_minutes: raw.max_cook_minutes,
  });
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    intent: {
      ...parsed.intent,
      ...raw,
    },
  };
}
