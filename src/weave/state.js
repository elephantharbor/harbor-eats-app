import { INTENT_CUES, PLAN_TOKENS, WEEKDAYS } from "./constants.js";

export const FALLBACK_DINNER_COUNT = 3;

/** Last plan length when it is a real count; otherwise the household fallback of 3. */
export function usualDinnerCount(mealCount) {
  const n = Number(mealCount);
  if (Number.isInteger(n) && n >= 1 && n <= 14) return { count: n, usual: true };
  return { count: FALLBACK_DINNER_COUNT, usual: false };
}

/** Dates live on meals (`scheduled_date`), not on `plan.scheduled_dates`. */
export function datesFromPlanMeals(meals) {
  const dates = [];
  for (const meal of meals || []) {
    const date = meal?.scheduled_date || meal?.date || null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) continue;
    const position = Number(meal.position);
    if (!Number.isInteger(position)) continue;
    dates.push({ position, date: String(date), weekday: weekdayFromDate(String(date)) });
  }
  return dates.sort((a, b) => a.position - b.position);
}

export function emptyPlanningState() {
  return {
    dinner_count: null,
    date_start: null,
    date_end: null,
    keep_it_easy: null,
    keep_ingredients_simple: null,
    max_minutes: null,
    max_minutes_hard: false,
    effort: null,
    ingredient_complexity: null,
    ingredient_complexity_hard: false,
    special_count: null,
    cuisines: [],
    meal_styles: [],
    include_ingredients: [],
    exclude_ingredients: [],
    exclude_categories: [],
    frequencies: [],
    intent_cues: [],
    slots: [],
  };
}

export function emptyDiscoveryState() {
  return {
    text_residue: null,
    max_minutes: null,
    max_minutes_hard: false,
    quick: false,
    different: false,
    keep_it_easy: null,
    keep_ingredients_simple: null,
    cuisines: [],
    meal_styles: [],
    flavors: [],
    ingredients: [],
    exclude_ingredients: [],
    methods: [],
    equipment: [],
    textures: [],
    effort_levels: [],
    ingredient_complexities: [],
    protein_groups: [],
    diet: [],
    intent_cues: [],
  };
}

function sortUnique(list) {
  return [...new Set(list)].sort((a, b) => String(a).localeCompare(String(b)));
}

