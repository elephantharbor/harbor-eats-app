import { getTasteTerm } from "../lib/taste-vocabulary.js";
import { AUTHORITY_CLAIMS } from "./constants.js";
import { mealSatisfiesSlot } from "./slot-match.js";

const CUE_LABELS = Object.freeze({
  cozy: "Cozy",
  fresh: "Fresh",
  filling: "Filling",
  light: "Not too heavy",
  comforting: "Comforting",
  summery: "Summery",
  special: "Something special",
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
  for (const slug of state.exclude_ingredients || []) {
    chips.push({ id: `exclude:${slug}`, label: `No ${displayForToken(slug).toLowerCase()}` });
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
  for (const slug of state.exclude_ingredients || []) {
    chips.push({ id: `exclude:${slug}`, label: `No ${displayForToken(slug).toLowerCase()}` });
  }
  for (const slug of state.flavors || []) chips.push({ id: `flavor:${slug}`, label: spokenFlavor(slug) });
  for (const slug of state.protein_groups || []) chips.push({ id: `protein:${slug}`, label: titleToken(slug) });
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

function spokenFlavor(slug) {
  const term = getTasteTerm(slug);
  if (!term) return slug;
  const extra = (term.synonyms || []).find((word) => {
    const lower = String(word).toLowerCase();
    return lower && !term.slug.includes(lower) && !term.display_name.toLowerCase().includes(lower);
  });
  if (!extra) return term.display_name;
  return `${extra.charAt(0).toUpperCase()}${extra.slice(1)} and ${term.display_name.toLowerCase()}`;
}

function titleToken(slug) {
  const display = displayForToken(slug);
  if (display !== slug) return display;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function exclusionPhrases(state) {
  const parts = [];
  const push = (label) => {
    const phrase = `No ${label}`;
    if (!parts.some((row) => row.toLowerCase() === phrase.toLowerCase())) parts.push(phrase);
  };
  for (const slug of state?.exclude_ingredients || []) push(displayForToken(slug).toLowerCase());
  for (const slug of state?.exclude_categories || []) push(displayForToken(slug, "exclude_categories").toLowerCase());
  for (const row of state?.frequencies || []) {
    if (row.max_count === 0) push(displayForToken(row.token).toLowerCase());
  }
  return parts;
}

function appliedCuePhrases(state) {
  const parts = [];
  for (const slug of state?.flavors || []) parts.push(spokenFlavor(slug));
  for (const slug of state?.protein_groups || []) parts.push(titleToken(slug));
  for (const cue of state?.intent_cues || []) parts.push(CUE_LABELS[cue] || cue);
  return parts;
}

export function portionSummary(state) {
  const slots = [...(state?.slots || [])]
    .filter((slot) => slot?.intent_cue)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
  if (slots.length < 2) return [];
  const rows = [];
  for (const slot of slots) {
    const last = rows[rows.length - 1];
    if (last && last.cue === slot.intent_cue) last.count += 1;
    else rows.push({ cue: slot.intent_cue, count: 1 });
  }
  if (new Set(rows.map((row) => row.cue)).size < 2) return [];
  return rows;
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
  const portions = portionSummary(state);
  if (portions.length) {
    for (const row of portions) parts.push(`${row.count} ${row.cue}`);
  } else {
    for (const cue of state.intent_cues || []) parts.push(CUE_LABELS[cue] || cue);
  }
  parts.push(...exclusionPhrases(state));
  return parts;
}

function detailPhrases(state, task) {
  const phrases = [...exclusionPhrases(state)];
  if (task === "planning_intent") {
    if (!portionSummary(state).length) {
      for (const cue of state?.intent_cues || []) phrases.push(CUE_LABELS[cue] || cue);
    }
  } else {
    phrases.push(...appliedCuePhrases(state));
  }
  return phrases;
}

function appendMissing(text, phrases) {
  let next = String(text || "");
  for (const phrase of phrases) {
    if (!phrase) continue;
    if (next.toLowerCase().includes(phrase.toLowerCase())) continue;
    if (next.length + phrase.length + 3 > 120) continue;
    next = next ? `${next} · ${phrase}` : phrase;
  }
  return next.slice(0, 120);
}

const REQUEST_FLAVOR_WORDS = Object.freeze([
  "zesty",
  "lemony",
  "lemon",
  "limey",
  "citrusy",
  "citrus",
  "bright",
  "herby",
  "smoky",
  "spicy",
  "tangy",
  "garlicky",
]);

function withRequestFlavors(text, userText) {
  const source = String(userText || "").toLowerCase();
  const missing = REQUEST_FLAVOR_WORDS.filter(
    (word) => new RegExp(`\\b${word}\\b`).test(source) && !String(text || "").toLowerCase().includes(word)
  );
  if (!missing.length) return text;
  const lead = missing.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(", ");
  const body = String(text || "").trim();
  if (/^fish\b/i.test(body)) return `${lead} ${body.charAt(0).toLowerCase()}${body.slice(1)}`.slice(0, 120);
  if (!body) return lead.slice(0, 120);
  return `${lead} · ${body}`.slice(0, 120);
}

/** Join a cue clause without leaving a period sitting against a comma. */
function polishAcknowledgement(text) {
  return String(text || "")
    .replace(/\.?\s*·\s*Something special\b/gi, ", something special")
    .replace(/\.?\s*·\s*Special\b/g, ", something special")
    .replace(/\.\s*,\s*/g, ", ")
    .replace(/,\s*,+/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const SHELLFISH_TOKENS = new Set(["shrimp", "prawn", "prawns", "shellfish", "crab", "lobster", "scallop"]);

function conflictLabel(conflict) {
  if (SHELLFISH_TOKENS.has(String(conflict.token || "").toLowerCase())) return "Shellfish";
  const display = displayForToken(conflict.token, conflict.field);
  return display.charAt(0).toUpperCase() + display.slice(1);
}

function conflictNames(conflicts) {
  const labels = [];
  for (const conflict of conflicts || []) {
    const label = conflictLabel(conflict);
    if (!labels.includes(label)) labels.push(label);
  }
  const pretty = labels.map((label, index) => (index === 0 ? label : label.toLowerCase()));
  if (pretty.length <= 1) return pretty[0] || "That";
  if (pretty.length === 2) return `${pretty[0]} and ${pretty[1]}`;
  return `${pretty.slice(0, -1).join(", ")}, and ${pretty[pretty.length - 1]}`;
}

function worksForEveryone(conflicts) {
  const names = conflictNames(conflicts);
  const verb = names.includes(" and ") ? "don't" : "doesn't";
  return `${names} ${verb} work for everyone`;
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
      const requested = (slots || []).find((row) => Number(row.position) === Number(position));
      if (!slot?.title) continue;
      const day = dayLabel(requested, prev) || dayLabel(slot, prev) || weekdayName(slot.scheduled_date || prev?.scheduled_date);
      const when = day ? `${day}'s now` : `Dinner ${position} is now`;
      const mins = slot.total_minutes != null ? `, about ${slot.total_minutes} min` : "";
      bits.push(`${when} ${slot.title}${mins}`);
    }
    if (bits.length) return { text: bits.join(". ").slice(0, 120), suggestions: [] };
  }
  for (const slot of slots || []) {
    const prev =
      (previousSlots || []).find((row) => row.position === slot.position) ||
      (previousSlots || []).find((row) => weekdayName(row.scheduled_date)?.toLowerCase() === slot.weekday);
    if (!prev) continue;
    const position = slot.position || prev.position;
    if (changed.includes(position)) continue;
    if (!mealSatisfiesSlot(prev, slot)) continue;
    const day = dayLabel(slot, prev) || "That night";
    const other = Boolean(
      slot.category ||
        slot.cuisine ||
        slot.meal_style ||
        slot.ingredient ||
        slot.ingredient_complexity ||
        slot.max_minutes != null ||
        slot.special === true
    );
    if (slot.effort === "easy" && !other) {
      return {
        text: `${day}'s already one of the easiest options`,
        suggestions: [`Swap ${day} for a different easy dinner`],
      };
    }
    const bits = [];
    if (slot.category) bits.push(slot.category === "plant" ? "vegetarian" : displayForToken(slot.category).toLowerCase());
    if (slot.cuisine) bits.push(displayForToken(slot.cuisine).toLowerCase());
    if (slot.meal_style) bits.push(displayForToken(slot.meal_style).toLowerCase());
    if (slot.ingredient) bits.push(displayForToken(slot.ingredient).toLowerCase());
    if (slot.effort === "easy") bits.push("easy");
    else if (slot.effort) bits.push(slot.effort);
    if (slot.ingredient_complexity) bits.push(slot.ingredient_complexity);
    if (slot.max_minutes != null) bits.push(`under ${slot.max_minutes} min`);
    if (slot.special === true) bits.push("special");
    if (!bits.length) continue;
    const why = bits.join(" and ");
    return {
      text: `${day}'s already ${why}`,
      suggestions: [`Swap ${day} for a different ${why} dinner`],
    };
  }
  return null;
}

export const FIND_UNAVAILABLE_ACK = "Here's what I found for that.";
export const PLAN_PICKER_ACK = "Typing a request isn’t available right now. Choose how many below.";

export function planCountFallbackAck(count) {
  const n = Number(count);
  return `Here's a plan for ${n} ${n === 1 ? "dinner" : "dinners"}.`;
}

export function withRelaxation(ack, { relaxed, dish }) {
  const name = dish ? displayForToken(dish).toLowerCase() : "";
  const looked = name ? `fish ${name}` : "fish";
  const tail = `so I looked for ${looked} and dropped ${relaxed}.`;
  const source = String(ack || "");
  if (/so I looked for fish/.test(source)) return source.replace(/so I looked for fish\.?/, tail).slice(0, 120);
  const head = source.replace(/\.\s*$/, "");
  return `${head}. I dropped ${relaxed}.`.slice(0, 120);
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
    const head = worksForEveryone(hard);
    const fish = hard.some((row) => row.alternative?.kind === "category" && row.alternative.token === "fish");
    if (fish && task === "planning_intent") return `${head}, so these dinners are fish.`.slice(0, 120);
    if (fish) return `${head}, so I looked for fish.`.slice(0, 120);
    return `${head}, so I left that out.`.slice(0, 120);
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
  const phrases = detailPhrases(state, task);
  const portioned = task === "planning_intent" && portionSummary(state).length > 0;
  const finish = (text, source) => {
    const flavored = task === "discovery_intent" ? withRequestFlavors(text, userText) : text;
    const polished = polishAcknowledgement(flavored);
    const acknowledgement_source = polished === String(modelAck || "").trim() ? source : "reconciled";
    return { acknowledgement: polished, acknowledgement_source, suggestions };
  };
  if (!notes.refinement && !notes.dinnerCountDefaulted && !portioned && shouldKeepModelAcknowledgement(modelAck, conflicts, dropped, removedTokens, userText)) {
    const capped = withFrequencyCaps(String(modelAck).trim(), state);
    return finish(appendMissing(capped, phrases), "model");
  }
  return finish(appendMissing(reconciledAcknowledgement(task, state, conflicts, notes), phrases), "reconciled");
}
