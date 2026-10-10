import { getTasteTerm } from "../lib/taste-vocabulary.js";
import { AUTHORITY_CLAIMS } from "./constants.js";

const CUE_LABELS = Object.freeze({
  cozy: "Cozy",
  fresh: "Fresh",
  filling: "Filling",
  light: "Not too heavy",
  comforting: "Comforting",
  summery: "Summery",
  special: "Special",
  restaurant_like: "Restaurant-style",
  weeknight: "Weeknight",
});

export function displayForToken(token, field) {
  const term = getTasteTerm(token);
  if (term?.display_name) return term.display_name;
  if (field === "exclude_categories" || field === "frequencies") return token;
  return token;
}

export function buildPlanningChips(state) {
  /** @type {{ id: string, label: string }[]} */
  const chips = [];
  if (state.dinner_count != null) chips.push({ id: "dinner_count", label: `${state.dinner_count} dinners` });
  if (state.keep_it_easy === true) chips.push({ id: "keep_it_easy", label: "Easy leaning" });
  if (state.keep_ingredients_simple === true) chips.push({ id: "keep_ingredients_simple", label: "Simple ingredients" });
  if (state.effort === "easy") chips.push({ id: "effort", label: "Only easy" });
  if (state.ingredient_complexity === "simple" && state.ingredient_complexity_hard) {
    chips.push({ id: "ingredient_complexity", label: "Only simple ingredients" });
  }
  if (state.max_minutes != null && state.max_minutes_hard) {
    chips.push({ id: "max_minutes", label: `Under ${state.max_minutes} min` });
  }
  for (const row of state.frequencies || []) {
    const { token, min_count: min, max_count: max } = row;
    if (max === 0) chips.push({ id: `exclude:${token}`, label: `No ${token}` });
    else if (min != null && max != null && min === max) chips.push({ id: `freq:${token}`, label: `${displayForToken(token)} ×${min}` });
    else if (min != null && max == null) chips.push({ id: `freq:${token}`, label: `${displayForToken(token)} ≥${min}` });
    else if (max != null) chips.push({ id: `freq:${token}`, label: `${displayForToken(token)} ≤${max}` });
  }
  for (const slug of state.include_ingredients || []) {
    chips.push({ id: `include:${slug}`, label: displayForToken(slug) });
  }
  for (const slug of state.cuisines || []) chips.push({ id: `cuisine:${slug}`, label: displayForToken(slug) });
  for (const slug of state.meal_styles || []) chips.push({ id: `style:${slug}`, label: displayForToken(slug) });
  for (const cue of state.intent_cues || []) chips.push({ id: `cue:${cue}`, label: CUE_LABELS[cue] || cue });
  for (const slot of state.slots || []) {
    if (slot.special) {
      const label = slot.weekday ? `${slot.weekday[0].toUpperCase()}${slot.weekday.slice(1)}: special` : "Special night";
      chips.push({ id: `slot:${slot.weekday || slot.date}:special`, label });
    }
    if (slot.effort === "easy" && slot.weekday) {
      chips.push({ id: `slot:${slot.weekday}:effort`, label: `${slot.weekday[0].toUpperCase()}${slot.weekday.slice(1)}: easy` });
    }
  }
  if (state.special_count != null && state.special_count > 0 && !(state.slots || []).some((s) => s.special)) {
    chips.push({ id: "special_count", label: `Something special ×${state.special_count}` });
  }
  return chips;
}

export function buildDiscoveryChips(state) {
  const chips = [];
  if (state.keep_it_easy === true) chips.push({ id: "keep_it_easy", label: "Easy leaning" });
  if (state.keep_ingredients_simple === true) chips.push({ id: "keep_ingredients_simple", label: "Simple ingredients" });
  for (const slug of state.ingredients || []) chips.push({ id: `ingredient:${slug}`, label: displayForToken(slug) });
  for (const slug of state.cuisines || []) chips.push({ id: `cuisine:${slug}`, label: displayForToken(slug) });
  for (const slug of state.flavors || []) chips.push({ id: `flavor:${slug}`, label: displayForToken(slug) });
  for (const cue of state.intent_cues || []) chips.push({ id: `cue:${cue}`, label: CUE_LABELS[cue] || cue });
  if (state.quick) chips.push({ id: "quick", label: "Quick" });
  if (state.effort_levels?.includes("easy")) chips.push({ id: "effort:easy", label: "Only easy" });
  return chips;
}

