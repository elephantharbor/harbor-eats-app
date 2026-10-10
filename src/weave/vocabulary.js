import { EFFORT_LEVELS, INGREDIENT_COMPLEXITIES } from "../lib/classification.js";
import { DIET_FILTERS, PROTEIN_GROUP_FILTERS } from "../discovery/constants.js";
import { listVocabulary } from "../lib/taste-vocabulary.js";
import { INTENT_CUES, PLAN_TOKENS } from "./constants.js";

export function buildWeaveVocabulary() {
  const cuisines = [];
  const meal_styles = [];
  const flavors = [];
  const ingredients = [];
  for (const term of listVocabulary()) {
    if (!term.active) continue;
    if (term.category === "cuisine") cuisines.push(term.slug);
    else if (term.category === "meal_style") meal_styles.push(term.slug);
    else if (term.category === "flavor") flavors.push(term.slug);
    else if (term.category === "ingredient") ingredients.push(term.slug);
  }
  return {
    cuisines: cuisines.sort(),
    meal_styles: meal_styles.sort(),
    flavors: flavors.sort(),
    ingredients: ingredients.sort(),
    textures: listVocabulary().filter((t) => t.category === "texture" && t.active).map((t) => t.slug).sort(),
    intent_cues: [...INTENT_CUES],
    plan_tokens: [...PLAN_TOKENS],
    effort_levels: [...EFFORT_LEVELS],
    ingredient_complexities: [...INGREDIENT_COMPLEXITIES],
    protein_groups: [...PROTEIN_GROUP_FILTERS],
    diet: [...DIET_FILTERS],
    methods: [],
    equipment: [],
  };
}
