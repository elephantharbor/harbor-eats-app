/**
 * Staging catalog reads. When CATALOG_SOURCE is d1, recommendations, the
 * planner, recipe detail, cooking, eligibility, taste ranking, and shopping
 * use these rows. recipe-store.js is not consulted on that path.
 */

import { isNormallyRecommendable } from "./catalog-publish.js";

export function catalogReadsFromD1(env) {
  const source = env && (env.CATALOG_SOURCE || env.catalog_source);
  return source === "d1";
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function all(db, sql, ...params) {
  const res = await db.prepare(sql).bind(...params).all();
  return res.results || [];
}

function groupBy(rows) {
  /** @type {Map<string, object[]>} */
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row.recipe_version_id) || [];
    list.push(row);
    map.set(row.recipe_version_id, list);
  }
  return map;
}

/**
 * @param {object} versionRow
 * @param {Map<string, object[]>} children
 */
export function recordFromParts(versionRow, children) {
  const id = versionRow.recipe_version_id;
  const ingredients = (children.ingredients.get(id) || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      position: row.position,
      ingredient_id: row.ingredient_id,
      name: row.name,
      display_name: row.display_name || row.name,
      quantity: row.quantity,
      unit: row.unit,
      raw_quantity: row.raw_quantity,
      note: row.note,
      preparation: row.preparation,
      optional: row.optional ? 1 : 0,
      role: row.role,
    }));
  const steps = (children.steps.get(id) || [])
    .slice()
    .sort((a, b) => a.step_number - b.step_number)
    .map((row) => ({
      step_number: row.step_number,
      title: row.title,
      body: row.body,
      ingredient_refs: parseJson(row.ingredient_refs_json, []),
    }));
  return {
    dish_id: versionRow.dish_id,
    slug: versionRow.slug,
    title: versionRow.dish_title,
    name: versionRow.name || versionRow.dish_title,
    description: versionRow.dish_description,
    cuisine: versionRow.cuisine,
    meal_format: versionRow.meal_format,
    primary_ingredient: versionRow.primary_ingredient,
    texture: versionRow.texture,
    flavor_profile: versionRow.flavor_profile,
    weeknight: versionRow.weeknight == null ? null : Boolean(versionRow.weeknight),
    exploration: versionRow.exploration,
    plate: versionRow.plate,
    tone: versionRow.tone,
    tags: parseJson(versionRow.tags_json, []),
    sparks: parseJson(versionRow.sparks_json, []),
    chips: parseJson(versionRow.chips_json, []),
    recipe_id: versionRow.recipe_id,
    visibility: versionRow.visibility,
    household_id: versionRow.household_id,
    recipe_version_id: id,
    version_number: versionRow.version_number,
    version_title: versionRow.title,
    version_description: versionRow.description,
    base_servings: versionRow.base_servings,
    prep_minutes: versionRow.prep_minutes,
    cook_minutes: versionRow.cook_minutes,
    total_minutes: versionRow.total_minutes,
    effort_level: versionRow.effort_level,
    ingredient_complexity: versionRow.ingredient_complexity,
    classification_hash: versionRow.classification_hash,
    heat: versionRow.heat,
    doneness: versionRow.doneness,
    methods: parseJson(versionRow.methods_json, []),
    dietary_tags: parseJson(versionRow.dietary_tags_json, []),
    substitutions: parseJson(versionRow.substitutions_json, null),
    components: parseJson(versionRow.components_json, []),
    publication_status: versionRow.publication_status,
    artifact_publication_status: versionRow.artifact_publication_status,
    ingredients,
    steps,
    vocabulary_tag_ids: (children.taste.get(id) || []).map((row) => row.vocabulary_slug).sort(),
    dietary_labels: (children.dietary.get(id) || []).map((row) => row.label).sort(),
    allergens: (children.allergens.get(id) || []).map((row) => row.allergen).sort(),
    equipment: (children.equipment.get(id) || []).map((row) => row.item).sort(),
    eligibility_tags: (children.eligibility.get(id) || []).map((row) => row.tag),
    images: children.images.get(id) || [],
    provenance: children.provenance.get(id) || null,
  };
}

export function displayQuantity(ingredient, contract) {
  if (contract === "flavorweave-legacy-catalog-package") return ingredient.raw_quantity ?? "";
  if (typeof ingredient.quantity === "number" && ingredient.unit) {
    return `${ingredient.quantity} ${ingredient.unit}`;
  }
  return ingredient.raw_quantity ?? "";
}