function frequencyPhrases(state) {
  const parts = [];
  for (const row of state?.frequencies || []) {
    if (row.max_count === 0) continue;
    const name = displayForToken(row.token);
    if (row.min_count != null && row.max_count != null && row.min_count === row.max_count) parts.push(`${name} ×${row.min_count}`);
    else if (row.min_count != null && row.max_count == null) parts.push(`${name} ≥${row.min_count}`);
    else if (row.max_count != null) parts.push(`${name} ≤${row.max_count}`);
  }
  return parts;
}

function phrasePartsPlanning(state, notes = {}) {
  const parts = [];
  if (state.dinner_count != null) {
    if (notes.dinnerCountDefaulted && notes.dinnerCountUsual) parts.push(`${state.dinner_count} dinners, your usual`);
    else if (notes.dinnerCountDefaulted) parts.push(`Planned ${state.dinner_count} dinners`);
    else parts.push(`${state.dinner_count} dinners`);
  }
  if (state.keep_it_easy === true) parts.push("Easy leaning");
  parts.push(...frequencyPhrases(state));
  for (const cue of state.intent_cues || []) parts.push(CUE_LABELS[cue] || cue);
  return parts;
}

function conflictLabel(conflict) {
  const display = displayForToken(conflict.token, conflict.field);
  return display.charAt(0).toUpperCase() + display.slice(1);
}

function conflictNames(conflicts) {
  const labels = [];
  for (const conflict of conflicts || []) {
    const label = conflictLabel(conflict);
    if (!labels.includes(label)) labels.push(label);
  }
  if (labels.length <= 1) return labels[0] || "That";
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayName(date) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return WEEKDAY_NAMES[parsed.getUTCDay()];
}

function dayLabel(slot, previous) {
  if (slot?.weekday) return slot.weekday.charAt(0).toUpperCase() + slot.weekday.slice(1);
  return weekdayName(slot?.scheduled_date || previous?.scheduled_date);
}

/**
 * A refinement either names the dinner that moved or explains a no-op.
 * @returns {{ text: string, suggestions: string[] }|null}
 */
export function refinementAcknowledgement({ preview, previousSlots, slots }) {
  const previous = previousSlots || [];
  if (!previous.length) return null;
  const changed = preview?.changed_positions || [];
  if (changed.length && preview?.slots) {
    const bits = [];
    for (const position of changed) {
      const slot = preview.slots.find((row) => row.position === position);
      const prev = (previousSlots || []).find((row) => row.position === position);
      if (!slot?.title) continue;
      const day = dayLabel(slot, prev) || weekdayName(slot.scheduled_date || prev?.scheduled_date);
      const when = day ? `${day}'s now` : `Dinner ${position} is now`;
      const mins = slot.total_minutes != null ? `, about ${slot.total_minutes} min` : "";
      bits.push(`${when} ${slot.title}${mins}`);
    }
    if (bits.length) return { text: bits.join(". ").slice(0, 120), suggestions: [] };
  }
  for (const slot of slots || []) {
    if (slot.effort !== "easy") continue;
    const prev =
      (previousSlots || []).find((row) => row.position === slot.position) ||
      (previousSlots || []).find((row) => weekdayName(row.scheduled_date)?.toLowerCase() === slot.weekday);
    if (!prev) continue;
    const position = slot.position || prev.position;
    if (changed.includes(position)) continue;
    if (prev.effort_level !== "easy" && prev.effort !== "easy") continue;
    const day = dayLabel(slot, prev) || "That night";
    return {
      text: `${day}'s already one of the easiest options`,
      suggestions: [`Swap ${day} for a different easy dinner`],
    };
  }
  return null;
}

