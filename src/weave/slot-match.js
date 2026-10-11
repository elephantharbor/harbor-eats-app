/**
 * Whether a planned meal already meets a slot refinement.
 * Diet labels live on the catalog package; saved meals keep concept tags.
 */

const VEGETARIAN = new Set(["vegetarian", "plant", "plant_based"]);

function tokensOf(meal) {
  return new Set(
    [
      ...(meal?.tags || []),
      ...(meal?.vocabulary_tag_ids || []),
      ...(meal?.dietary_labels || []),
      ...(meal?.dietary_tags || []),
      ...(meal?.styles || []),
      meal?.cuisine,
      meal?.ingredient,
      meal?.primary_ingredient,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
  );
}

function categoryMatch(meal, token) {
  const cat = String(token || "").toLowerCase();
  if (!cat) return false;
  const tokens = tokensOf(meal);
  if (cat === "plant") return [...tokens].some((value) => VEGETARIAN.has(value));
  if (tokens.has(cat)) return true;
  const allergens = new Set((meal?.allergens || []).map((value) => String(value).toLowerCase()));
  if (cat === "fish" && allergens.has("finfish")) return true;
  if (cat === "shellfish" && allergens.has("shellfish")) return true;
  if (cat === "seafood" && (allergens.has("finfish") || allergens.has("shellfish"))) return true;
  return false;
}

function requestedKeys(slot) {
  const keys = [];
  if (slot?.effort) keys.push("effort");
  if (slot?.ingredient_complexity) keys.push("ingredient_complexity");
  if (slot?.max_minutes != null) keys.push("max_minutes");
  if (slot?.special === true) keys.push("special");
  if (slot?.cuisine) keys.push("cuisine");
  if (slot?.meal_style) keys.push("meal_style");
  if (slot?.ingredient) keys.push("ingredient");
  if (slot?.category) keys.push("category");
  return keys;
}

function fieldSatisfied(meal, slot, key) {
  if (key === "effort") return meal.effort_level === slot.effort || meal.effort === slot.effort;
  if (key === "ingredient_complexity") return meal.ingredient_complexity === slot.ingredient_complexity;
  if (key === "max_minutes") {
    const minutes = meal.total_minutes ?? meal.minutes;
    return typeof minutes === "number" && minutes <= slot.max_minutes;
  }
  if (key === "special") return meal.special === true;
  if (key === "cuisine") return meal.cuisine === slot.cuisine || tokensOf(meal).has(String(slot.cuisine).toLowerCase());
  if (key === "meal_style") return tokensOf(meal).has(String(slot.meal_style).toLowerCase());
  if (key === "ingredient") return tokensOf(meal).has(String(slot.ingredient).toLowerCase());
  if (key === "category") return categoryMatch(meal, slot.category);
  return false;
}

/** True when every requested slot field is already true of this meal. */
export function mealSatisfiesSlot(meal, slot) {
  const keys = requestedKeys(slot);
  if (!meal || !keys.length) return false;
  return keys.every((key) => fieldSatisfied(meal, slot, key));
}

/** Attach catalog diet and taste tags the saved meal row does not store. */
export function enrichPreviousSlots(slots, catalog) {
  if (!slots || !catalog?.length) return slots;
  return slots.map((slot) => {
    const entry = catalog.find(
      (item) => item?.concept?.concept_id === slot.recipe_slug || item?.pkg?.recipe_version_id === slot.recipe_version_id
    );
    if (!entry) return slot;
    const merge = (left, right) => [...new Set([...(left || []), ...(right || [])])];
    return {
      ...slot,
      tags: merge(slot.tags, entry.concept?.tags),
      vocabulary_tag_ids: merge(slot.vocabulary_tag_ids, entry.pkg?.vocabulary_tag_ids),
      dietary_labels: merge(slot.dietary_labels, entry.pkg?.dietary_labels),
      allergens: merge(slot.allergens, entry.pkg?.allergens),
      cuisine: slot.cuisine || entry.concept?.cuisine || null,
      effort_level: slot.effort_level || entry.pkg?.effort_level || null,
      ingredient_complexity: slot.ingredient_complexity || entry.pkg?.ingredient_complexity || null,
      total_minutes: slot.total_minutes ?? entry.pkg?.total_minutes ?? null,
    };
  });
}
