/**
 * D-01 planning-run chips and the swap-sheet lifecycle.
 * Preferences are for this plan only. They are not household Taste.
 */
(function (root) {
  function prefsFrom(intent) {
    const source = intent || {};
    return {
      keep_it_easy: source.keep_it_easy === true,
      keep_ingredients_simple: source.keep_ingredients_simple === true,
    };
  }

  function togglePref(prefs, key) {
    const next = prefsFrom(prefs);
    if (key === "keep_it_easy" || key === "keep_ingredients_simple") next[key] = !next[key];
    return next;
  }

  function toggleButton(key, label, on) {
    return (
      '<button type="button" class="chip-tog' +
      (on ? " is-on" : "") +
      '" data-plan-pref="' +
      key +
      '" aria-pressed="' +
      (on ? "true" : "false") +
      '">' +
      label +
      "</button>"
    );
  }

  function chipHtml(prefs, scope) {
    const current = prefsFrom(prefs);
    const which = scope === "active" ? "active" : "draft";
    return (
      '<div class="plan-prefs" data-plan-prefs="' +
      which +
      '" role="group" aria-label="For this plan">' +
      toggleButton("keep_it_easy", "Keep it easy", current.keep_it_easy) +
      toggleButton("keep_ingredients_simple", "Keep ingredients simple", current.keep_ingredients_simple) +
      "</div>"
    );
  }

  function badgeHtml(meal) {
    if (!meal) return "";
    const bits = [];
    if (meal.effort_level === "easy") bits.push('<span class="badge badge--sm">Easy</span>');
    if (meal.ingredient_complexity === "simple") bits.push('<span class="badge badge--sm">Simple ingredients</span>');
    return bits.join(" ");
  }

  /**
   * Swap sheet reducer. Keep and Escape dismiss without a mutation.
   * A failed swap stays open and does not raise a toast behind the sheet.
   * Success closes, then the caller may toast.
   */
  function swapSheetReduce(state, event) {
    const current = state || { open: false, mutated: false, toast: false, error: null, mealId: null };
    if (!event || !event.type) return current;
    if (event.type === "open") {
      return { open: true, mutated: false, toast: false, error: null, mealId: event.mealId || null };
    }
    if (event.type === "keep" || event.type === "escape" || event.type === "close") {
      return { open: false, mutated: false, toast: false, error: null, mealId: current.mealId };
    }
    if (event.type === "fail") {
      return {
        open: true,
        mutated: false,
        toast: false,
        error: event.message || "Couldn’t swap that dinner. Try another.",
        mealId: current.mealId,
      };
    }
    if (event.type === "success") {
      return { open: false, mutated: true, toast: true, error: null, mealId: current.mealId };
    }
    return current;
  }

  root.FlavorWeavePlanning = {
    prefsFrom: prefsFrom,
    togglePref: togglePref,
    chipHtml: chipHtml,
    badgeHtml: badgeHtml,
    swapSheetReduce: swapSheetReduce,
  };
})(window);
