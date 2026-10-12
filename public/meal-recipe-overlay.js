/* global window */
/**
 * Client-side pin + per-dinner adaptation overlay (mirrors server meal-adaptation.js).
 */
(function (global) {
  function normalizeName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");
  }

  function mealAdaptation(meal) {
    const raw = meal && meal.adaptation;
    return raw && raw.override_json ? raw : null;
  }

  function resolvedPin(meal) {
    if (!meal || meal.kind === "leftovers" || meal.kind === "eating_out") return null;
    const ingredients = meal.pinned_ingredients || meal.ingredients || [];
    const steps = meal.pinned_steps || meal.steps || [];
    if (!ingredients.length && !steps.length) return null;
    return {
      recipe_version_id: meal.recipe_version_id,
      ingredients: ingredients.slice(),
      steps: steps.slice(),
      equipment: meal.pinned_equipment || meal.equipment || [],
    };
  }

  function effectiveRecipeView(meal) {
    const base = resolvedPin(meal);
    if (!base) return null;
    const row = mealAdaptation(meal);
    if (!row || row.recipe_version_id !== meal.recipe_version_id) return { ...base, adapted: false };
    const override = row.override_json || {};
    let ingredients = base.ingredients.slice();
    const steps = base.steps.map(function (s, idx) {
      const copy = Object.assign({}, s);
      if (!copy.step_number) copy.step_number = idx + 1;
      return copy;
    });
    const changedIng = new Set();
    const changedSteps = new Set();
    for (const op of override.ops || []) {
      if (op.op === "remove" && op.from_id) {
        ingredients = ingredients.filter(function (ing) {
          return ing.ingredient_id !== op.from_id;
        });
        changedIng.add(op.from_id);
      } else if (op.op === "replace" && op.from_id) {
        ingredients = ingredients.map(function (ing) {
          if (ing.ingredient_id !== op.from_id) return ing;
          changedIng.add(op.from_id);
          return Object.assign({}, ing, {
            ingredient_id: op.to_ingredient_id || op.to_name || ing.ingredient_id,
            name: op.to_name || ing.name,
            display_name: op.to_name || ing.display_name || ing.name,
          });
        });
      } else if (op.op === "add" && op.to_name) {
        ingredients.push({
          ingredient_id: op.to_ingredient_id || normalizeName(op.to_name),
          name: op.to_name,
          quantity: null,
          unit: null,
          optional: true,
        });
        changedIng.add(op.to_ingredient_id || op.to_name);
      }
      (op.step_notes || []).forEach(function (note) {
        const step = steps.find(function (s) {
          return s.step_number === note.step_number;
        });
        if (step) {
          step.body = ((step.body || "") + " " + (note.note || "")).trim();
          changedSteps.add(note.step_number);
        }
      });
    }
    (override.ops || []).forEach(function (op) {
      (op.step_notes || []).forEach(function (n) {
        changedSteps.add(n.step_number);
      });
    });
    return {
      ...base,
      ingredients,
      steps,
      adapted: true,
      _changedIngredientIds: changedIng,
      _changedStepNumbers: changedSteps,
      _override: override,
    };
  }

  function mergeIntoRecipe(recipe, meal) {
    if (!recipe || !meal) return recipe;
    const view = effectiveRecipeView(meal);
    if (!view || !view.adapted) return recipe;
    const out = Object.assign({}, recipe);
    out.ingredients = view.ingredients;
    out.steps = view.steps;
    out._adapted = true;
    out._changedIngredientIds = view._changedIngredientIds;
    out._changedStepNumbers = view._changedStepNumbers;
    out._override = view._override;
    return out;
  }

  function adaptationOpSummaries(meal) {
    const row = mealAdaptation(meal);
    if (!row) return [];
    const override = row.override_json || {};
    const pin = resolvedPin(meal);
    const summaries = [];
    (override.ops || []).forEach(function (op, idx) {
      let title = "Change";
      let detail = "";
      if (op.op === "replace") {
        const from = (pin.ingredients || []).find(function (i) {
          return i.ingredient_id === op.from_id;
        });
        title = (op.to_name || "Swap") + " instead of " + (from ? from.name : "an ingredient");
        detail = "Ingredients";
      } else if (op.op === "remove") {
        const from = (pin.ingredients || []).find(function (i) {
          return i.ingredient_id === op.from_id;
        });
        title = "Leave out " + (from ? from.name : "an ingredient");
        detail = "Ingredients";
      } else if (op.op === "add") {
        title = "Add " + (op.to_name || "an ingredient");
        detail = "Ingredients";
      }
      const steps = (op.step_notes || [])
        .map(function (n) {
          return "Step " + n.step_number;
        })
        .join(" · ");
      if (steps) detail = (detail ? detail + " · " : "") + steps;
      summaries.push({ index: idx, title, detail, op });
    });
    return summaries;
  }

  function adaptationChangeCount(meal) {
    return adaptationOpSummaries(meal).length;
  }

  global.FlavorWeaveMealRecipe = {
    mealAdaptation,
    effectiveRecipeView,
    mergeIntoRecipe,
    adaptationOpSummaries,
    adaptationChangeCount,
    resolvedPin,
  };
})(window);
