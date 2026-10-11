/**
 * Deterministic chip inverse ops for D-06 (no model).
 */
export function removePlanningChip(state, chipId) {
  const next = JSON.parse(JSON.stringify(state || {}));
  if (!chipId) return next;
  if (chipId === "dinner_count") {
    next.dinner_count = null;
    return next;
  }
  if (chipId === "keep_it_easy") {
    next.keep_it_easy = null;
    return next;
  }
  if (chipId === "keep_ingredients_simple") {
    next.keep_ingredients_simple = null;
    return next;
  }
  if (chipId === "effort") {
    next.effort = null;
    return next;
  }
  if (chipId === "ingredient_complexity") {
    next.ingredient_complexity = null;
    next.ingredient_complexity_hard = false;
    return next;
  }
  if (chipId === "max_minutes") {
    next.max_minutes = null;
    next.max_minutes_hard = false;
    return next;
  }
  if (chipId === "special_count") {
    next.special_count = null;
    return next;
  }
  if (chipId.startsWith("freq:")) {
    const token = chipId.slice(5);
    next.frequencies = (next.frequencies || []).filter((f) => f.token !== token);
    return next;
  }
  if (chipId.startsWith("exclude:")) {
    const token = chipId.slice(8);
    next.frequencies = (next.frequencies || []).filter((f) => f.token !== token);
    next.exclude_categories = (next.exclude_categories || []).filter((t) => t !== token);
    next.exclude_ingredients = (next.exclude_ingredients || []).filter((t) => t !== token);
    return next;
  }
  if (chipId.startsWith("include:")) {
    const slug = chipId.slice(8);
    next.include_ingredients = (next.include_ingredients || []).filter((t) => t !== slug);
    return next;
  }
  if (chipId.startsWith("cuisine:")) {
    const slug = chipId.slice(8);
    next.cuisines = (next.cuisines || []).filter((t) => t !== slug);
    return next;
  }
  if (chipId.startsWith("style:")) {
    const slug = chipId.slice(6);
    next.meal_styles = (next.meal_styles || []).filter((t) => t !== slug);
    return next;
  }
  if (chipId.startsWith("cue:")) {
    const cue = chipId.slice(4);
    next.intent_cues = (next.intent_cues || []).filter((t) => t !== cue);
    return next;
  }
  if (chipId.startsWith("slot:")) {
    const rest = chipId.slice(5);
    const [day, kind] = rest.split(":");
    const position = /^p\d+$/.test(day || "") ? Number(day.slice(1)) : null;
    const targets = (s) => {
      if (position != null) return !s.weekday && Number(s.position) === position;
      if (day && s.weekday) return s.weekday === day;
      return true;
    };
    next.slots = (next.slots || []).filter((s) => {
      if (kind === "special" && s.special) return !targets(s);
      if (kind === "effort" && s.effort === "easy") return !targets(s);
      return true;
    });
    return next;
  }
  if (chipId === "exclude_cooking") {
    next.exclude_cooking = [];
    return next;
  }
  if (chipId === "semantic:vegetable_forward") {
    next.semantic_rank = (next.semantic_rank || []).filter((t) => t !== "vegetable_forward");
    return next;
  }
  return next;
}

export function removeDiscoveryChip(state, chipId) {
  const next = JSON.parse(JSON.stringify(state || {}));
  if (!chipId) return next;
  if (chipId === "keep_it_easy") {
    next.keep_it_easy = null;
    return next;
  }
  if (chipId === "keep_ingredients_simple") {
    next.keep_ingredients_simple = null;
    return next;
  }
  if (chipId === "quick") {
    next.quick = false;
    return next;
  }
  if (chipId === "effort:easy") {
    next.effort_levels = (next.effort_levels || []).filter((e) => e !== "easy");
    return next;
  }
  if (chipId.startsWith("ingredient:")) {
    const slug = chipId.slice(11);
    next.ingredients = (next.ingredients || []).filter((t) => t !== slug);
    return next;
  }
  if (chipId.startsWith("cuisine:")) {
    const slug = chipId.slice(8);
    next.cuisines = (next.cuisines || []).filter((t) => t !== slug);
    return next;
  }
  if (chipId.startsWith("flavor:")) {
    const slug = chipId.slice(7);
    next.flavors = (next.flavors || []).filter((t) => t !== slug);
    return next;
  }
  if (chipId.startsWith("exclude:")) {
    const slug = chipId.slice(8);
    next.exclude_ingredients = (next.exclude_ingredients || []).filter((t) => t !== slug);
    return next;
  }
  if (chipId.startsWith("exclude_term:")) {
    const slug = chipId.slice(13);
    next.exclude_terms = (next.exclude_terms || []).filter((t) => t !== slug);
    return next;
  }
  if (chipId.startsWith("protein:")) {
    const slug = chipId.slice(8);
    next.protein_groups = (next.protein_groups || []).filter((t) => t !== slug);
    return next;
  }
  if (chipId.startsWith("cue:")) {
    const cue = chipId.slice(4);
    next.intent_cues = (next.intent_cues || []).filter((t) => t !== cue);
    return next;
  }
  if (chipId === "exclude_cooking") {
    next.exclude_cooking = [];
    return next;
  }
  return next;
}

export function togglePlanningPref(state, key, on) {
  const next = JSON.parse(JSON.stringify(state || {}));
  if (key === "keep_it_easy") next.keep_it_easy = on ? true : null;
  if (key === "keep_ingredients_simple") next.keep_ingredients_simple = on ? true : null;
  return next;
}
