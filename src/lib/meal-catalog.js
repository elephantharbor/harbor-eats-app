/**
 * Curated alpha meal catalog — attributes drive eligibility + taste model.
 * recipe_slug is stable across plans for fatigue / favorites.
 */

import { listCatalogMeals } from "./recipe-store.js";

/** @typedef {ReturnType<typeof listCatalogMeals>[number]} CatalogMeal */

export const MEAL_CATALOG = listCatalogMeals();

export function catalogMealToOption(meal, letter, plan_id) {
  return {
    letter,
    meal_option_id: `${plan_id}-${letter}`,
    name: meal.name,
    recipe_slug: meal.recipe_slug,
    recipe_version_id: meal.recipe_version_id,
    title: meal.title,
    tags: meal.tags,
    attributes_json: {
      tags: meal.tags,
      sparks: meal.sparks,
      exploration: meal.exploration,
      title: meal.title,
      chips: meal.chips,
      plate: meal.plate,
      tone: meal.tone,
      minutes: meal.minutes,
      effort: meal.effort,
      recipe_slug: meal.recipe_slug,
      recipe_version_id: meal.recipe_version_id,
      cuisine: meal.cuisine,
      meal_format: meal.meal_format,
      primary_ingredient: meal.primary_ingredient,
    },
  };
}
