/**
 * Deterministic negation for Find. "nothing fried" is an exclusion even
 * when the model listed fried as something to include. "not too heavy"
 * stays a light cue and is not an exclusion.
 */

const NEGATION_RE = /\b(?:nothing|without|avoid|not|no)\s+(?!too\b)([a-z][a-z0-9]*(?:-[a-z0-9]+)*)/gi;

const NEGATION_SKIP = new Set([
  "a",
  "an",
  "any",
  "dinner",
  "dinners",
  "food",
  "foods",
  "it",
  "meal",
  "meals",
  "more",
  "much",
  "one",
  "please",
  "some",
  "something",
  "that",
  "the",
  "them",
  "this",
  "too",
  "very",
]);

const INCLUSION_FIELDS = [
  "methods",
  "ingredients",
  "meal_styles",
  "flavors",
  "textures",
  "equipment",
  "protein_groups",
  "diet",
  "intent_cues",
];

const RESIDUE_MARKERS = new Set(["nothing", "no", "not", "without", "avoid", "but"]);

const TOKEN_RE = /[a-z0-9]+/g;

function addForms(forms, term) {
  forms.add(term);
  let stem = term;
  if (term.endsWith("ying") && term.length > 5) stem = `${term.slice(0, -4)}y`;
  else if (term.endsWith("ied") && term.length > 4) stem = `${term.slice(0, -3)}y`;
  else if (term.endsWith("ies") && term.length > 4) stem = `${term.slice(0, -3)}y`;
  else if (term.endsWith("ing") && term.length > 5) {
    stem = term.slice(0, -3);
    if (stem.length > 2 && stem.endsWith(stem[stem.length - 1]) && /[bcdfghjklmnpqrstvwxz]/.test(stem[stem.length - 1])) {
      stem = stem.slice(0, -1);
    }
  } else if (term.endsWith("ed") && term.length > 4) {
    stem = term.slice(0, -2);
    if (stem.length > 2 && stem.endsWith(stem[stem.length - 1]) && /[bcdfghjklmnpqrstvwxz]/.test(stem[stem.length - 1])) {
      stem = stem.slice(0, -1);
    }
  } else if (term.endsWith("er") && term.length > 4) stem = term.slice(0, -2);
  else if (term.endsWith("s") && !term.endsWith("ss") && term.length > 4) stem = term.slice(0, -1);

  forms.add(stem);
  if (stem.endsWith("y") && stem.length > 2) {
    const base = stem.slice(0, -1);
    forms.add(`${base}ied`);
    forms.add(`${base}ies`);
    forms.add(`${base}ying`);
    forms.add(`${stem}er`);
    return;
  }
  if (stem.length >= 3) {
    forms.add(`${stem}ed`);
    forms.add(`${stem}ing`);
    forms.add(`${stem}er`);
    forms.add(`${stem}s`);
  }
}

/** Surface forms of a negated word. "fried" covers fry, frying, fryer, and fries, not friday. */
export function termForms(term) {
  const raw = String(term || "").toLowerCase().trim();
  const pieces = raw.split(/[^a-z0-9]+/).filter(Boolean);
  const forms = new Set();
  if (!pieces.length) return forms;
  addForms(forms, pieces[pieces.length - 1]);
  return forms;
}

/**
 * @param {string} text
 * @returns {string[]} negated tokens, in order
 */
export function parseNegations(text) {
  const source = String(text || "").toLowerCase();
  const found = [];
  const seen = new Set();
  for (const match of source.matchAll(NEGATION_RE)) {
    const token = match[1];
    if (!token || NEGATION_SKIP.has(token) || seen.has(token)) continue;
    seen.add(token);
    found.push(token);
  }
  return found;
}

function itemHitsForms(item, forms) {
  const token = String(item || "").toLowerCase();
  if (!token) return false;
  if (forms.has(token)) return true;
  const pieces = token.split(/[^a-z0-9]+/).filter(Boolean);
  return pieces.some((piece) => forms.has(piece));
}

function stripResidue(residue, forms, state) {
  const covered = new Set([
    ...(state.protein_groups || []),
    ...(state.ingredients || []),
    ...(state.cuisines || []),
    ...(state.meal_styles || []),
    ...(state.flavors || []),
  ]);
  const tokens = String(residue || "").toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [];
  const kept = [];
  for (const token of tokens) {
    if (itemHitsForms(token, forms)) continue;
    if (RESIDUE_MARKERS.has(token)) continue;
    if (covered.has(token)) continue;
    kept.push(token);
  }
  return kept.length ? kept.join(" ") : null;
}

/**
 * Strip negated words out of inclusion lists and text, and record them as
 * exclusions. Existing exclusions stay. Returns the terms found in this text.
 * @param {object} state discovery state, mutated
 * @param {string} text raw user text
 */
export function applyNegationOverlay(state, text) {
  if (!state || typeof state !== "object") return [];
  const terms = parseNegations(text);
  const all = [...(state.exclude_terms || [])];
  for (const term of terms) {
    if (!all.includes(term)) all.push(term);
  }
  if (!all.length) return terms;
  const forms = new Set();
  for (const term of all) {
    for (const form of termForms(term)) forms.add(form);
  }
  for (const field of INCLUSION_FIELDS) {
    if (!Array.isArray(state[field])) continue;
    state[field] = state[field].filter((item) => !itemHitsForms(item, forms));
  }
  if (state.text_residue) state.text_residue = stripResidue(state.text_residue, forms, state);
  state.exclude_terms = all.sort((a, b) => a.localeCompare(b));
  return terms;
}

/** Title, slug, and method tokens. Hyphenated pan-fried / air-fryer / stir-fry count. friday does not. */
export function mealMatchesExcludedTerm(meal, term) {
  const forms = termForms(term);
  if (!forms.size) return false;
  const blob = [meal?.title, meal?.recipe_slug, ...(meal?.methods || [])].filter(Boolean).join(" ");
  const tokens = String(blob).toLowerCase().match(TOKEN_RE) || [];
  return tokens.some((token) => forms.has(token));
}
