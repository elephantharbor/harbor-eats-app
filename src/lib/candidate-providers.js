/**
 * Candidate source providers — structured meals for the recommendation pipeline.
 * Taste Model ranks candidates regardless of origin.
 */

import { MEAL_CATALOG, catalogMealToOption } from "./meal-catalog.js";
import { getConceptBySlug } from "./recipe-store.js";

/**
 * @typedef {import('./meal-catalog.js').CatalogMeal & { source: string, candidate_key: string }} StructuredCandidate
 */

/**
 * @typedef {object} ProviderContext
 * @property {import('./recommendations.js').RecommendationContext} rec
 */

/** @type {{ id: string, label: string, gather: (ctx: ProviderContext) => StructuredCandidate[] }} */
export const harborCatalogProvider = {
  id: "harbor_catalog",
  label: "FlavorWeave first-party catalog",
  gather(_ctx) {
    return MEAL_CATALOG.map((meal) => ({
      ...meal,
      source: "harbor_catalog",
      candidate_key: `catalog:${meal.recipe_slug}`,
    }));
  },
};

/** Proven / high-rated slugs from household history */
export const householdFavoritesProvider = {
  id: "household_favorites",
  label: "Household proven favorites",
  gather(ctx) {
    const { ratings = [] } = ctx.rec;
    const favSlugs = new Set();
    for (const r of ratings) {
      if (r.score >= 8 && r.recipe_slug) favSlugs.add(r.recipe_slug);
    }
    const out = [];
    for (const slug of favSlugs) {
      const meal = MEAL_CATALOG.find((m) => m.recipe_slug === slug);
      if (meal) {
        out.push({
          ...meal,
          source: "household_favorite",
          candidate_key: `favorite:${slug}`,
        });
      }
    }
    return out;
  },
};

/** Previously successful recipe versions (rated ≥ 8) */
export const successfulVersionsProvider = {
  id: "successful_versions",
  label: "Previously successful recipe versions",
  gather(ctx) {
    const { ratings = [] } = ctx.rec;
    const seen = new Set();
    const out = [];
    for (const r of ratings) {
      if (r.score < 8 || !r.recipe_slug || seen.has(r.recipe_slug)) continue;
      seen.add(r.recipe_slug);
      const concept = getConceptBySlug(r.recipe_slug);
      const meal = MEAL_CATALOG.find((m) => m.recipe_slug === r.recipe_slug);
      if (meal && concept) {
        out.push({
          ...meal,
          source: "successful_version",
          candidate_key: `success:${concept.current_version.recipe_version_id}`,
        });
      }
    }
    return out;
  },
};

/** Higher-exploration slots from catalog */
export const explorationProvider = {
  id: "exploration",
  label: "Exploration candidates",
  gather(_ctx) {
    return MEAL_CATALOG.filter((m) => m.exploration >= 0.55).map((meal) => ({
      ...meal,
      source: "exploration",
      candidate_key: `explore:${meal.recipe_slug}`,
    }));
  },
};

export const DEFAULT_PROVIDERS = [
  harborCatalogProvider,
  householdFavoritesProvider,
  successfulVersionsProvider,
  explorationProvider,
];

/**
 * Merge candidates from providers; dedupe by recipe_slug (first source wins).
 * @param {ProviderContext} ctx
 * @param {typeof DEFAULT_PROVIDERS} [providers]
 */
export function gatherCandidates(ctx, providers = DEFAULT_PROVIDERS) {
  /** @type {Map<string, StructuredCandidate>} */
  const bySlug = new Map();
  for (const p of providers) {
    for (const c of p.gather(ctx)) {
      if (!bySlug.has(c.recipe_slug)) bySlug.set(c.recipe_slug, c);
    }
  }
  return [...bySlug.values()];
}

export { catalogMealToOption };