export function plannerEntryFromRecord(record) {
  const contract = record.source_contract;
  return {
    concept: {
      concept_id: record.slug,
      name: record.name,
      title: record.title,
      cuisine: record.cuisine,
      meal_format: record.meal_format,
      primary_ingredient: record.primary_ingredient,
      texture: record.texture || null,
      flavor_profile: record.flavor_profile || null,
      tags: record.eligibility_tags?.length ? record.eligibility_tags : record.tags,
      sparks: record.sparks,
      exploration: record.exploration,
      plate: record.plate,
      tone: record.tone,
      chips: record.chips,
      current_version: { methods: record.methods },
    },
    pkg: {
      dish_id: record.dish_id,
      recipe_id: record.recipe_id,
      recipe_version_id: record.recipe_version_id,
      version_number: record.version_number,
      title: record.version_title || record.title,
      description: record.version_description,
      base_servings: record.base_servings,
      prep_minutes: record.prep_minutes,
      cook_minutes: record.cook_minutes,
      total_minutes: record.total_minutes,
      effort_level: record.effort_level,
      ingredient_complexity: record.ingredient_complexity,
      heat: record.heat,
      doneness: record.doneness,
      methods: record.methods,
      equipment: record.equipment,
      ingredients: record.ingredients.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        note: item.note,
        raw_quantity: item.raw_quantity,
        ingredient_id: item.ingredient_id,
        preparation: item.preparation,
      })),
      steps: record.steps,
      dietary_labels: record.dietary_labels,
      allergens: record.allergens,
      vocabulary_tag_ids: record.vocabulary_tag_ids,
      visibility: record.visibility,
      household_id: record.household_id,
      publication_status: record.publication_status,
      display_ingredients: record.ingredients.map((item) => ({
        name: item.display_name || item.name,
        quantity: displayQuantity(item, contract || record.source_contract),
        note: item.note,
        ingredient_id: item.ingredient_id,
      })),
    },
  };
}

export function recommendationMealFromRecord(record) {
  return {
    recipe_slug: record.slug,
    recipe_version_id: record.recipe_version_id,
    name: record.name,
    title: record.title,
    tags: record.eligibility_tags?.length ? record.eligibility_tags : record.tags,
    sparks: record.sparks || [],
    exploration: record.exploration,
    minutes: record.total_minutes,
    effort_level: record.effort_level,
    ingredient_complexity: record.ingredient_complexity,
    plate: record.plate,
    tone: record.tone,
    chips: record.chips || [],
    cuisine: record.cuisine,
    meal_format: record.meal_format,
    primary_ingredient: record.primary_ingredient,
    texture: record.texture,
    flavor_profile: record.flavor_profile,
    weeknight: record.weeknight,
    vocabulary_tag_ids: record.vocabulary_tag_ids || [],
  };
}

/**
 * Required equipment from canonical catalog metadata only (catalog_equipment rows).
 * Never derived from step prose.
 * @param {unknown} list
 * @returns {string[]}
 */
export function canonicalEquipment(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const item = String(raw ?? "").trim();
    if (!item || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    out.push(item);
  }
  return out;
}

export function recipeShapeFromEntry(entry) {
  const concept = entry.concept;
  const pkg = entry.pkg;
  return {
    concept: {
      concept_id: concept.concept_id,
      name: concept.name || concept.title,
      title: concept.title,
      plate: concept.plate || "🍽️",
    },
    version: {
      recipe_version_id: pkg.recipe_version_id,
      concept_id: concept.concept_id,
      servings: pkg.base_servings,
      prep_minutes: pkg.prep_minutes,
      cook_minutes: pkg.cook_minutes,
      effort_level: pkg.effort_level || null,
      ingredient_complexity: pkg.ingredient_complexity || null,
      methods: pkg.methods || [],
      equipment: canonicalEquipment(pkg.equipment),
      dietary_tags: pkg.dietary_labels || [],
      ingredients: pkg.display_ingredients || pkg.ingredients,
      steps: (pkg.steps || []).map((step) => ({
        title: step.title,
        body: step.body,
        ingredient_refs: step.ingredient_refs || [],
      })),
      substitutions: {},
    },
  };
}

/**
 * Published global versions only. Draft, certified-but-unpublished, QA failed,
 * retired, and household rows stay out of this result.
 * @param {object} db
 */
