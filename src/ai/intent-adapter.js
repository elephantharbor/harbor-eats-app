/**
 * NaturalLanguageIntent -> existing D-07 DiscoveryQuery. No new recommendation engine:
 * the output goes through D-07's own normalizeQuery, which enforces vocabulary, limits and
 * schema. Anything the query cannot express is dropped, never forced.
 * D-06 plugs in here: text -> gateway(discovery_intent) -> this adapter -> D-07 pipeline.
 */
import { normalizeQuery } from "../discovery/query.js";

const FACET_TO_CRITERIA = Object.freeze({
  cuisines: "cuisines",
  meal_styles: "meal_styles",
  flavors: "flavors",
  ingredients: "ingredients",
  exclude_ingredients: "exclude_ingredients",
  methods: "methods",
  equipment: "equipment",
  textures: "textures",
  effort_levels: "effort_levels",
});

/**
 * @param {{ facets?: Record<string,string[]>, max_minutes?: number|null, quick?: boolean, different?: boolean,
 *           keep_it_easy?: boolean, keep_ingredients_simple?: boolean }} intent
 * @param {{ text?: string|null, limit?: number }} [opts]
 * @returns {{ ok: true, query: object, dropped: string[] } | { ok: false, error: string }}
 */
export function intentToDiscoveryQuery(intent, opts = {}) {
  const criteria = {};
  const dropped = [];
  for (const [facet, values] of Object.entries(intent?.facets || {})) {
    const key = FACET_TO_CRITERIA[facet];
    if (!key) { dropped.push(facet); continue; }
    criteria[key] = values;
  }
  if (Number.isInteger(intent?.max_minutes)) criteria.max_minutes = intent.max_minutes;
  if (intent?.quick === true) criteria.quick = true;
  if (intent?.different === true) criteria.different = true;
  const input = { criteria };
  if (opts.text) input.text = opts.text;
  if (opts.limit) input.limit = opts.limit;
  if (intent?.keep_it_easy != null || intent?.keep_ingredients_simple != null) {
    input.soft = { keep_it_easy: intent.keep_it_easy === true, keep_ingredients_simple: intent.keep_ingredients_simple === true };
  }
  let result = normalizeQuery(input);
  // Drop facets one by one if the D-07 normalizer rejects a value (unknown enum etc.).
  for (const key of Object.keys(criteria)) {
    if (result.ok) break;
    dropped.push(key);
    delete criteria[key];
    result = normalizeQuery(input);
  }
  return result.ok ? { ok: true, query: result.query, dropped } : { ok: false, error: result.error };
}
