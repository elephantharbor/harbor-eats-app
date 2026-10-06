/**
 * Stage 4. Explicit Discovery criteria are hard filters.
 * They run only after household eligibility. They do not relax a hard limit,
 * and they are not the D-01 chips.
 *
 * Quick reads total_minutes. Easy reads effort_level. Simple reads
 * ingredient_complexity. None of them reads a pantry.
 * A missing minute value fails closed when Quick or max_minutes is set.
 */

import { QUICK_MAX_MINUTES } from "./constants.js";

function has(list, value) {
  return Boolean(value) && list.includes(value);
}

function overlaps(wanted, present) {
  if (!wanted.length) return true;
  return wanted.some((token) => present.includes(token));
}

/**
 * @param {object} meal
 * @param {object} criteria
 * @returns {{ pass: boolean, code: string|null, detail: string|null, matched: string[] }}
 */
export function matchExplicitCriteria(meal, criteria) {
  const matched = [];
  if (criteria.effort_levels.length) {
    if (!has(criteria.effort_levels, meal.effort_level)) {
      return { pass: false, code: "explicit_effort", detail: meal.effort_level || "unknown", matched };
    }
    matched.push("explicit_effort");
  }
  if (criteria.ingredient_complexities.length) {
    if (!has(criteria.ingredient_complexities, meal.ingredient_complexity)) {
      return { pass: false, code: "explicit_complexity", detail: meal.ingredient_complexity || "unknown", matched };
    }
    matched.push("explicit_complexity");
  }
  if (criteria.quick) {
    if (typeof meal.total_minutes !== "number" || meal.total_minutes > QUICK_MAX_MINUTES) {
      const detail = typeof meal.total_minutes !== "number" ? "minutes_unknown" : "over_quick_max";
      return { pass: false, code: "explicit_quick", detail, matched };
    }
    matched.push("explicit_quick");
  }
  if (criteria.max_minutes != null) {
    if (typeof meal.total_minutes !== "number" || meal.total_minutes > criteria.max_minutes) {
      const detail = typeof meal.total_minutes !== "number" ? "minutes_unknown" : "over_max";
      return { pass: false, code: "explicit_max_minutes", detail, matched };
    }
    matched.push("explicit_max_minutes");
  }
  if (criteria.cuisines.length) {
    if (!overlaps(criteria.cuisines, meal.cuisines || [])) {
      return { pass: false, code: "explicit_cuisine", detail: null, matched };
    }
    matched.push("explicit_cuisine");
  }
  if (criteria.meal_styles.length) {
    const present = [...(meal.styles || [])];
    if (meal.meal_format) present.push(meal.meal_format);
    if (!overlaps(criteria.meal_styles, present)) {
      return { pass: false, code: "explicit_meal_style", detail: null, matched };
    }
    matched.push("explicit_meal_style");
  }
  if (criteria.flavors.length) {
    const present = [...(meal.flavors || [])];
    if (meal.flavor_profile) present.push(meal.flavor_profile);
    if (!overlaps(criteria.flavors, present)) {
      return { pass: false, code: "explicit_flavor", detail: null, matched };
    }
    matched.push("explicit_flavor");
  }
  const ingredientPresent = [
    ...(meal.ingredient_ids || []),
    ...(meal.vocabulary_tag_ids || []),
    meal.primary_ingredient,
  ].filter(Boolean);
  if (criteria.ingredients.length) {
    if (!overlaps(criteria.ingredients, ingredientPresent)) {
      return { pass: false, code: "explicit_ingredient", detail: null, matched };
    }
    matched.push("explicit_ingredient");
  }
  if (criteria.exclude_ingredients.length) {
    if (overlaps(criteria.exclude_ingredients, ingredientPresent)) {
      return { pass: false, code: "explicit_exclude_ingredient", detail: null, matched };
    }
    matched.push("explicit_exclude_ingredient");
  }
  if (criteria.methods.length) {
    if (!overlaps(criteria.methods, meal.methods || [])) {
      return { pass: false, code: "explicit_method", detail: null, matched };
    }
    matched.push("explicit_method");
  }
  if (criteria.equipment.length) {
    if (!overlaps(criteria.equipment, meal.equipment || [])) {
      return { pass: false, code: "explicit_equipment", detail: null, matched };
    }
    matched.push("explicit_equipment");
  }
  return { pass: true, code: null, detail: null, matched };
}
