/**
 * Meal identity: plan → option → explicit selection → recipe version → cook → rating.
 * Inspecting or previewing a meal never moves a rating onto it.
 */

import { householdIsSynthetic, productRows } from "./evidence-origin.js";

function byTime(rows, field) {
  return [...(rows || [])].sort((a, b) =>
    String(a[field] || a.created_at || "").localeCompare(String(b[field] || b.created_at || ""))
  );
}

/**
 * The meal a plan's outcome belongs to.
 * Rating wins, then the cook that matches it, then the earliest real cook,
 * then the latest explicit selection. The meal_option.selected flag is ignored
 * because opening another recipe used to flip it.
 */
export function resolvePlanOutcome({
  mealOptions = [],
  selections = [],
  cooks = [],
  ratings = [],
  household = null,
} = {}) {
  const visibleRatings = productRows(ratings, household);
  const visibleCooks = byTime(productRows(cooks, household), "cooked_at");
  const visibleSelections = byTime(productRows(selections, household), "created_at");

  let mealOptionId = null;
  let lock = "none";
  let cook = null;

  if (visibleRatings.length) {
    const ratedIds = [];
    for (const rating of visibleRatings) {
      if (rating.meal_option_id && !ratedIds.includes(rating.meal_option_id)) {
        ratedIds.push(rating.meal_option_id);
      }
    }
    const cookedMatch = visibleCooks.find((row) => ratedIds.includes(row.meal_option_id));
    mealOptionId = (cookedMatch && cookedMatch.meal_option_id) || ratedIds[0] || null;
    lock = "rating";
    cook = visibleCooks.find((row) => row.meal_option_id === mealOptionId) || null;
  } else if (visibleCooks.length) {
    cook = visibleCooks[0];
    mealOptionId = cook.meal_option_id;
    lock = "cook";
  } else if (visibleSelections.length) {
    const latest = visibleSelections[visibleSelections.length - 1];
    mealOptionId = latest.meal_option_id;
    lock = "selection";
  }

  const boundRatings = visibleRatings.filter((row) => row.meal_option_id === mealOptionId);
  const option =
    (mealOptions || []).find((row) => (row.meal_option_id || row.id) === mealOptionId) || null;
  return {
    meal_option_id: mealOptionId,
    lock,
    cook,
    ratings: boundRatings,
    option,
    outcome_locked: lock === "cook" || lock === "rating",
  };
}

export function selectionGuard(identity, nextMealOptionId) {
  const outcome = resolvePlanOutcome(identity || {});
  if (!outcome.outcome_locked) return { ok: true, lock: outcome.lock };
  if (nextMealOptionId && nextMealOptionId === outcome.meal_option_id) {
    return { ok: true, unchanged: true, meal_option_id: outcome.meal_option_id, lock: outcome.lock };
  }
  return {
    ok: false,
    error: "selection_locked",
    status: 409,
    meal_option_id: outcome.meal_option_id,
    lock: outcome.lock,
  };
}

export function cookGuard(identity, mealOptionId) {
  const outcome = resolvePlanOutcome(identity || {});
  const selectedId =
    outcome.lock === "selection" || outcome.outcome_locked
      ? outcome.meal_option_id
      : null;
  if (!selectedId || selectedId !== mealOptionId) {
    return {
      ok: false,
      error: "selection_required",
      status: 409,
      meal_option_id: selectedId,
    };
  }
  if (outcome.cook && outcome.cook.meal_option_id === mealOptionId) {
    return { ok: true, idempotent: true, cook_id: outcome.cook.cook_id || null };
  }
  if (outcome.outcome_locked && outcome.meal_option_id !== mealOptionId) {
    return { ok: false, error: "cook_locked", status: 409, meal_option_id: outcome.meal_option_id };
  }
  return { ok: true };
}

export function ratingGuard(identity, mealOptionId) {
  const outcome = resolvePlanOutcome(identity || {});
  if (!outcome.cook || outcome.cook.meal_option_id !== mealOptionId) {
    return {
      ok: false,
      error: "rating_requires_cooked_meal",
      status: 409,
      meal_option_id: outcome.cook ? outcome.cook.meal_option_id : null,
    };
  }
  return { ok: true, meal_option_id: mealOptionId };
}

/** Prefer the recipe version stored on the meal option. Never retarget a rating. */
export function canonicalRecipeVersion(mealOption, requestedVersion, existingVersion) {
  if (existingVersion) return existingVersion;
  if (mealOption && (mealOption.recipe_version || mealOption.recipe_version_id)) {
    return mealOption.recipe_version || mealOption.recipe_version_id;
  }
  return requestedVersion || null;
}

export function statusAfterSelection(currentStatus, { locked }) {
  if (locked) return currentStatus || "Selected";
  if (currentStatus === "Cooked" || currentStatus === "Rated") return currentStatus;
  return "Selected";
}

export function statusAfterCook(currentStatus) {
  if (currentStatus === "Rated") return "Rated";
  return "Cooked";
}

/**
 * Client navigation / cook / rate transitions.
 * Preview, cook entry, and cook exit do not move selection or ratings.
 */
