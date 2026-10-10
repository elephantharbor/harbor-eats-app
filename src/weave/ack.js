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

function phrasePartsPlanning(state) {
  const parts = [];
  if (state.dinner_count != null) parts.push(`${state.dinner_count} dinners`);
  if (state.keep_it_easy === true) parts.push("Easy leaning");
  for (const row of state.frequencies || []) {
    if (row.max_count === 0) continue;
    if (row.min_count != null && row.max_count != null && row.min_count === row.max_count) {
      parts.push(`${displayForToken(row.token)} ×${row.min_count}`);
    }
  }
  for (const cue of state.intent_cues || []) parts.push(CUE_LABELS[cue] || cue);
  return parts;
}

export function reconciledAcknowledgement(task, state, conflicts) {
  const conflict = conflicts?.[0];
  if (conflict?.alternative?.kind === "category" && conflict.alternative.token === "fish") {
    const display = displayForToken(conflict.token, "include_ingredients");
    return `I can't use ${display} for everyone at your table, but I can find another seafood dinner.`.slice(0, 120);
  }
  if (conflict) {
    const display = displayForToken(conflict.token, conflict.field);
    return `I can't use ${display} for everyone at your table, so I left that out.`.slice(0, 120);
  }
  const parts = task === "planning_intent" ? phrasePartsPlanning(state) : buildDiscoveryChips(state).map((c) => c.label);
  if (!parts.length) return "Got it.";
  return parts.join(" · ").slice(0, 120);
}

export function shouldKeepModelAcknowledgement(ack, conflicts, dropped, removedTokens) {
  if (!ack || ack === "Got it.") return false;
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
}) {
  if (shouldKeepModelAcknowledgement(modelAck, conflicts, dropped, removedTokens)) {
    return { acknowledgement: modelAck, acknowledgement_source: "model" };
  }
  return {
    acknowledgement: reconciledAcknowledgement(task, state, conflicts),
    acknowledgement_source: "reconciled",
  };
}
