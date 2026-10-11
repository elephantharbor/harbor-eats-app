import { getTasteTerm } from "../lib/taste-vocabulary.js";
import { AUTHORITY_CLAIMS } from "./constants.js";
import { mealSatisfiesSlot } from "./slot-match.js";

const CUE_LABELS = Object.freeze({
  cozy: "Cozy",
  fresh: "Fresh",
  filling: "Filling",
  light: "Lighter",
  comforting: "Comforting",
  summery: "Summery",
  special: "Something special",
  restaurant_like: "Restaurant-style",
  weeknight: "Weeknight-friendly",
});

/** How a cue reads in front of "dinners" ("three cozy dinners"). `special` reads as its own clause. */
const CUE_ADJECTIVES = Object.freeze({
  cozy: "cozy",
  fresh: "fresh",
  filling: "filling",
  light: "light",
  comforting: "comforting",
  summery: "summery",
  restaurant_like: "restaurant-style",
  weeknight: "weeknight",
});

const PLAN_TOKEN_NOUNS = Object.freeze({
  plant: "vegetarian",
  soups: "soup",
  curries: "curry",
  stews: "stew",
  "stir-fries": "stir-fry",
});

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen"];
const MAX_ACK = 120;

function numberWord(n) {
  return NUMBER_WORDS[n] || String(n);
}

function times(n) {
  if (n === 1) return "once";
  if (n === 2) return "twice";
  return `${numberWord(n)} times`;
}