export async function loadPublishedCatalog(db) {
  try {
    const versions = await all(
      db,
      `SELECT v.recipe_version_id, v.recipe_id, v.dish_id, v.version_number, v.title, v.description,
              v.base_servings, v.prep_minutes, v.cook_minutes, v.total_minutes,
              v.effort_level, v.ingredient_complexity, v.classification_hash, v.heat,
              v.doneness, v.methods_json, v.dietary_tags_json, v.substitutions_json, v.components_json,
              v.publication_status, v.artifact_publication_status, v.visibility, v.household_id,
              v.content_hash, v.source_contract, v.source_path,
              d.slug, d.title AS dish_title, d.name, d.description AS dish_description, d.cuisine,
              d.meal_format, d.primary_ingredient, d.texture, d.flavor_profile,
              d.weeknight, d.exploration, d.plate, d.tone, d.tags_json, d.sparks_json, d.chips_json
         FROM catalog_version v
         JOIN catalog_dish d ON d.dish_id = v.dish_id
        WHERE v.publication_status = 'published'
          AND v.visibility = 'global'
          AND v.household_id IS NULL
        ORDER BY d.slug ASC`
    );
    const ids = versions.map((row) => row.recipe_version_id);
    if (!ids.length) {
      return { ok: true, source: "d1", count: 0, records: [], meals: [], planner: [], versionsById: {} };
    }
    const placeholders = ids.map(() => "?").join(",");
    const [ingredients, steps, taste, dietary, allergens, equipment, eligibility, images, provenance] =
      await Promise.all([
        all(db, `SELECT * FROM catalog_ingredient WHERE recipe_version_id IN (${placeholders})`, ...ids),
        all(db, `SELECT * FROM catalog_step WHERE recipe_version_id IN (${placeholders})`, ...ids),
        all(db, `SELECT * FROM catalog_taste_tag WHERE recipe_version_id IN (${placeholders})`, ...ids),
        all(db, `SELECT * FROM catalog_dietary_label WHERE recipe_version_id IN (${placeholders})`, ...ids),
        all(db, `SELECT * FROM catalog_allergen WHERE recipe_version_id IN (${placeholders})`, ...ids),
        all(db, `SELECT * FROM catalog_equipment WHERE recipe_version_id IN (${placeholders})`, ...ids),
        all(db, `SELECT * FROM catalog_eligibility_tag WHERE recipe_version_id IN (${placeholders})`, ...ids),
        all(db, `SELECT * FROM catalog_image_ref WHERE recipe_version_id IN (${placeholders})`, ...ids),
        all(db, `SELECT * FROM catalog_provenance WHERE recipe_version_id IN (${placeholders})`, ...ids),
      ]);
    const children = {
      ingredients: groupBy(ingredients),
      steps: groupBy(steps),
      taste: groupBy(taste),
      dietary: groupBy(dietary),
      allergens: groupBy(allergens),
      equipment: groupBy(equipment),
      eligibility: groupBy(eligibility),
      images: groupBy(images),
      provenance: new Map(provenance.map((row) => [row.recipe_version_id, row])),
    };
    const records = versions
      .map((row) => {
        const record = recordFromParts(row, children);
        record.source_contract = row.source_contract;
        return record;
      })
      .filter((record) => isNormallyRecommendable(record));
    const planner = records.map(plannerEntryFromRecord);
    const meals = records.map(recommendationMealFromRecord);
    /** @type {Record<string, object>} */
    const versionsById = {};
    for (const entry of planner) versionsById[entry.pkg.recipe_version_id] = entry;
    return {
      ok: true,
      source: "d1",
      count: records.length,
      records,
      meals,
      planner,
      versionsById,
    };
  } catch (error) {
    const message = String((error && error.message) || error);
    if (/no such table/i.test(message)) {
      return { ok: false, error: "catalog_unavailable", detail: message };
    }
    return { ok: false, error: "catalog_unavailable", detail: message };
  }
}

export function coverageFromMeals(meals) {
  /** @type {Record<string, number>} */
  const cuisines = {};
  for (const meal of meals || []) {
    const cuisine = meal.cuisine || "unknown";
    cuisines[cuisine] = (cuisines[cuisine] || 0) + 1;
  }
  return {
    total_meals: (meals || []).length,
    cuisines,
    source: "d1",
  };
}
