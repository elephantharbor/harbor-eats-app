import { WEEKDAYS } from "./constants.js";
import { dayScopedSoftCue } from "./semantics.js";
import { datesFromPlanMeals } from "./state.js";

const WEEKEND = new Set(["saturday", "sunday"]);

function slotPatchFromOp(op) {
  const patch = {};
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
    "intent_cue",
  ]) {
    if (op[key] !== undefined && op[key] !== null) patch[key] = op[key];
  }
  return patch;
}

function mealRowLabel(meal, _dated) {
  const date = meal?.scheduled_date || meal?.date || null;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    const d = new Date(`${date}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      const wd = WEEKDAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
      const short = wd.slice(0, 1).toUpperCase() + wd.slice(1, 3);
      const mon = d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      return `${short}, ${mon}`;
    }
  }
  const pos = Number(meal?.position);
  return Number.isInteger(pos) ? `Dinner ${pos}` : "Dinner";
}

function candidatesFromMeals(meals, dated) {
  return (meals || [])
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((meal) => ({
      position: meal.position,
      meal_id: meal.meal_id,
      label: mealRowLabel(meal, dated),
      title: meal.title || meal.recipe_title || "",
    }));
}

/**
 * When a slot directive cannot target exactly one dinner, hold pending_slot and return a conflict row.
 * @returns {{ conflict: object, pending_slot: object, state: object }|null}
 */
export function planSlotChoiceGate({ priorState, appliedState, delta, dinnerPlan, userText }) {
  const ops = (delta?.slot_ops || []).filter((op) => op && op.op !== "clear");
  if (!ops.length) return null;
  const meals = dinnerPlan?.meals || [];
  if (!meals.length) return null;
  const dated = datesFromPlanMeals(meals);
  const undated = !dated.length;
  const text = String(userText || "").toLowerCase();
  const weekend = /\b(?:the\s+)?weekend\b/.test(text);
  const named = WEEKDAYS.find((day) => new RegExp(`\\b${day}\\b`).test(text));
  const pending_slot = slotPatchFromOp(ops[0]);
  if (!Object.keys(pending_slot).length) return null;

  if (!undated && weekend) {
    const weekendMeals = meals.filter((m) => {
      const row = dated.find((d) => d.position === m.position);
      return row && WEEKEND.has(row.weekday);
    });
    if (weekendMeals.length >= 2) return null;
  }

  if (!undated && named) {
    const hits = dated.filter((row) => row.weekday === named);
    if (hits.length === 1) return null;
    if (hits.length === 0) {
      const state = { ...appliedState, pending_slot, slots: priorState?.slots || [] };
      return {
        pending_slot,
        conflict: {
          code: "slot_ambiguous",
          reason: "day_absent",
          asked: named,
          multi: false,
          candidates: candidatesFromMeals(meals, dated),
        },
        state,
      };
    }
    if (hits.length > 1) {
      const state = { ...appliedState, pending_slot, slots: priorState?.slots || [] };
      return {
        pending_slot,
        conflict: {
          code: "slot_ambiguous",
          reason: "multiple",
          asked: named,
          multi: false,
          candidates: hits.map((row) => {
            const meal = meals.find((m) => m.position === row.position);
            return {
              position: row.position,
              meal_id: meal?.meal_id,
              label: mealRowLabel(meal || row, dated),
              title: meal?.title || "",
            };
          }),
        },
        state,
      };
    }
  }

  if (undated && (named || weekend)) {
    const state = { ...appliedState, pending_slot, slots: priorState?.slots || [] };
    return {
      pending_slot,
      conflict: {
        code: "slot_ambiguous",
        reason: weekend ? "weekend_undated" : "undated",
        asked: weekend ? "weekend" : named,
        multi: weekend,
        candidates: candidatesFromMeals(meals, dated),
      },
      state,
    };
  }

  return null;
}

export function applyPendingSlotChoice(state, positions) {
  const pending = state?.pending_slot;
  if (!pending) return { ok: false, error: "pending_slot_missing" };
  const posList = (positions || []).map((p) => Number(p)).filter((p) => Number.isInteger(p) && p >= 1 && p <= 14);
  if (!posList.length) return { ok: false, error: "slot_choice_invalid" };
  const next = JSON.parse(JSON.stringify(state));
  delete next.pending_slot;
  for (const position of posList) {
    const existing = (next.slots || []).find((s) => Number(s.position) === position) || { position };
    const merged = { ...existing, position, ...pending };
    const rest = (next.slots || []).filter((s) => Number(s.position) !== position);
    rest.push(merged);
    next.slots = rest.sort((a, b) => (a.position || 0) - (b.position || 0));
  }
  return { ok: true, state: next };
}

/**
 * After plan dates change, re-check whether pending_slot can target exactly one dinner.
 * @returns {{ type: "apply", positions: number[] }|{ type: "choice", conflict: object, state: object, choice_copy: object }|null}
 */
export function reresolvePendingSlot({ state, userText, dinnerPlan }) {
  const pending = state?.pending_slot;
  if (!pending || !dinnerPlan?.meals?.length) return null;
  const meals = dinnerPlan.meals;
  const dated = datesFromPlanMeals(meals);
  const text = String(userText || "").toLowerCase();
  const weekend = /\b(?:the\s+)?weekend\b/.test(text);
  const named = WEEKDAYS.find((day) => new RegExp(`\\b${day}\\b`).test(text));
  const nextState = { ...state, pending_slot: pending };

  if (dated.length && weekend) {
    const hits = dated.filter((row) => WEEKEND.has(row.weekday));
    if (hits.length === 1) return { type: "apply", positions: [hits[0].position] };
    if (hits.length >= 2) {
      const conflict = {
        code: "slot_ambiguous",
        reason: "weekend_undated",
        asked: "weekend",
        multi: true,
        candidates: hits.map((row) => {
          const meal = meals.find((m) => m.position === row.position);
          return {
            position: row.position,
            meal_id: meal?.meal_id,
            label: mealRowLabel(meal || row, dated),
            title: meal?.title || "",
          };
        }),
      };
      return { type: "choice", conflict, state: nextState, choice_copy: choiceCopy(conflict) };
    }
  }

  if (dated.length && named) {
    const hits = dated.filter((row) => row.weekday === named);
    if (hits.length === 1) return { type: "apply", positions: [hits[0].position] };
    const conflict = {
      code: "slot_ambiguous",
      reason: hits.length === 0 ? "day_absent" : "multiple",
      asked: named,
      multi: false,
      candidates: (hits.length ? hits : dated).map((row) => {
        const meal = meals.find((m) => m.position === row.position);
        return {
          position: row.position,
          meal_id: meal?.meal_id,
          label: mealRowLabel(meal || row, dated),
          title: meal?.title || "",
        };
      }),
    };
    if (!hits.length) {
      conflict.candidates = candidatesFromMeals(meals, dated);
    }
    return { type: "choice", conflict, state: nextState, choice_copy: choiceCopy(conflict) };
  }

  if (!dated.length && (named || weekend)) {
    const conflict = {
      code: "slot_ambiguous",
      reason: weekend ? "weekend_undated" : "undated",
      asked: weekend ? "weekend" : named,
      multi: weekend,
      candidates: candidatesFromMeals(meals, dated),
    };
    return { type: "choice", conflict, state: nextState, choice_copy: choiceCopy(conflict) };
  }

  return null;
}

function weekdayOf(date) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return WEEKDAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
}

function addDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Slot patch a deterministic chooser can apply without another model call. */
export function inferSlotPatch(text) {
  const norm = String(text || "").toLowerCase();
  const patch = {};
  if (/\b(?:vegetarian|vegan|plant-based|plant based)\b/.test(norm)) patch.category = "plant";
  if (/\b(?:easier|easy)\b/.test(norm) && !/\bonly easy\b|\bnothing but easy\b/.test(norm)) patch.effort = "easy";
  if (/\b(?:lighten(?:\s+up)?|lighter)\b/.test(norm) || /\bgo\s+light\b/.test(norm) || /\blight\s+on\b/.test(norm)) {
    patch.intent_cue = "light";
  }
  if (/\bspecial\b/.test(norm) && !patch.intent_cue) patch.special = true;
  return patch;
}

function planRows(meals, today) {
  const dated = datesFromPlanMeals(meals);
  if (dated.length) return dated;
  if (!today || !meals?.length) return [];
  return meals
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((meal) => {
      const position = Number(meal.position);
      if (!Number.isInteger(position)) return null;
      const date = addDays(today, position - 1);
      return { position, date, weekday: date ? weekdayOf(date) : null };
    })
    .filter((row) => row && row.weekday);
}

function choiceCandidates(list, meals) {
  return list.map((row) => {
    const meal = (meals || []).find((item) => item.position === row.position);
    return {
      position: row.position,
      weekday: row.weekday || null,
      date: row.date || null,
      meal_id: meal?.meal_id,
      label: mealRowLabel(meal || row, list),
      title: meal?.title || "",
    };
  });
}

/**
 * Weekend language and a day-targeted soft cue never go to the model.
 * One match applies. Several matches open the chooser. None asks for days.
 */
export function resolveDeterministicPlan({ text = "", dinnerPlan = null, today = null } = {}) {
  const meals = dinnerPlan?.meals || [];
  if (!meals.length) return null;
  const scoped = dayScopedSoftCue(text);
  const weekend = /\b(?:the\s+)?weekend\b/i.test(String(text || ""));
  if (!scoped && !weekend) return null;
  const rows = planRows(meals, today);
  const patch = inferSlotPatch(text);
  if (scoped) patch.intent_cue = scoped.cue;
  const pool = scoped
    ? rows.filter((row) => row.weekday === scoped.weekday)
    : rows.filter((row) => WEEKEND.has(row.weekday));
  if (pool.length === 1) {
    return { type: "apply", positions: [pool[0].position], patch, rows };
  }
  if (pool.length > 1) {
    return {
      type: "choice",
      pending_slot: patch,
      conflict: {
        code: "slot_ambiguous",
        reason: "ambiguous_day",
        asked: scoped ? scoped.weekday : "weekend",
        multi: !scoped,
        prompt: scoped ? "Which dinner did you mean?" : "Which ones are the weekend?",
        candidates: choiceCandidates(pool, meals),
      },
    };
  }
  if (!rows.length) {
    return {
      type: "message",
      pending_slot: patch,
      acknowledgement: "Add days to this plan first.",
    };
  }
  const asked = scoped ? scoped.weekday : "weekend";
  return {
    type: "choice",
    pending_slot: patch,
    add_days: !scoped,
    conflict: {
      code: "slot_ambiguous",
      reason: scoped ? "day_absent" : "weekend_absent",
      asked,
      multi: !scoped,
      prompt: scoped ? "Which dinner did you mean?" : "Add days, or pick the dinners you mean.",
      candidates: choiceCandidates(rows, meals),
    },
  };
}

export function applyResolvedPatch(state, { positions, patch, rows }) {
  const next = JSON.parse(JSON.stringify(state || {}));
  delete next.pending_slot;
  if (patch?.intent_cue) {
    next.intent_cues = (next.intent_cues || []).filter((cue) => cue !== patch.intent_cue);
  }
  for (const position of positions || []) {
    const row = (rows || []).find((item) => Number(item.position) === Number(position));
    const existing = (next.slots || []).find((slot) => Number(slot.position) === Number(position)) || { position };
    const merged = { ...existing, position, ...(patch || {}) };
    if (row?.weekday) merged.weekday = row.weekday;
    if (row?.date) merged.date = row.date;
    const rest = (next.slots || []).filter((slot) => Number(slot.position) !== Number(position));
    rest.push(merged);
    next.slots = rest.sort((a, b) => (a.position || 0) - (b.position || 0));
  }
  return next;
}

export function choiceCopy(conflict) {
  const reason = conflict?.reason || "undated";
  const asked = conflict?.asked ? String(conflict.asked) : "";
  const cap = asked ? asked.charAt(0).toUpperCase() + asked.slice(1) : "";
  const contextByReason = {
    undated: "Your dinners don't have days yet.",
    day_absent: `There's no ${cap} in this plan.`,
    weekend_undated: "Your dinners don't have days yet.",
    weekend_absent: "There's no weekend in this plan.",
    ambiguous_day: conflict?.multi ? "More than one dinner matches." : "One dinner needs a pick.",
    multiple: conflict?.candidates?.length === 2 ? `Two dinners could be the ${asked} night.` : `Several dinners could match.`,
  };
  const questionByReason = {
    undated: "Which dinner did you mean?",
    day_absent: "Which dinner did you mean?",
    weekend_undated: "Which ones are the weekend?",
    weekend_absent: "Add days, or pick the dinners you mean.",
    ambiguous_day: conflict?.prompt || "Which dinner did you mean?",
    multiple: "Which dinner did you mean?",
  };
  return {
    context: contextByReason[reason] || contextByReason.undated,
    question: questionByReason[reason] || questionByReason.undated,
  };
}
