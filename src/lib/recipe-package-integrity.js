/**
 * Extra recipe-package checks for Cycle 2 catalog work (D-03).
 * Compound gaps are errors for publication; near-duplicates are warnings only.
 */

import { getTasteTerm } from "./taste-vocabulary.js";

export const PACKAGE_DIETARY_LABELS = new Set(["plant", "dairy_free", "fish"]);

export const PACKAGE_ALLERGEN_IDS = new Set([
  "dairy",
  "nuts",
  "cashew",
  "walnut",
  "peanut",
  "almond",
  "pecan",
  "hazelnut",
  "pistachio",
  "macadamia",
  "pine_nut",
  "shellfish",
  "finfish",
  "poultry",
  "meat",
]);

const COMPOUND_NAME =
  /(crema|pesto|slaw mix|pickled|preserved|salsa|harissa paste|chipotle in adobo|shawarma spice|adobo|spice blend)/i;

const COMPOUND_OK_NOTE = /(store-bought|prepared|pre-shredded|package|bottled|blend|whisk|mix|make|or \d)/i;

const PANTRY_OK_WITHOUT_QTY = /^(salt|pepper|black pepper|water)$/i;

/**
 * @param {object} pkg
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateCompoundIngredients(pkg) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const steps = pkg.steps || [];

  for (const ing of pkg.ingredients || []) {
    if (!COMPOUND_NAME.test(ing.name)) continue;
    const note = ing.note || "";
    const explainedInSteps = steps.some(
      (s) =>
        COMPOUND_OK_NOTE.test(s.body || "") &&
        (s.body || "").toLowerCase().includes(ing.name.split(/\s+/)[0].toLowerCase())
    );
    if (!COMPOUND_OK_NOTE.test(note) && !explainedInSteps) {
      errors.push(`compound ingredient "${ing.name}" needs store-bought/prep note or step guidance`);
    }
  }

  for (const ing of pkg.ingredients || []) {
    if (PANTRY_OK_WITHOUT_QTY.test(ing.name)) continue;
    if (typeof ing.quantity !== "number" || !ing.unit) {
      warnings.push(`ingredient "${ing.name}" still has unparsed quantity`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function ingredientKeys(pkg) {
  return (pkg.ingredients || [])
    .map((i) => i.name.toLowerCase().trim())
    .filter(Boolean)
    .sort();
}

function overlapRatio(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (!setA.size || !setB.size) return 0;
  let shared = 0;
  for (const key of setA) {
    if (setB.has(key)) shared += 1;
  }
  return shared / Math.min(setA.size, setB.size);
}

function mealStyleTags(pkg) {
  return (pkg.vocabulary_tag_ids || []).filter((slug) => {
    const term = getTasteTerm(slug);
    return term?.category === "meal_style";
  });
}

/**
 * Pragmatic duplicate hints — warnings only.
 * @param {object[]} packages
 */
export function warnCatalogDuplicates(packages) {
  /** @type {{ message: string, dish_ids: string[] }[]} */
  const warnings = [];

  for (let i = 0; i < packages.length; i++) {
    for (let j = i + 1; j < packages.length; j++) {
      const a = packages[i];
      const b = packages[j];
      if (a.recipe_id === b.recipe_id) {
        warnings.push({
          message: `duplicate recipe_id ${a.recipe_id}`,
          dish_ids: [a.dish_id, b.dish_id],
        });
        continue;
      }
      const overlap = overlapRatio(ingredientKeys(a), ingredientKeys(b));
      const stylesA = mealStyleTags(a);
      const stylesB = mealStyleTags(b);
      const sharedStyles = stylesA.filter((s) => stylesB.includes(s));
      const sharedTags = (a.vocabulary_tag_ids || []).filter((t) => (b.vocabulary_tag_ids || []).includes(t));
      if (overlap >= 0.55 && sharedStyles.length && sharedTags.length >= 3) {
        warnings.push({
          message: `similar meals ${a.dish_id} and ${b.dish_id} (ingredient overlap ${Math.round(overlap * 100)}%, shared style ${sharedStyles.join(",")})`,
          dish_ids: [a.dish_id, b.dish_id],
        });
      }
    }
  }
  return warnings;
}
