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
    id: "fish_seafood",
    maps_to: "criteria.protein_groups",
    value: ["seafood"],
    must_not_map_to: ["criteria.ingredients", "title"],
    note: "Fish and seafood collection. seafood covers the fish and shellfish groups. Do not infer a protein from the title.",
  },
  {
    id: "plant_forward",
    maps_to: "criteria.diet",
    value: ["plant"],
    must_not_map_to: ["constraints", "eligible"],
    note: "Plant-forward collection. Normalize expands plant to the stored plant, plant_based, and vegetarian labels. Not an extra diner.",
  },
  {
    id: "something_different",
    maps_to: "criteria.different",
    value: true,
    must_not_map_to: ["taste less_often", "stage-7 recency"],
    note: "Hard filter against recent cooks after eligibility. Survivors stay taste-ranked. Not a less-often include.",
  },
  {
    id: "texture",
    maps_to: "criteria.textures",
    must_not_map_to: ["criteria.flavors"],
    note: "Crispy, creamy, crunchy, and tender are texture vocabulary. They are not flavors.",
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