export function reduceMealAction(state, action) {
  const current = state || {};
  const type = action && action.type;
  if (type === "preview" || type === "navigate") {
    return {
      ...current,
      previewMealId: action.mealOptionId,
      error: null,
    };
  }
  if (type === "select") {
    if (
      current.outcomeLocked &&
      current.selectedMealId &&
      action.mealOptionId !== current.selectedMealId
    ) {
      return { ...current, error: "selection_locked" };
    }
    const by = current.ratingsByOption || {};
    const bucket = by[action.mealOptionId] || {};
    return {
      ...current,
      error: null,
      selectedMealId: action.mealOptionId,
      previewMealId: action.mealOptionId,
      lifecycle: current.outcomeLocked ? current.lifecycle : "Selected",
      ratings: bucket,
    };
  }
  if (type === "begin_cook") {
    return {
      ...current,
      cookingMealId: action.mealOptionId,
      error: null,
    };
  }
  if (type === "exit_cook") {
    return {
      ...current,
      cookingMealId: null,
      error: null,
    };
  }
  if (type === "finish_cook") {
    if (!current.cookingMealId || current.cookingMealId !== current.selectedMealId) {
      return { ...current, committed: false, error: "cook_requires_explicit_selection" };
    }
    if (
      current.outcomeLocked &&
      current.lockedMealOptionId &&
      current.lockedMealOptionId !== current.cookingMealId
    ) {
      return { ...current, committed: false, error: "cook_locked" };
    }
    if (current.lifecycle === "Cooked" || current.lifecycle === "Rated") {
      return { ...current, committed: false, error: "already_cooked" };
    }
    return {
      ...current,
      lifecycle: "Cooked",
      outcomeLocked: true,
      lockedMealOptionId: current.cookingMealId,
      committed: true,
      error: null,
    };
  }
  if (type === "rate") {
    const mealId = current.selectedMealId;
    if (!mealId) return { ...current, error: "rating_requires_selected_meal" };
    if (current.outcomeLocked && current.lockedMealOptionId && current.lockedMealOptionId !== mealId) {
      return { ...current, error: "rating_locked" };
    }
    const by = { ...(current.ratingsByOption || {}) };
    const bucket = { ...(by[mealId] || {}) };
    const prev = bucket[action.memberId];
    bucket[action.memberId] = {
      score: action.score,
      note: (prev && prev.note) || "",
      recipe_version_id: (prev && prev.recipe_version_id) || action.recipeVersionId || null,
    };
    by[mealId] = bucket;
    return { ...current, ratingsByOption: by, ratings: bucket, error: null };
  }
  if (type === "abandon_selection") {
    if (current.outcomeLocked) return { ...current, error: "selection_locked" };
    return {
      ...current,
      selectedMealId: null,
      lifecycle: "Unselected",
      cookingMealId: null,
      error: null,
    };
  }
  return { ...current, error: null };
}

/**
 * History rows for one household. Ratings stay on the meal instance that owns them.
 * @param {{ plans: object[], options: object[], selections: object[], cooks: object[], ratings: object[], household?: object|null }} input
 */
export function historyFromActivity({ plans = [], options = [], selections = [], cooks = [], ratings = [], household = null }) {
  const items = [];
  for (const plan of plans) {
    if (!includePlan(plan, household)) continue;
    const planId = plan.plan_id;
    const outcome = resolvePlanOutcome({
      mealOptions: options.filter((row) => row.plan_id === planId),
      selections: selections.filter((row) => row.plan_id === planId),
      cooks: cooks.filter((row) => row.plan_id === planId),
      ratings: ratings.filter((row) => row.plan_id === planId),
      household,
    });
    const option = outcome.option;
    const bound = outcome.ratings;
    const avg =
      bound.length > 0 ? bound.reduce((sum, row) => sum + Number(row.score), 0) / bound.length : null;
    const needed = Number(plan.active_member_count) || bound.length || 1;
    let rating_state = "none";
    let pending_feedback = false;
    let status = plan.status || "Generated";
    if (outcome.lock === "rating") {
      if (bound.length >= needed) {
        rating_state = "full";
        status = "Rated";
      } else {
        rating_state = "partial";
        status = "Cooked";
        pending_feedback = true;
      }
    } else if (outcome.lock === "cook") {
      rating_state = "awaiting";
      status = "Cooked";
      pending_feedback = true;
    } else if (outcome.lock === "selection") {
      status = "Selected";
      pending_feedback = true;
    }
    items.push({
      plan_id: planId,
      status,
      meal_option_id: outcome.meal_option_id,
      meal_name: option ? option.name || option.title : null,
      recipe_slug: option ? option.recipe_slug : null,
      recipe_version_id: option ? option.recipe_version || option.recipe_version_id || null : null,
      ratings: bound.map((row) => ({
        member_id: row.member_id,
        score: row.score,
        meal_option_id: row.meal_option_id,
        recipe_version_id: row.recipe_version_id || null,
      })),
      avg_score: avg,
      pending_feedback,
      rating_state,
      favorite: avg != null && avg >= 8.5,
      cooked_at: outcome.cook ? outcome.cook.cooked_at || null : null,
    });
  }
  return items;
}

function includePlan(plan, household) {
  if (householdIsSynthetic(household)) return true;
  if (plan && plan.data_origin === "synthetic") return false;
  return true;
}