function applyListOp(state, field, op, value) {
  const cur = [...(state[field] || [])];
  const v = String(value).trim().toLowerCase();
  if (op === "add") {
    if (!cur.includes(v)) cur.push(v);
  } else if (op === "remove") {
    const i = cur.indexOf(v);
    if (i >= 0) cur.splice(i, 1);
  }
  state[field] = sortUnique(cur);
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function parseDate(s) {
  if (!s || typeof s !== "string") return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function weekdayFromDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return names[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function inDateWindow(dateStr, today) {
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 21);
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d >= start && d <= end;
}

function resolveSlotTarget(op, context, _state) {
  const kind = op.target_kind;
  const target = String(op.target || "").toLowerCase();
  if (kind === "date") {
    const date = parseDate(target);
    if (!date || !inDateWindow(date, context.today)) return null;
    return { date, weekday: weekdayFromDate(date) };
  }
  if (kind === "weekday") {
    if (!WEEKDAYS.includes(target)) return null;
    const dates = context.dates || [];
    const hit = dates.find((row) => row.weekday === target);
    if (hit) return { date: hit.date, weekday: target, position: hit.position };
    return { date: null, weekday: target, position: null };
  }
  if (kind === "position") {
    const pos = Number.parseInt(target, 10);
    if (!Number.isInteger(pos) || pos < 1 || pos > 14) return null;
    const dates = context.dates || [];
    const hit = dates.find((row) => row.position === pos);
    return { position: pos, date: hit?.date || null, weekday: hit?.weekday || null };
  }
  return null;
}

function slotKey(slot) {
  if (slot.date) return `d:${slot.date}`;
  if (slot.weekday) return `w:${slot.weekday}`;
  if (slot.position != null) return `p:${slot.position}`;
  return null;
}

function mergeSlot(existing, patch) {
  const out = { ...existing };
  for (const key of [
    "effort",
    "ingredient_complexity",
    "max_minutes",
    "max_minutes_hard",
    "special",
    "cuisine",
    "meal_style",
    "ingredient",
    "category",
  ]) {
    if (patch[key] !== undefined && patch[key] !== null) out[key] = patch[key];
  }
  return out;
}

function postValidatePlanning(state, vocabulary, dropped) {
  const vocab = vocabulary || {};
  const keepList = (field, allowed) => {
    const src = state[field] || [];
    const ok = new Set((allowed || []).map((v) => String(v).toLowerCase()));
    const kept = [];
    for (const item of src) {
      const v = String(item).toLowerCase();
      if (ok.has(v)) kept.push(v);
      else dropped.push({ field, value: item });
    }
    state[field] = sortUnique(kept);
  };
  keepList("cuisines", vocab.cuisines);
  keepList("meal_styles", vocab.meal_styles);
  keepList("include_ingredients", vocab.ingredients);
  keepList("exclude_ingredients", vocab.ingredients);
  const planSet = new Set(PLAN_TOKENS);
  state.exclude_categories = (state.exclude_categories || []).filter((t) => {
    if (planSet.has(t)) return true;
    dropped.push({ field: "exclude_categories", value: t });
    return false;
  });
  state.frequencies = (state.frequencies || []).filter((row) => {
    if (planSet.has(row.token)) return true;
    dropped.push({ field: "frequencies", value: row.token });
    return false;
  });
  state.intent_cues = (state.intent_cues || []).filter((c) => {
    if (INTENT_CUES.includes(c)) return true;
    dropped.push({ field: "intent_cues", value: c });
    return false;
  });
  if (state.intent_cues.length > 4) {
    dropped.push({ field: "intent_cues", value: "truncated" });
    state.intent_cues = state.intent_cues.slice(0, 4);
  }
  state.intent_cues = sortUnique(state.intent_cues);
}

function postValidateDiscovery(state, vocabulary, dropped) {
  const vocab = vocabulary || {};
  const map = {
    cuisines: vocab.cuisines,
    meal_styles: vocab.meal_styles,
    flavors: vocab.flavors,
    ingredients: vocab.ingredients,
    exclude_ingredients: vocab.ingredients,
    textures: vocab.textures,
  };
  for (const [field, allowed] of Object.entries(map)) {
    const ok = new Set((allowed || []).map((v) => String(v).toLowerCase()));
    state[field] = (state[field] || []).filter((item) => {
      const v = String(item).toLowerCase();
      if (ok.has(v)) return true;
      dropped.push({ field, value: item });
      return false;
    });
    state[field] = sortUnique(state[field]);
  }
  state.intent_cues = (state.intent_cues || []).filter((c) => {
    if (INTENT_CUES.includes(c)) return true;
    dropped.push({ field: "intent_cues", value: c });
    return false;
  });
  if (state.intent_cues.length > 4) state.intent_cues = state.intent_cues.slice(0, 4);
  state.intent_cues = sortUnique(state.intent_cues);
}

function inferDinnerCountFromDates(state, context) {
  const start = parseDate(state.date_start);
  const end = parseDate(state.date_end);
  if (!start || !end || end < start) return null;
  const today = context.today;
  const from = start < today ? today : start;
  let count = 0;
  const cur = new Date(`${from}T12:00:00Z`);
  const endD = new Date(`${end}T12:00:00Z`);
  while (cur <= endD && count < 14) {
    count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count || null;
}

function autoFrequencies(state) {
  state.frequencies = state.frequencies || [];
  for (const slug of state.include_ingredients || []) {
    if ((state.frequencies || []).some((f) => f.token === slug)) continue;
    state.frequencies.push({ token: slug, min_count: 1, max_count: null });
  }
  for (const cat of state.exclude_categories || []) {
    if ((state.frequencies || []).some((f) => f.token === cat)) continue;
    state.frequencies.push({ token: cat, min_count: null, max_count: 0 });
  }
  state.frequencies.sort((a, b) => a.token.localeCompare(b.token));
}

function applyCueSideEffects(state) {
  if (state.intent_cues.includes("special") && state.special_count == null) {
    const hasSlot = (state.slots || []).some((s) => s.special === true);
    if (!hasSlot) state.special_count = 1;
  }
}

/** Words the user says that mean a closed intent cue. */
const CUE_ALIASES = new Map([
  ["not too heavy", "light"],
  ["heartier", "filling"],
  ["hearty", "filling"],
]);

const PORTION_COUNT_WORDS = Object.freeze([
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
]);

/**
 * Counts attached to individual cues. "two cozy dinners and one light one"
 * is 3 dinners, not both cues on every slot.
 * @returns {{ dinner_count: number, portions: { cue: string, count: number }[] }|null}
 */
export function parsePortionCounts(text) {
  const norm = String(text || "").toLowerCase();
  if (!norm) return null;
  const countAlt = [...PORTION_COUNT_WORDS, "\\d{1,2}"].join("|");
  const aliasAlt = [...CUE_ALIASES.keys()]
    .sort((a, b) => b.length - a.length)
    .map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const cueAlt = `${aliasAlt}|${INTENT_CUES.join("|")}`;
  const re = new RegExp(`\\b(${countAlt})\\s+(${cueAlt})\\b`, "g");
  const portions = [];
  for (const match of norm.matchAll(re)) {
    const raw = match[1];
    const count = /^\d+$/.test(raw) ? Number(raw) : PORTION_COUNT_WORDS.indexOf(raw) + 1;
    if (!Number.isInteger(count) || count < 1 || count > 14) continue;
    const cue = CUE_ALIASES.get(match[2]) || match[2];
    if (!INTENT_CUES.includes(cue)) continue;
    portions.push({ cue, count });
  }
  if (portions.length < 2) return null;
  if (new Set(portions.map((row) => row.cue)).size < 2) return null;
  const dinner_count = portions.reduce((sum, row) => sum + row.count, 0);
  if (dinner_count < 1 || dinner_count > 14) return null;
  return { dinner_count, portions };
}

function applyPortionOverlay(state, text) {
  const parsed = parsePortionCounts(text);
  if (!parsed) return false;
  state.dinner_count = parsed.dinner_count;
  state.intent_cues = [];
  const next = [];
  let position = 1;
  for (const portion of parsed.portions) {
    for (let i = 0; i < portion.count; i += 1) {
      const existing = (state.slots || []).find((slot) => Number(slot.position) === position) || { position };
      next.push({ ...existing, position, intent_cue: portion.cue });
      position += 1;
    }
  }
  state.slots = next;
  return true;
}

/** Weekday refinements the cached model delta may have omitted. */
function applyTextRefinements(state, text, context) {
  const norm = String(text || "").toLowerCase();
  if (!norm) return false;
  const day = WEEKDAYS.find((weekday) => new RegExp(`\\b${weekday}\\b`).test(norm));
  if (!day) return false;
  const vegetarian = /\b(vegetarian|vegan|plant-based|plant based|plant)\b/.test(norm);
  const easier = /\b(easier|easy)\b/.test(norm);
  if (!vegetarian && !easier) return false;
  const hit = (context.dates || []).find((row) => row.weekday === day);
  const patch = {
    weekday: day,
    date: hit?.date || null,
    position: hit?.position ?? null,
    category: vegetarian ? "plant" : null,
    effort: !vegetarian && easier ? "easy" : null,
  };
  const key = slotKey(patch);
  const existing = (state.slots || []).find((row) => slotKey(row) === key) || { ...patch };
  const merged = mergeSlot(existing, patch);
  merged.weekday = day;
  if (hit?.date) merged.date = hit.date;
  if (hit?.position != null) merged.position = hit.position;
  const rest = (state.slots || []).filter((row) => slotKey(row) !== key);
  rest.push(merged);
  state.slots = rest.sort((a, b) => (a.position || 0) - (b.position || 0));
  return true;
}

/**
 * @param {object|null} prior
 * @param {object} delta model output
 * @param {object} context { today, dates?, vocabulary? }
 */
export function applyPlanningDelta(prior, delta, context = {}) {
  const dropped = [];
  const state = cloneState({ ...emptyPlanningState(), ...(prior || {}) });
  for (const field of delta.clear || []) {
    if (field === "slots") state.slots = [];
    else if (field === "frequencies") state.frequencies = [];
    else if (field === "max_minutes_hard" || field === "ingredient_complexity_hard") state[field] = false;
    else if ([
      "cuisines",
      "meal_styles",
      "include_ingredients",
      "exclude_ingredients",
      "exclude_categories",
      "intent_cues",
    ].includes(field)) {
      state[field] = [];
    } else state[field] = null;
  }
  const scalars = [
    "dinner_count",
    "date_start",
    "date_end",
    "keep_it_easy",
    "keep_ingredients_simple",
    "max_minutes",
    "max_minutes_hard",
    "effort",
    "ingredient_complexity",
    "ingredient_complexity_hard",
    "special_count",
  ];
  for (const key of scalars) {
    if (delta[key] !== undefined && delta[key] !== null) state[key] = delta[key];
  }
  if (delta.max_minutes != null && delta.max_minutes_hard == null) state.max_minutes_hard = true;
  for (const op of delta.list_ops || []) applyListOp(state, op.field, op.op, op.value);
  for (const op of delta.frequency_ops || []) {
    if (op.op === "clear") {
      state.frequencies = (state.frequencies || []).filter((f) => f.token !== op.token);
    } else {
      const rest = (state.frequencies || []).filter((f) => f.token !== op.token);
      rest.push({
        token: op.token,
        min_count: op.min_count,
        max_count: op.max_count,
      });
      state.frequencies = rest.sort((a, b) => a.token.localeCompare(b.token));
    }
  }
  for (const op of delta.slot_ops || []) {
    if (op.op === "clear") {
      const resolved = resolveSlotTarget(op, context, state);
      if (!resolved) {
        dropped.push({ field: "slot_ops", value: "slot_target_unresolved" });
        continue;
      }
      const key = slotKey(resolved);
      state.slots = (state.slots || []).filter((s) => slotKey(s) !== key);
      continue;
    }
    const resolved = resolveSlotTarget(op, context, state);
    if (!resolved) {
      dropped.push({ field: "slot_ops", value: "slot_target_unresolved" });
      continue;
    }
    const key = slotKey(resolved);
    const existing = (state.slots || []).find((s) => slotKey(s) === key) || { ...resolved };
    const merged = mergeSlot(existing, {
      effort: op.effort,
      ingredient_complexity: op.ingredient_complexity,
      max_minutes: op.max_minutes,
      max_minutes_hard: op.max_minutes_hard,
      special: op.special,
      cuisine: op.cuisine,
      meal_style: op.meal_style,
      ingredient: op.ingredient,
      category: op.category,
    });
    const rest = (state.slots || []).filter((s) => slotKey(s) !== key);
    rest.push(merged);
    state.slots = rest.sort((a, b) => (a.position || 0) - (b.position || 0));
  }
  let dinner_count_defaulted = false;
  if (state.dinner_count == null) {
    const inferred = inferDinnerCountFromDates(state, context);
    if (inferred) state.dinner_count = inferred;
  }
  if (state.dinner_count == null) {
    const fallback = Number(context.dinner_count_default);
    if (Number.isInteger(fallback) && fallback >= 1 && fallback <= 14) {
      state.dinner_count = fallback;
      dinner_count_defaulted = true;
    }
  }
  if (state.dinner_count != null) {
    if (state.dinner_count < 1) {
      dropped.push({ field: "dinner_count", value: "clamped" });
      state.dinner_count = 1;
    }
    if (state.dinner_count > 14) {
      dropped.push({ field: "dinner_count", value: "clamped" });
      state.dinner_count = 14;
    }
  }
  autoFrequencies(state);
  applyCueSideEffects(state);
  postValidatePlanning(state, context.vocabulary, dropped);
  const portioned = applyPortionOverlay(state, context.user_text);
  if (portioned) dinner_count_defaulted = false;
  applyTextRefinements(state, context.user_text, context);
  return { state, dropped, dinner_count_defaulted, portioned };
}

export function applyDiscoveryDelta(prior, delta, context = {}) {
  const dropped = [];
  const state = cloneState(prior || emptyDiscoveryState());
  for (const field of delta.clear || []) {
    if (field === "quick" || field === "different") state[field] = false;
    else if (field === "max_minutes_hard") state[field] = false;
    else if ([
      "cuisines",
      "meal_styles",
      "flavors",
      "ingredients",
      "exclude_ingredients",
      "methods",
      "equipment",
      "textures",
      "effort_levels",
      "ingredient_complexities",
      "protein_groups",
      "diet",
      "intent_cues",
    ].includes(field)) {
      state[field] = [];
    } else state[field] = null;
  }
  const scalars = [
    "text_residue",
    "max_minutes",
    "max_minutes_hard",
    "quick",
    "different",
    "keep_it_easy",
    "keep_ingredients_simple",
  ];
  for (const key of scalars) {
    if (delta[key] !== undefined && delta[key] !== null) state[key] = delta[key];
  }
  if (delta.max_minutes != null && delta.max_minutes_hard == null) state.max_minutes_hard = true;
  for (const op of delta.list_ops || []) applyListOp(state, op.field, op.op, op.value);
  postValidateDiscovery(state, context.vocabulary, dropped);
  return { state, dropped };
}

export function isEmptyPlanningDelta(delta) {
  if (!delta || typeof delta !== "object") return true;
  const hasScalar = [
    "dinner_count",
    "date_start",
    "date_end",
    "keep_it_easy",
    "keep_ingredients_simple",
    "max_minutes",
    "max_minutes_hard",
    "effort",
    "ingredient_complexity",
    "ingredient_complexity_hard",
    "special_count",
  ].some((k) => delta[k] != null);
  if (hasScalar) return false;
  if ((delta.clear || []).length) return false;
  if ((delta.list_ops || []).length) return false;
  if ((delta.frequency_ops || []).length) return false;
  if ((delta.slot_ops || []).length) return false;
  return true;
}

export function isEmptyDiscoveryDelta(delta) {
  if (!delta || typeof delta !== "object") return true;
  const hasScalar = [
    "text_residue",
    "max_minutes",
    "max_minutes_hard",
    "quick",
    "different",
    "keep_it_easy",
    "keep_ingredients_simple",
  ].some((k) => delta[k] != null);
  if (hasScalar) return false;
  if ((delta.clear || []).length) return false;
  if ((delta.list_ops || []).length) return false;
  return true;
}