function capitalize(text) {
  const s = String(text || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function andJoin(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function sentence(text) {
  const body = String(text || "").trim();
  if (!body) return "";
  return /[.!?…]$/.test(body) ? body : `${body}.`;
}

function withoutPeriod(text) {
  return String(text || "").trim().replace(/\.+$/, "");
}

function weekdayShort(weekday) {
  return capitalize(String(weekday || "").slice(0, 3));
}

const RANK_CHIPS = Object.freeze({
  vegetable_forward: "Veggie-forward",
  crispy_non_fry: "Crispy",
});

function pushRankChips(chips, state) {
  for (const token of state?.semantic_rank || []) {
    const label = RANK_CHIPS[token];
    if (!label || chips.some((chip) => chip.id === `semantic:${token}`)) continue;
    chips.push({ id: `semantic:${token}`, label });
  }
}

export function displayForToken(token, field) {
  const term = getTasteTerm(token);
  if (term?.display_name) return term.display_name;
  if (field === "exclude_categories" || field === "frequencies") return token;
  return token;
}

/** A taste term as it reads mid-sentence: cuisines keep their capital, everything else is lowercase. */
function spokenToken(token) {
  if (PLAN_TOKEN_NOUNS[token]) return PLAN_TOKEN_NOUNS[token];
  const term = getTasteTerm(token);
  if (term?.category === "cuisine") return term.display_name;
  return String(term?.display_name || token).replace(/-/g, " ").toLowerCase();
}

function frequencyPhrase(row) {
  const { min_count: min, max_count: max } = row;
  const name = spokenToken(row.token);
  if (min != null && max != null && min === max) return `${name} ${times(min)}`;
  if (min != null && max == null) return `${name} at least ${times(min)}`;
  if (min != null && max != null) return `${name} ${numberWord(min)} to ${numberWord(max)} times`;
  if (max != null) return `${name} ${times(max)} at most`;
  return null;
}

export function buildPlanningChips(state) {
  /** @type {{ id: string, label: string }[]} */
  const chips = [];
  if (state.dinner_count != null) {
    chips.push({ id: "dinner_count", label: `${state.dinner_count} ${state.dinner_count === 1 ? "dinner" : "dinners"}` });
  }
  if (state.keep_it_easy === true) chips.push({ id: "keep_it_easy", label: "Keep it easy" });
  if (state.keep_ingredients_simple === true) chips.push({ id: "keep_ingredients_simple", label: "Keep ingredients simple" });
  if (state.effort === "easy") chips.push({ id: "effort", label: "Easy only" });
  if (state.ingredient_complexity === "simple" && state.ingredient_complexity_hard) {
    chips.push({ id: "ingredient_complexity", label: "Simple ingredients only" });
  }
  if (state.max_minutes != null && state.max_minutes_hard) {
    chips.push({ id: "max_minutes", label: `Under ${state.max_minutes} min` });
  }
  for (const row of state.frequencies || []) {
    if (row.max_count === 0) {
      chips.push({ id: `exclude:${row.token}`, label: `No ${spokenToken(row.token)}` });
      continue;
    }
    const phrase = frequencyPhrase(row);
    if (phrase) chips.push({ id: `freq:${row.token}`, label: capitalize(phrase) });
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
  if ((state.exclude_cooking || []).length === 3) chips.push({ id: "exclude_cooking", label: "Nothing fried" });
  else if ((state.exclude_cooking || []).includes("deep")) chips.push({ id: "exclude_cooking", label: "Nothing deep-fried" });
  for (const slot of state.slots || []) {
    if (slot.special) {
      const label = slot.weekday
        ? `${weekdayShort(slot.weekday)}: special`
        : slot.position
          ? `Dinner ${slot.position}: special`
          : "Something special";
      chips.push({ id: `slot:${slot.weekday || slot.date}:special`, label });
    }
    if (slot.effort === "easy" && slot.weekday) {
      chips.push({ id: `slot:${slot.weekday}:effort`, label: `${weekdayShort(slot.weekday)}: easy` });
    } else if (slot.effort === "easy" && slot.position) {
      chips.push({ id: `slot:p${slot.position}:effort`, label: `Dinner ${slot.position}: easy` });
    }
    if (slot.intent_cue) {
      const word = slot.intent_cue === "light" ? "lighter" : cuePhrase(slot.intent_cue);
      const label = slot.weekday
        ? `${weekdayShort(slot.weekday)}: ${word}`
        : slot.position
          ? `Dinner ${slot.position}: ${word}`
          : word;
      chips.push({ id: `slot:${slot.weekday || `p${slot.position}`}:cue`, label });
    }
  }
  pushRankChips(chips, state);
  if (state.special_count != null && state.special_count > 0 && !(state.slots || []).some((s) => s.special)) {
    const label = state.special_count === 1 ? "Something special" : `${state.special_count} special nights`;
    chips.push({ id: "special_count", label });
  }
  return chips;
}

export function buildDiscoveryChips(state) {
  const chips = [];
  if (state.keep_it_easy === true) chips.push({ id: "keep_it_easy", label: "Keep it easy" });
  if (state.keep_ingredients_simple === true) chips.push({ id: "keep_ingredients_simple", label: "Simple ingredients" });
  for (const slug of state.ingredients || []) chips.push({ id: `ingredient:${slug}`, label: displayForToken(slug) });
  for (const slug of state.cuisines || []) chips.push({ id: `cuisine:${slug}`, label: displayForToken(slug) });
  for (const slug of state.exclude_ingredients || []) {
    chips.push({ id: `exclude:${slug}`, label: `No ${displayForToken(slug).toLowerCase()}` });
  }
  for (const slug of state.exclude_terms || []) {
    chips.push({ id: `exclude_term:${slug}`, label: `No ${displayForToken(slug).toLowerCase()}` });
  }
  for (const slug of state.flavors || []) chips.push({ id: `flavor:${slug}`, label: spokenFlavor(slug) });
  for (const slug of state.protein_groups || []) chips.push({ id: `protein:${slug}`, label: titleToken(slug) });
  for (const cue of state.intent_cues || []) chips.push({ id: `cue:${cue}`, label: CUE_LABELS[cue] || cue });
  if ((state.exclude_cooking || []).length === 3) chips.push({ id: "exclude_cooking", label: "Nothing fried" });
  else if ((state.exclude_cooking || []).includes("deep")) chips.push({ id: "exclude_cooking", label: "Nothing deep-fried" });
  pushRankChips(chips, state);
  if (state.quick) chips.push({ id: "quick", label: "Quick" });
  if (state.effort_levels?.includes("easy")) chips.push({ id: "effort:easy", label: "Easy" });
  return chips;
}

function frequencyPhrases(state) {
  const parts = [];
  for (const row of state?.frequencies || []) {
    if (row.max_count === 0) continue;
    const phrase = frequencyPhrase(row);
    if (phrase) parts.push(phrase);
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
    const phrase = `no ${label}`;
    if (!parts.some((row) => row.toLowerCase() === phrase.toLowerCase())) parts.push(phrase);
  };
  for (const slug of state?.exclude_ingredients || []) push(displayForToken(slug).toLowerCase());
  for (const slug of state?.exclude_terms || []) push(spokenToken(slug));
  for (const slug of state?.exclude_categories || []) push(spokenToken(slug));
  for (const row of state?.frequencies || []) {
    if (row.max_count === 0) push(spokenToken(row.token));
  }
  const cooking = state?.exclude_cooking || [];
  const fried = cooking.length === 1 && cooking.includes("deep") ? "nothing deep-fried" : cooking.length ? "nothing fried" : null;
  if (fried) parts.push(fried);
  return parts;
}

function cuePhrase(cue) {
  if (cue === "special") return "something special";
  if (cue === "weeknight") return "weeknight-friendly";
  return CUE_ADJECTIVES[cue] || String(cue).replace(/_/g, " ");
}

function appliedCuePhrases(state) {
  const parts = [];
  for (const slug of state?.flavors || []) parts.push(spokenFlavor(slug).toLowerCase());
  for (const slug of state?.protein_groups || []) parts.push(spokenToken(slug));
  for (const cue of state?.intent_cues || []) parts.push(cue === "light" ? "not too heavy" : cuePhrase(cue));
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

function slotPhrases(state) {
  const parts = [];
  for (const slot of state?.slots || []) {
    const day = slot.weekday ? capitalize(slot.weekday) : null;
    if (slot.special) parts.push(day ? `with something special on ${day}` : "with something special");
    if (slot.effort === "easy" && day) parts.push(`an easy ${day}`);
  }
  if (state?.special_count > 0 && !(state.slots || []).some((s) => s.special)) {
    parts.push(state.special_count === 1 ? "with something special" : `with ${numberWord(state.special_count)} special nights`);
  }
  return parts;
}

/** Fit as many trailing clauses as the reply budget allows; never cut a clause in half. */
function fitClauses(head, clauses, { joiner = ", ", end = "." } = {}) {
  let text = head;
  for (const clause of clauses) {
    if (!clause) continue;
    const next = `${text}${joiner}${clause}`;
    if (next.length + end.length > MAX_ACK) continue;
    text = next;
  }
  return `${text}${end}`;
}

function planningSentence(state, notes = {}) {
  const portions = portionSummary(state);
  const adjectives = portions.length
    ? []
    : (state.intent_cues || []).filter((cue) => cue !== "special").map((cue) => (cue === "weeknight" ? "weeknight" : cuePhrase(cue)));
  adjectives.unshift(...(state.cuisines || []).map(spokenToken));
  const count = state.dinner_count;
  const noun = count === 1 ? "dinner" : "dinners";
  const described = [adjectives.join(", "), noun].filter(Boolean).join(" ");
  let head;
  if (count != null && notes.dinnerCountDefaulted && notes.dinnerCountUsual) head = `your usual ${numberWord(count)} ${described}`;
  else if (count != null && notes.dinnerCountDefaulted) head = `${numberWord(count)} ${described} to start`;
  else if (count != null) head = `${numberWord(count)} ${described}`;
  else if (adjectives.length) head = described;
  else head = "";

  const clauses = [];
  if (portions.length) {
    clauses.push(andJoin(portions.map((row) => `${numberWord(row.count)} ${cuePhrase(row.cue)}`)));
  }
  if (state.effort === "easy") clauses.push("all easy");
  else if (state.keep_it_easy === true) clauses.push("mostly easy");
  if (state.max_minutes != null && state.max_minutes_hard) clauses.push(`all under ${state.max_minutes} min`);
  if (state.ingredient_complexity === "simple" && state.ingredient_complexity_hard) clauses.push("simple ingredients only");
  else if (state.keep_ingredients_simple === true) clauses.push("simple ingredients");
  clauses.push(...frequencyPhrases(state));
  const includes = (state.include_ingredients || []).map((slug) => displayForToken(slug).toLowerCase());
  if (includes.length) clauses.push(`with ${andJoin(includes)}`);
  clauses.push(...exclusionPhrases(state));
  clauses.push(...slotPhrases(state));
  if ((state.intent_cues || []).includes("special") && !clauses.some((c) => /something special/.test(c))) {
    clauses.push("with something special");
  }

  if (!head && !clauses.length) return "Got it.";
  if (!head) {
    const [first, ...rest] = clauses;
    return fitClauses(`Got it — ${first.replace(/^with /, "")}`, rest);
  }
  if (portions.length && clauses[0] === andJoin(portions.map((row) => `${numberWord(row.count)} ${cuePhrase(row.cue)}`))) {
    const [first, ...rest] = clauses;
    return fitClauses(`Got it — ${head}: ${first}`, rest);
  }
  return fitClauses(`Got it — ${head}`, clauses);
}

function discoverySentence(state, notes = {}) {
  const adjectives = [];
  for (const word of notes.requestFlavors || []) adjectives.push(word);
  for (const slug of state.flavors || []) {
    const spoken = spokenFlavor(slug).toLowerCase();
    if (!adjectives.some((word) => spoken.includes(word))) adjectives.push(spoken);
  }
  for (const cue of state.intent_cues || []) {
    if (cue === "special") adjectives.push("a little special");
    else adjectives.push(cue === "light" ? "not too heavy" : cuePhrase(cue));
  }
  if ((state.semantic_rank || []).includes("crispy_non_fry") && !adjectives.includes("crispy")) {
    adjectives.push("crispy");
  }
  if (state.quick) adjectives.push("quick");
  if (state.effort_levels?.includes("easy") || state.keep_it_easy === true) adjectives.push("easy");
  const cuisines = (state.cuisines || []).map(spokenToken);
  const styles = (state.meal_styles || []).map(spokenToken);
  const withItems = [...(state.protein_groups || []), ...(state.ingredients || [])].map(spokenToken);
  const extras = [...exclusionPhrases(state)];
  if (state.keep_ingredients_simple === true) extras.push("simple ingredients");

  let head;
  if (styles.length) {
    head = capitalize([adjectives.join(", "), cuisines.join(" "), andJoin(styles)].filter(Boolean).join(" "));
  } else if (adjectives.length || cuisines.length) {
    head = `Something ${andJoin([...cuisines, ...adjectives])}`;
  } else if (withItems.length) {
    head = "Dinners";
  } else if (extras.length) {
    return sentence(`Got it — ${andJoin(extras)}`);
  } else {
    return "Got it.";
  }
  if (withItems.length) head += ` with ${andJoin(withItems)}`;
  if (!extras.length) return sentence(head);
  return fitClauses(head, [andJoin(extras)], { joiner: " — " });
}

function detailPhrases(state, task) {
  const constraints = [...exclusionPhrases(state)];
  const cues = [];
  if (task === "planning_intent") {
    constraints.unshift(...frequencyPhrases(state));
    if (!portionSummary(state).length) {
      for (const cue of state?.intent_cues || []) cues.push(cuePhrase(cue));
    }
  } else {
    cues.push(...appliedCuePhrases(state));
  }
  return { constraints, cues };
}

/** Add what the reply left out as one short trailing clause, without breaking the sentence. */
function appendMissing(text, { constraints, cues }) {
  const base = String(text || "").trim();
  const lower = base.toLowerCase();
  const missing = [...constraints, ...cues].filter((phrase) => phrase && !lower.includes(phrase.toLowerCase()));
  if (!missing.length) return base;
  const head = withoutPeriod(base);
  const dashed = head.includes("—");
  const spoken = missing.map((phrase) => (phrase === "something special" ? "with something special" : phrase));
  const build = (list) => (dashed ? `${head}, ${list.join(", ")}.` : `${head} — ${andJoin(list)}.`);
  const kept = [];
  for (const phrase of spoken) {
    if (build([...kept, phrase]).length <= MAX_ACK) kept.push(phrase);
  }
  if (!kept.length) return base;
  return build(kept);
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

function requestFlavorWords(text, userText) {
  const source = String(userText || "").toLowerCase();
  const said = String(text || "").toLowerCase();
  return REQUEST_FLAVOR_WORDS.filter((word) => new RegExp(`\\b${word}\\b`).test(source) && !said.includes(word));
}

function withRequestFlavors(text, userText) {
  const missing = requestFlavorWords(text, userText);
  if (!missing.length) return text;
  const lead = andJoin(missing);
  const body = withoutPeriod(text);
  if (!body) return sentence(capitalize(lead));
  if (/^something\b/i.test(body)) return sentence(`Something ${lead}, ${body.replace(/^something\s+/i, "")}`).slice(0, MAX_ACK);
  const first = body.split(/\s+/)[0];
  const proper = getTasteTerm(first.toLowerCase())?.category === "cuisine";
  const rest = proper ? body : `${body.charAt(0).toLowerCase()}${body.slice(1)}`;
  const joiner = body.split(/\s+/).length === 1 ? " " : ", ";
  return sentence(`${capitalize(lead)}${joiner}${rest}`).slice(0, MAX_ACK);
}

/** Older stored replies used "·" joins and a stray period before a clause. Read them as plain sentences. */
function polishAcknowledgement(text) {
  return String(text || "")
    .replace(/\.?\s*·\s*Something special\b/gi, ", with something special")
    .replace(/\.?\s*·\s*Special\b/g, ", with something special")
    .replace(/\s*·\s*/g, ", ")
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

function conflictLabels(conflicts) {
  const labels = [];
  for (const conflict of conflicts || []) {
    const label = conflictLabel(conflict);
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

function conflictNames(conflicts) {
  const labels = conflictLabels(conflicts);
  const pretty = labels.map((label, index) => (index === 0 ? label : label.toLowerCase()));
  if (pretty.length === 0) return "That";
  return andJoin(pretty);
}

function worksForEveryone(conflicts) {
  const names = conflictNames(conflicts);
  const verb = conflictLabels(conflicts).length > 1 ? "don't" : "doesn't";
  return `${names} ${verb} work for everyone at your table`;
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
  const missing = preview?.no_easier_positions || [];
  if (missing.length) {
    const position = missing[0];
    const requested = (slots || []).find((row) => Number(row.position) === Number(position));
    const prev = previous.find((row) => Number(row.position) === Number(position));
    const day = dayLabel(requested, prev) || `Dinner ${position}`;
    return { text: `Nothing easier is available for ${day}.`, suggestions: [] };
  }
  const changed = preview?.changed_positions || [];
  const cued = (slots || []).filter((slot) => slot?.intent_cue);
  if (cued.length && !portionSummary({ slots }).length && preview?.slots) {
    const bits = [];
    for (const requested of cued) {
      const slot = preview.slots.find((row) => Number(row.position) === Number(requested.position));
      const prev = previous.find((row) => Number(row.position) === Number(requested.position));
      if (!slot?.title) continue;
      const day = dayLabel(requested, prev) || dayLabel(slot, prev) || weekdayName(slot.scheduled_date || prev?.scheduled_date);
      const word = requested.intent_cue === "light" ? "lighter" : cuePhrase(requested.intent_cue);
      const when = day ? `${day}'s now` : `Dinner ${requested.position} is now`;
      bits.push(`${when} ${word}: ${slot.title}`);
    }
    if (bits.length) {
      let text = "";
      for (const bit of bits) {
        const next = text ? `${text} ${sentence(bit)}` : sentence(bit);
        if (next.length > MAX_ACK) break;
        text = next;
      }
      return { text: text || sentence(bits[0]).slice(0, MAX_ACK), suggestions: [] };
    }
  }
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
    if (bits.length) {
      let text = "";
      for (const bit of bits) {
        const next = text ? `${text} ${sentence(bit)}` : sentence(bit);
        if (next.length > MAX_ACK) break;
        text = next;
      }
      return { text: text || sentence(bits[0]).slice(0, MAX_ACK), suggestions: [] };
    }
  }
  for (const slot of slots || []) {
    const prev =
      (previousSlots || []).find((row) => row.position === slot.position) ||
      (previousSlots || []).find((row) => weekdayName(row.scheduled_date)?.toLowerCase() === slot.weekday);
    if (!prev) continue;
    const position = slot.position || prev.position;
    if (changed.includes(position)) continue;
    if (!mealSatisfiesSlot(prev, slot)) continue;
    const day = dayLabel(slot, prev) || (position ? `Dinner ${position}` : "That night");
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
        text: `${day}'s already one of the easiest — no change needed.`,
        suggestions: [`Swap ${day} for a different easy dinner`],
      };
    }
    const bits = [];
    if (slot.category) bits.push(slot.category === "plant" ? "vegetarian" : spokenToken(slot.category));
    if (slot.cuisine) bits.push(spokenToken(slot.cuisine));
    if (slot.meal_style) bits.push(spokenToken(slot.meal_style));
    if (slot.ingredient) bits.push(displayForToken(slot.ingredient).toLowerCase());
    if (slot.effort === "easy") bits.push("easy");
    else if (slot.effort) bits.push(slot.effort);
    if (slot.ingredient_complexity) bits.push(slot.ingredient_complexity);
    if (slot.max_minutes != null) bits.push(`under ${slot.max_minutes} min`);
    if (slot.special === true) bits.push("special");
    if (!bits.length) continue;
    const why = andJoin(bits);
    const onlyIngredient = bits.length === 1 && slot.ingredient;
    return {
      text: onlyIngredient ? `${day} already has ${why} — no change needed.` : `${day}'s already ${why} — no change needed.`,
      suggestions: [`Swap ${day} for a different ${why} dinner`],
    };
  }
  return null;
}

export const FIND_UNAVAILABLE_ACK = "Showing dinners that match your words.";
export const PLAN_PICKER_ACK = "Typing a request isn’t available right now. Choose how many below.";

export function planCountFallbackAck(count) {
  const n = Number(count);
  return `Here's a plan for ${numberWord(n)} ${n === 1 ? "dinner" : "dinners"}.`;
}

export function withRelaxation(ack, { relaxed, dish }) {
  const name = dish ? spokenToken(dish) : "";
  const looked = name ? `fish ${name}` : "fish";
  const source = String(ack || "");
  if (/so we looked for fish/.test(source)) {
    const verb = /s$/.test(looked) ? "here are" : "here's";
    return source.replace(/so we looked for fish(?: instead)?\.?/, `so ${verb} ${looked} without ${relaxed}.`).slice(0, MAX_ACK);
  }
  return `${withoutPeriod(source)}. We eased off ${relaxed} so something fits.`.slice(0, MAX_ACK);
}

export const NO_RESULTS_SUGGESTIONS = Object.freeze(["Try fish", "Make it easier", "Clear a filter"]);

function fishCueActive(state) {
  const proteins = state?.protein_groups || [];
  if (proteins.includes("fish") || proteins.includes("seafood")) return true;
  const ingredients = [...(state?.ingredients || []), ...(state?.include_ingredients || [])];
  if (ingredients.some((slug) => /\bfish\b/.test(String(slug || "")))) return true;
  if (/\bfish\b/i.test(String(state?.text_residue || ""))) return true;
  return (state?.frequencies || []).some((row) => row?.token === "fish" && row.max_count !== 0);
}

function easierCueActive(state) {
  return state?.keep_it_easy === true || state?.effort === "easy" || (state?.effort_levels || []).includes("easy");
}

/** Suggestion chips that name a cue the search already has. */
export function noResultsSuggestions(state, limits) {
  const blocked = new Set(limits || []);
  return NO_RESULTS_SUGGESTIONS.filter((label) => {
    if (label === "Try fish" && (fishCueActive(state) || blocked.has("no_finfish"))) return false;
    if (label === "Make it easier" && easierCueActive(state)) return false;
    return true;
  });
}

function tryClause(parts) {
  if (parts.length === 1) return `Try ${parts[0]}.`;
  if (parts.length === 2) return `Try ${parts[0]}, or ${parts[1]}.`;
  return `Try ${parts[0]}, ${parts[1]}, or ${parts[2]}.`;
}

export function noResultsAcknowledgement(conflicts, state) {
  if (conflicts?.length) {
    return `${worksForEveryone(conflicts)}, so no dinners match that yet. Try something broader.`.slice(0, MAX_ACK);
  }
  const parts = [];
  if (!fishCueActive(state)) parts.push("fish");
  if (!easierCueActive(state)) parts.push("something easier");
  parts.push("clear a filter");
  if (parts.length === 1) return "No dinners match that. Clear a filter.".slice(0, MAX_ACK);
  return `No dinners match that. ${tryClause(parts)}`.slice(0, MAX_ACK);
}

/** A refinement names what moved; standing caps and exclusions ride along as "Still …". */
function withFrequencyCaps(text, state) {
  const base = String(text || "").trim();
  const lower = base.toLowerCase();
  const missing = [...frequencyPhrases(state), ...exclusionPhrases(state)].filter((phrase) => !lower.includes(phrase.toLowerCase()));
  if (!missing.length) return base;
  const next = `${sentence(base)} Still ${andJoin(missing)}.`;
  return next.length <= MAX_ACK ? next : base;
}

export function reconciledAcknowledgement(task, state, conflicts, notes = {}) {
  if (notes.refinement?.text) return withFrequencyCaps(notes.refinement.text, state);
  const unfilled = (conflicts || []).find((row) => row.code === "frequency_unfilled");
  if (unfilled) {
    const name = spokenToken(unfilled.token);
    const placed = Number(unfilled.placed) || 0;
    if (placed === 0) return `No ${name} dinners work for your table this time, so these are something else.`.slice(0, MAX_ACK);
    const works = placed === 1 ? "dinner works" : "dinners work";
    return `Only ${numberWord(placed)} ${name} ${works} for your table, so the rest are something else.`.slice(0, MAX_ACK);
  }
  const hard = (conflicts || []).filter((row) => row.code !== "frequency_unfilled");
  if (hard.length) {
    const head = worksForEveryone(hard);
    const fish = hard.some((row) => row.alternative?.kind === "category" && row.alternative.token === "fish");
    if (fish && task === "planning_intent") return `${head}, so these dinners are fish.`.slice(0, MAX_ACK);
    if (fish) return `${head}, so we looked for fish instead.`.slice(0, MAX_ACK);
    const special = (state?.intent_cues || []).includes("special") || (state?.slots || []).some((s) => s.special);
    if (special && task === "discovery_intent") {
      return `${head}, so here are some special dinners without it.`.slice(0, MAX_ACK);
    }
    if (special && task === "planning_intent") {
      const dated = (state?.slots || []).find((s) => s.special && s.weekday);
      if (dated?.weekday) {
        const day = dated.weekday.charAt(0).toUpperCase() + dated.weekday.slice(1);
        return `${head}, so ${day}'s still special, just without it.`.slice(0, MAX_ACK);
      }
      return `${head}, so we left it out — still one special night.`.slice(0, MAX_ACK);
    }
    const pronoun = conflictLabels(hard).length > 1 ? "them" : "it";
    return `${head}, so we left ${pronoun} out.`.slice(0, MAX_ACK);
  }
  if (task === "planning_intent") return planningSentence(state, notes);
  return discoverySentence(state, notes);
}

/** A model reply worth keeping reads like a sentence, not a bare count or a single chip word. */
function isFragment(ack) {
  const text = withoutPeriod(ack);
  if (/^\d+\s+dinners?$/i.test(text)) return true;
  return text.split(/\s+/).filter(Boolean).length < 2;
}

export function shouldKeepModelAcknowledgement(ack, conflicts, dropped, removedTokens, userText) {
  if (!ack || ack === "Got it.") return false;
  if (isFragment(ack)) return false;
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
  const portioned = task === "planning_intent" && portionSummary(state).length > 0;
  const finish = (text, source) => {
    const polished = polishAcknowledgement(text);
    const acknowledgement_source = polished === String(modelAck || "").trim() ? source : "reconciled";
    return { acknowledgement: polished, acknowledgement_source, suggestions };
  };
  if (!notes.refinement && !notes.dinnerCountDefaulted && !portioned && shouldKeepModelAcknowledgement(modelAck, conflicts, dropped, removedTokens, userText)) {
    const kept = String(modelAck).trim();
    const flavored = task === "discovery_intent" ? withRequestFlavors(kept, userText) : kept;
    return finish(appendMissing(flavored, detailPhrases(state, task)), "model");
  }
  const hasConflict = (conflicts || []).length > 0;
  if (notes.refinement?.text || !hasConflict) {
    const requestFlavors = task === "discovery_intent" ? requestFlavorWords("", userText) : [];
    return finish(reconciledAcknowledgement(task, state, conflicts, { ...notes, requestFlavors }), "reconciled");
  }
  const base = reconciledAcknowledgement(task, state, conflicts, notes);
  const details = detailPhrases(state, task);
  // Ranking cues are not filters. "Not too heavy is still on" only belongs
  // when that cue was an explicit constraint the conflict left in place.
  const stillOn = details.constraints.filter((phrase) => !/^(no|nothing) /.test(phrase));
  return finish(withStillOn(base, stillOn), "reconciled");
}

/** After a conflict line, say what still stands as its own short sentence. */
function withStillOn(text, phrases) {
  const base = sentence(text);
  const lower = base.toLowerCase();
  const kept = [];
  for (const phrase of phrases) {
    if (!phrase || lower.includes(phrase.toLowerCase())) continue;
    const list = [...kept, phrase];
    const candidate = `${base} ${capitalize(andJoin(list))} ${list.length > 1 ? "are" : "is"} still on.`;
    if (candidate.length <= MAX_ACK) kept.push(phrase);
  }
  if (!kept.length) return base;
  return `${base} ${capitalize(andJoin(kept))} ${kept.length > 1 ? "are" : "is"} still on.`;
}
