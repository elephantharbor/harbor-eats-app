/**
 * Deterministic intent_cue weights (architecture card §3).
 * Discovery and planner share this table; scores clamp to [-0.40, 0.40].
 */
import { getTasteTerm } from "../lib/taste-vocabulary.js";

const CUE_WEIGHTS = Object.freeze({
  cozy: [
    ["flavor", "rich", 0.15],
    ["flavor", "savory", 0.1],
    ["flavor", "umami", 0.1],
    ["texture", "creamy", 0.1],
    ["style", "soups", 0.15],
    ["style", "stews", 0.15],
  ],
  fresh: [
    ["flavor", "fresh", 0.2],
    ["flavor", "citrusy", 0.15],
    ["flavor", "herbaceous", 0.1],
    ["flavor", "rich", -0.1],
  ],
  filling: [
    ["style", "stews", 0.15],
    ["style", "pasta", 0.1],
    ["style", "bowls", 0.1],
    ["style", "curries", 0.1],
    ["flavor", "rich", 0.1],
  ],
  light: [
    ["flavor", "fresh", 0.15],
    ["flavor", "citrusy", 0.1],
    ["flavor", "herbaceous", 0.1],
    ["flavor", "rich", -0.2],
    ["texture", "creamy", -0.1],
    ["style", "stews", -0.1],
  ],
  comforting: [
    ["flavor", "rich", 0.15],
    ["flavor", "savory", 0.1],
    ["flavor", "umami", 0.1],
    ["texture", "creamy", 0.1],
    ["texture", "tender", 0.05],
    ["style", "soups", 0.1],
    ["style", "stews", 0.1],
    ["style", "pasta", 0.1],
  ],
  summery: [
    ["flavor", "fresh", 0.15],
    ["flavor", "citrusy", 0.15],
    ["flavor", "herbaceous", 0.1],
    ["style", "grilled", 0.15],
    ["flavor", "rich", -0.1],
  ],
  special: [],
  restaurant_like: [],
  weeknight: [],
});

function tagSet(vocabularyTagIds) {
  const styles = new Set();
  const flavors = new Set();
  const textures = new Set();
  for (const slug of vocabularyTagIds || []) {
    const term = getTasteTerm(slug);
    if (!term) continue;
    if (term.category === "meal_style") styles.add(slug);
    else if (term.category === "flavor") flavors.add(slug);
    else if (term.category === "texture") textures.add(slug);
  }
  return { styles, flavors, textures };
}

function weightRow(kind, key, value, weights) {
  if (kind === "flavor" && weights.flavors.has(key)) return value;
  if (kind === "texture" && weights.textures.has(key)) return value;
  if (kind === "style" && weights.styles.has(key)) return value;
  return 0;
}

/**
 * @param {object} meal discovery or planner feature shape
 * @param {string[]} cues max 4 slugs
 * @param {{ keep_it_easy?: boolean|null, prefer_max_minutes?: number|null }} [opts]
 */
export function cueScoreForMeal(meal, cues, opts = {}) {
  const tags = meal.vocabulary_tag_ids || meal.entry?.pkg?.vocabulary_tag_ids || [];
  const weights = tagSet(tags);
  const exploration = Number(meal.exploration ?? meal.entry?.pkg?.exploration ?? 0);
  const effort = meal.effort_level || null;
  const complexity = meal.ingredient_complexity || null;
  const minutes = meal.total_minutes ?? meal.minutes ?? null;
  let total = 0;
  for (const cue of cues || []) {
    if (cue === "special") {
      total += exploration >= 0.55 ? 0.25 : exploration * 0.1;
      if (complexity === "adventurous") total += 0.1;
      continue;
    }
    if (cue === "restaurant_like") {
      if (exploration >= 0.55) total += 0.15;
      if (weights.flavors.has("umami")) total += 0.1;
      if (weights.flavors.has("rich")) total += 0.1;
      if (complexity === "standard" || complexity === "adventurous") total += 0.1;
      if (effort === "involved" && opts.keep_it_easy !== true) total += 0.05;
      continue;
    }
    if (cue === "weeknight") {
      if (effort === "easy") total += 0.2;
      else if (effort === "moderate") total += 0.05;
      else if (effort === "involved") total -= 0.15;
      if (typeof minutes === "number") {
        if (minutes <= 30) total += 0.15;
        else if (minutes <= 45) total += 0.05;
        else if (minutes > 45) total -= 0.05;
      }
      if (complexity === "simple") total += 0.1;
      continue;
    }
    for (const [kind, key, value] of CUE_WEIGHTS[cue] || []) {
      total += weightRow(kind, key, value, weights);
    }
  }
  if (opts.prefer_max_minutes != null && typeof minutes === "number" && minutes <= opts.prefer_max_minutes) {
    total += 0.15;
  }
  return Math.max(-0.4, Math.min(0.4, total));
}
