/**
 * Legacy adapter: maps old facet-shaped intents or D-06 canonical discovery state to DiscoveryQuery.
 */
import { normalizeQuery } from "../discovery/query.js";
import { discoveryStateToQuery } from "../weave/discovery-map.js";

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
 * @param {object} intent facet or canonical discovery state
 * @param {{ text?: string|null, limit?: number }} [opts]
 */
export function intentToDiscoveryQuery(intent, opts = {}) {
  if (intent && !intent.facets) {
    const mapped = discoveryStateToQuery(intent, opts);
    return mapped.ok ? { ok: true, query: mapped.query, dropped: [] } : { ok: false, error: mapped.error };
  }
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
  for (const key of Object.keys(criteria)) {
    if (result.ok) break;
    dropped.push(key);
    delete criteria[key];
    result = normalizeQuery(input);
  }
  return result.ok ? { ok: true, query: result.query, dropped } : { ok: false, error: result.error };
}