export const NO_RESULTS_SUGGESTIONS = Object.freeze(["Try fish", "Make it easier", "Clear a filter"]);

export function noResultsAcknowledgement(conflicts) {
  if (conflicts?.length) {
    return `I can't use ${conflictNames(conflicts)} for everyone at your table. No dinners match — try a broader search.`.slice(0, 120);
  }
  return "No dinners match that. Try fish, something easier, or clear a filter.";
}

function withFrequencyCaps(text, state) {
  let next = text;
  for (const phrase of frequencyPhrases(state)) {
    if (next.toLowerCase().includes(phrase.toLowerCase())) continue;
    if (next.length + phrase.length + 3 > 120) continue;
    next = `${next} · ${phrase}`;
  }
  return next.slice(0, 120);
}

export function reconciledAcknowledgement(task, state, conflicts, notes = {}) {
  if (notes.refinement?.text) return withFrequencyCaps(notes.refinement.text, state);
  const unfilled = (conflicts || []).find((row) => row.code === "frequency_unfilled");
  if (unfilled) {
    const name = displayForToken(unfilled.token, "frequencies");
    return `I could only plan ${unfilled.placed} ${name}; you asked for ${unfilled.min_count}.`.slice(0, 120);
  }
  const hard = (conflicts || []).filter((row) => row.code !== "frequency_unfilled");
  if (hard.length) {
    const names = conflictNames(hard);
    const fish = hard.some((row) => row.alternative?.kind === "category" && row.alternative.token === "fish");
    if (fish && task === "planning_intent") {
      return `I can't use ${names} for everyone at your table, so these dinners are fish.`.slice(0, 120);
    }
    if (fish) return `I can't use ${names} for everyone at your table, so I looked for fish.`.slice(0, 120);
    return `I can't use ${names} for everyone at your table, so I left that out.`.slice(0, 120);
  }
  const parts = task === "planning_intent" ? phrasePartsPlanning(state, notes) : buildDiscoveryChips(state).map((c) => c.label);
  if (!parts.length) return "Got it.";
  return parts.join(" · ").slice(0, 120);
}

export function shouldKeepModelAcknowledgement(ack, conflicts, dropped, removedTokens, userText) {
  if (!ack || ack === "Got it.") return false;
  if (userText && ack.trim().toLowerCase() === String(userText).trim().toLowerCase()) return false;
  if (AUTHORITY_CLAIMS.test(ack)) return false;
  if ((conflicts || []).length) return false;
  if ((dropped || []).length) return false;
  if ((removedTokens || []).length) return false;
  const lower = ack.toLowerCase();
  for (const token of removedTokens || []) {
    if (lower.includes(String(token).toLowerCase())) return false;
    const display = displayForToken(token);
    if (display && lower.includes(display.toLowerCase())) return false;
  }
  return true;
}

export function reconcileAcknowledgement({
  task,
  modelAck,
  state,
  conflicts,
  dropped,
  removedTokens,
  userText,
  dinnerCountDefaulted,
  dinnerCountUsual,
  refinement,
}) {
  const notes = {
    dinnerCountDefaulted: dinnerCountDefaulted === true,
    dinnerCountUsual: dinnerCountUsual === true,
    refinement: refinement || null,
  };
  const suggestions = refinement?.suggestions || [];
  if (!notes.refinement && !notes.dinnerCountDefaulted && shouldKeepModelAcknowledgement(modelAck, conflicts, dropped, removedTokens, userText)) {
    const text = withFrequencyCaps(String(modelAck).trim(), state);
    const source = text === String(modelAck).trim() ? "model" : "reconciled";
    return { acknowledgement: text, acknowledgement_source: source, suggestions };
  }
  return {
    acknowledgement: reconciledAcknowledgement(task, state, conflicts, notes),
    acknowledgement_source: "reconciled",
    suggestions,
  };
}
