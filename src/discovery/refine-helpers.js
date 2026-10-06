/**
 * Refine sheet vocabulary grouping and cuisine slug expansion for Discovery UI.
 */

const INSPIRED_CUISINES = new Set(["indian", "thai", "japanese", "italian", "chinese", "scandinavian"]);

const GROUP_KIND = Object.freeze({
  cuisine: "cuisines",
  meal_style: "meal_styles",
  flavor: "flavors",
  ingredient: "ingredients",
});

/**
 * @param {{ slug: string, name: string, on_menu?: boolean, kind?: string }} term
 */
export function cuisineValuesForTerm(term) {
  const slug = term.slug;
  if (!slug) return [];
  if (INSPIRED_CUISINES.has(slug)) return [slug, slug + "-inspired"];
  return [slug];
}

/**
 * @param {object} catalog tastes catalog from /api/tastes/catalog
 */
export function vocabularyByKind(catalog) {
  const out = {
    cuisines: [],
    meal_styles: [],
    flavors: [],
    ingredients: [],
  };
  const groups = (catalog && catalog.groups) || [];
  groups.forEach(function (group) {
    const kind = group.kind || group.id;
    const field = GROUP_KIND[kind];
    if (!field) return;
    (group.terms || []).forEach(function (term) {
      if (term.on_menu === false) return;
      out[field].push(term);
    });
  });
  return out;
}

/**
 * @param {object} query normalized discovery query
 */
export function activeCriteriaCount(query) {
  const c = query.criteria || {};
  let n = 0;
  if (query.text) n++;
  if (c.quick || c.max_minutes != null || c.different) n++;
  for (const key of [
    "cuisines",
    "meal_styles",
    "flavors",
    "ingredients",
    "effort_levels",
    "ingredient_complexities",
    "protein_groups",
    "diet",
    "textures",
  ]) {
    if (c[key] && c[key].length) n += c[key].length;
  }
  return n;
}

/**
 * Apply a relax-chip patch from {@link relaxRemoveChips}.
 * @param {object} query
 * @param {{ patch: object }} chip
 */
export function applyRelaxChip(query, chip) {
  const base = Object.assign({}, query, {
    criteria: Object.assign({}, query.criteria),
  });
  const p = chip.patch || {};
  if (p.quick === false) {
    base.criteria.quick = false;
    base.criteria.max_minutes = null;
  }
  if (p.max_minutes === null) base.criteria.max_minutes = null;
  if (p.effort_levels) base.criteria.effort_levels = p.effort_levels;
  if (p.ingredient_complexities) base.criteria.ingredient_complexities = p.ingredient_complexities;
  if (p.different === false) base.criteria.different = false;
  if (p.cuisines) base.criteria.cuisines = p.cuisines;
  if (p.meal_styles) base.criteria.meal_styles = p.meal_styles;
  if (p.flavors) base.criteria.flavors = p.flavors;
  if (p.ingredients) base.criteria.ingredients = p.ingredients;
  if (p.protein_groups) base.criteria.protein_groups = p.protein_groups;
  if (p.diet) base.criteria.diet = p.diet;
  if (p.textures) base.criteria.textures = p.textures;
  return base;
}

/**
 * Snapshot for history restore.
 * @param {object} state discovery UI state slice
 * @param {() => string} pathForQuery
 */
export function findHistorySnapshot(state, pathForQuery) {
  return {
    scrollY: state.scrollY || 0,
    focusSlug: state.focusSlug || null,
    path: pathForQuery(),
    forceResults: !!state.forceResults,
    mode: state.mode,
    urlContext: Object.assign({}, state.urlContext || {}),
  };
}
