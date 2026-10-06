/**
 * Future natural-language adapter. Types and the binding rules only.
 * D-06 owns interpretation. D-05 will own models. D-07 executes a
 * DiscoveryQuery and does not call either one.
 */

export const NLP_OWNERS = Object.freeze({
  interpret: "D-06",
  models: "D-05",
  execute: "D-07",
});

/**
 * How a later interpreter must fill a DiscoveryQuery. This is not a parser.
 * A phrase on the left is not matched by this module.
 */
export const NLP_BINDING_RULES = Object.freeze([
  {
    id: "keep_it_easy",
    maps_to: "soft.keep_it_easy",
    must_not_map_to: ["criteria.effort_levels", "criteria.quick", "criteria.max_minutes"],
    note: "D-01 chip. Soft tier ranking. Not an Easy hard filter and not Quick.",
  },
  {
    id: "keep_ingredients_simple",
    maps_to: "soft.keep_ingredients_simple",
    must_not_map_to: ["criteria.ingredient_complexities", "pantry", "already_have"],
    note: "D-01 chip. Soft tier on ingredient_complexity. Not a pantry check.",
  },
  {
    id: "explicit_easy",
    maps_to: "criteria.effort_levels",
    value: ["easy"],
    must_not_map_to: ["soft.keep_it_easy", "criteria.quick"],
    note: "Caller asked to filter to Easy. Hard filter. Meals outside easy are dropped.",
  },
  {
    id: "explicit_quick",
    maps_to: "criteria.quick",
    value: true,
    must_not_map_to: ["criteria.effort_levels", "soft.keep_it_easy"],
    note: "Clock filter. total_minutes at or under 30. Independent of effort_level.",
  },
  {
    id: "explicit_simple",
    maps_to: "criteria.ingredient_complexities",
    value: ["simple"],
    must_not_map_to: ["soft.keep_ingredients_simple", "pantry", "already_have"],
    note: "Hard filter on D-03 ingredient_complexity. Not a pantry.",
  },
  {
    id: "literal_text",
    maps_to: "text",
    must_not_map_to: ["criteria", "soft"],
    note: "Words that are not one of the bindings above stay as query text for the token matcher.",
  },
]);

/**
 * @typedef {object} DiscoveryNlpRequest
 * @property {string} text free text from the caller
 * @property {"standalone"|"replace_plan_meal"|"choose_for_plan"} [mode]
 * @property {object} [context] client context ids, never constraints
 */

/**
 * @typedef {object} DiscoveryNlpSuccess
 * @property {true} ok
 * @property {object} query DiscoveryQuery, still passed through normalizeQuery
 * @property {string[]} unresolved phrases the interpreter did not bind
 * @property {"D-06"} owner
 */

/**
 * @typedef {object} DiscoveryNlpFailure
 * @property {false} ok
 * @property {string} error
 * @property {"D-06"} owner
 */

/**
 * D-07 does not interpret free text. A caller that wants literal search
 * puts the string on DiscoveryQuery.text and calls the pipeline.
 * @param {DiscoveryNlpRequest} [_request]
 * @returns {DiscoveryNlpFailure}
 */
export function interpretFreeText(_request) {
  return {
    ok: false,
    error: "nlp_not_in_d07",
    owner: NLP_OWNERS.interpret,
  };
}
