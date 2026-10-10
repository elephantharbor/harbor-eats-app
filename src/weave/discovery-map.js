import { normalizeQuery } from "../discovery/query.js";

/**
 * Canonical discovery weave state → DiscoveryQuery.
 */
export function discoveryStateToQuery(state, opts = {}) {
  const criteria = {};
  const listFields = [
    "cuisines",
    "meal_styles",
    "flavors",
    "ingredients",
    "exclude_ingredients",
    "methods",
    "equipment",
    "textures",
    "effort_levels",
    "ingredient_complexities",
    "protein_groups",
    "diet",
  ];
  for (const key of listFields) {
    if ((state[key] || []).length) criteria[key] = state[key];
  }
  if (state.max_minutes != null && state.max_minutes_hard) criteria.max_minutes = state.max_minutes;
  if (state.quick === true) criteria.quick = true;
  if (state.different === true) criteria.different = true;
  const input = { criteria };
  if ((state.intent_cues || []).length) input.intent_cues = state.intent_cues;
  if (state.max_minutes != null && !state.max_minutes_hard) input.prefer_max_minutes = state.max_minutes;
  if (opts.text) input.text = opts.text;
  if (state.text_residue) input.text = state.text_residue;
  if (opts.limit) input.limit = opts.limit;
  const soft = {};
  if (state.keep_it_easy != null) soft.keep_it_easy = state.keep_it_easy === true;
  if (state.keep_ingredients_simple != null) soft.keep_ingredients_simple = state.keep_ingredients_simple === true;
  if (state.keep_it_easy != null || state.keep_ingredients_simple != null) input.soft = soft;
  return normalizeQuery(input);
}
