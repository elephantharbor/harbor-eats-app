/**
 * Client meal-identity transitions. Keep in sync with reduceMealAction
 * in src/lib/meal-identity.js (parity covered by unit tests).
 */
(function (root) {
  function reduceMealAction(state, action) {
    var current = state || {};
    var type = action && action.type;
    if (type === "preview" || type === "navigate") {
      return Object.assign({}, current, {
        previewMealId: action.mealOptionId,
        error: null,
      });
    }
    if (type === "select") {
      if (
        current.outcomeLocked &&
        current.selectedMealId &&
        action.mealOptionId !== current.selectedMealId
      ) {
        return Object.assign({}, current, { error: "selection_locked" });
      }
      var by = current.ratingsByOption || {};
      var bucket = by[action.mealOptionId] || {};
      return Object.assign({}, current, {
        error: null,
        selectedMealId: action.mealOptionId,
        previewMealId: action.mealOptionId,
        lifecycle: current.outcomeLocked ? current.lifecycle : "Selected",
        ratings: bucket,
      });
    }
    if (type === "begin_cook") {
      return Object.assign({}, current, {
        cookingMealId: action.mealOptionId,
        error: null,
      });
    }
    if (type === "exit_cook") {
      return Object.assign({}, current, {
        cookingMealId: null,
        error: null,
      });
    }
    if (type === "finish_cook") {
      if (!current.cookingMealId || current.cookingMealId !== current.selectedMealId) {
        return Object.assign({}, current, {
          committed: false,
          error: "cook_requires_explicit_selection",
        });
      }
      if (
        current.outcomeLocked &&
        current.lockedMealOptionId &&
        current.lockedMealOptionId !== current.cookingMealId
      ) {
        return Object.assign({}, current, { committed: false, error: "cook_locked" });
      }
      if (current.lifecycle === "Cooked" || current.lifecycle === "Rated") {
        return Object.assign({}, current, { committed: false, error: "already_cooked" });
      }
      return Object.assign({}, current, {
        lifecycle: "Cooked",
        outcomeLocked: true,
        lockedMealOptionId: current.cookingMealId,
        committed: true,
        error: null,
      });
    }
    if (type === "rate") {
      var mealId = current.selectedMealId;
      if (!mealId) return Object.assign({}, current, { error: "rating_requires_selected_meal" });
      if (current.outcomeLocked && current.lockedMealOptionId && current.lockedMealOptionId !== mealId) {
        return Object.assign({}, current, { error: "rating_locked" });
      }
      var ledger = Object.assign({}, current.ratingsByOption || {});
      var nextBucket = Object.assign({}, ledger[mealId] || {});
      var prev = nextBucket[action.memberId];
      nextBucket[action.memberId] = {
        score: action.score,
        note: (prev && prev.note) || "",
        recipe_version_id: (prev && prev.recipe_version_id) || action.recipeVersionId || null,
      };
      ledger[mealId] = nextBucket;
      return Object.assign({}, current, {
        ratingsByOption: ledger,
        ratings: nextBucket,
        error: null,
      });
    }
    if (type === "abandon_selection") {
      if (current.outcomeLocked) return Object.assign({}, current, { error: "selection_locked" });
      return Object.assign({}, current, {
        selectedMealId: null,
        lifecycle: "Unselected",
        cookingMealId: null,
        error: null,
      });
    }
    return Object.assign({}, current, { error: null });
  }

  root.MealIdentity = { reduceMealAction: reduceMealAction };
})(typeof window !== "undefined" ? window : globalThis);
