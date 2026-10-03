/**
 * Hard constraint eligibility — prohibited ingredients must not appear in options.
 * rule_key values align with client constraint ids (dairy, meat, poultry, fish, shellfish, nuts).
 *
 * Every diner is checked on their own rules, then the results are intersected:
 * a meal is eligible only when it clears every diner. Taste evidence never
 * reaches this module, so a like cannot override a hard limit.
 *
 * Allergy exceptions are explicit rows: { rule_key: "cashew", status: "permitted" }
 * relaxes that diner's own "nuts" rule for cashews only. Without that row,
 * "nuts" blocks cashews too.
 */

/** @typedef {{ rule_key: string, status?: string, member_id?: string|null }} ConstraintRow */
/** @typedef {{ meal_option_id?: string, name?: string, attributes_json?: string|object|null, tags?: string[] }} MealOption */
/** @typedef {{ prohibited: Set<string>, permitted: Set<string> }} DietProfile */

const RULE_TO_TAGS = {
  dairy: ["dairy", "milk", "cheese", "butter", "yogurt"],
  // "No meat" covers poultry as well; "No poultry" exists for diners who still eat red meat.
  meat: ["meat", "beef", "pork", "lamb", "bacon", "sausage", "poultry", "chicken", "turkey", "duck"],
  poultry: ["poultry", "chicken", "turkey", "duck"],
  fish: ["fish", "finfish", "salmon", "cod", "tuna", "trout", "halibut", "arctic char", "tilapia", "anchovy", "sardine"],
  shellfish: ["shellfish", "shrimp", "crab", "lobster", "scallop", "clam", "mussel", "oyster", "prawn"],
  nuts: ["nuts", "peanut", "almond", "walnut", "pecan", "hazelnut", "pistachio", "macadamia", "pine-nut", "cashew"],
};

/** Exceptions a diner can opt into. Each one relaxes a single parent rule for named tags only. */
export const RULE_EXCEPTIONS = {
  cashew: { parent: "nuts", tags: ["cashew"] },
};

/** Client-only ids that map onto an exception row. */
const EXCEPTION_KEYS = { cashew_ok: "cashew" };

export const HARD_RULE_KEYS = Object.keys(RULE_TO_TAGS);

/**
 * @param {ConstraintRow[]} rows
 * @returns {Set<string>}
 */
export function prohibitedRuleKeys(rows) {
  const keys = new Set();
  for (const r of rows || []) {
    if ((r.status || "prohibited") === "prohibited" && r.rule_key && r.rule_key !== "none") {
      keys.add(r.rule_key);
    }
  }
  return keys;
}

/**
 * Turn client keys (["nuts", "cashew_ok", "dairy"]) into constraint rows.
 * An exception without its parent rule is dropped; it has nothing to relax.
 * @param {string[]} keys
 * @returns {{ rule_key: string, status: "prohibited"|"permitted" }[]}
 */
export function constraintRowsFromKeys(keys) {
  const list = (keys || []).map((k) => String(k || "").trim()).filter((k) => k && k !== "none");
  const rows = [];
  const seen = new Set();
  for (const key of list) {
    const exception = EXCEPTION_KEYS[key];
    if (exception) {
      if (!list.includes(RULE_EXCEPTIONS[exception].parent) || seen.has(exception)) continue;
      seen.add(exception);
      rows.push({ rule_key: exception, status: "permitted" });
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ rule_key: key, status: "prohibited" });
  }
  return rows;
}

/**
 * Client keys for one diner's stored rows (inverse of constraintRowsFromKeys).
 * @param {ConstraintRow[]} rows
 */
export function keysFromConstraintRows(rows) {
  const keys = [];
  for (const r of rows || []) {
    if (!r.rule_key || r.rule_key === "none") continue;
    if ((r.status || "prohibited") === "prohibited") keys.push(r.rule_key);
  }
  for (const r of rows || []) {
    if (r.status !== "permitted") continue;
    const clientKey = Object.keys(EXCEPTION_KEYS).find((k) => EXCEPTION_KEYS[k] === r.rule_key);
    const ex = RULE_EXCEPTIONS[r.rule_key];
    if (clientKey && ex && keys.includes(ex.parent)) keys.push(clientKey);
  }
  return keys;
}

/**
 * One profile per diner. Rows without a member_id apply to everyone.
 * @param {ConstraintRow[]} rows
 * @returns {DietProfile[]}
 */
export function dietProfiles(rows) {
  const shared = { prohibited: new Set(), permitted: new Set() };
  /** @type {Map<string, DietProfile>} */
  const byMember = new Map();
  for (const r of rows || []) {
    if (!r.rule_key || r.rule_key === "none") continue;
    const status = r.status || "prohibited";
    if (status !== "prohibited" && status !== "permitted") continue;
    let target = shared;
    if (r.member_id) {
      if (!byMember.has(r.member_id)) {
        byMember.set(r.member_id, { prohibited: new Set(), permitted: new Set() });
      }
      target = byMember.get(r.member_id);
    }
    target[status].add(r.rule_key);
  }
  if (!byMember.size) return shared.prohibited.size ? [shared] : [];
  return [...byMember.values()].map((p) => ({
    prohibited: new Set([...shared.prohibited, ...p.prohibited]),
    // A shared prohibition is never relaxed by one diner's exception.
    permitted: new Set([...p.permitted].filter((k) => {
      const ex = RULE_EXCEPTIONS[k];
      return ex && !shared.prohibited.has(ex.parent);
    })),
  }));
}

/**
 * @param {MealOption} option
 * @returns {string[]}
 */
export function optionTags(option) {
  let tags = null;
  if (Array.isArray(option.tags) && option.tags.length) {
    tags = option.tags.map((t) => String(t).toLowerCase());
  } else {
    let attrs = option.attributes_json;
    if (typeof attrs === "string") {
      try {
        attrs = JSON.parse(attrs);
      } catch {
        attrs = null;
      }
    }
    if (attrs && Array.isArray(attrs.tags)) tags = attrs.tags.map((t) => String(t).toLowerCase());
  }
  const named = ingredientTagsFromName(option.name || option.title || "");
  return [...new Set([...(tags || []), ...named])];
}

const NUT_BUTTER = /\b(peanut|almond|cashew|sunflower|seed|apple|nut)[- ]butter\b/g;

/**
 * Ingredient words in a dish name count as tags even when the stored tags
 * miss them ("Mushroom-walnut bolognese" is a nut dish whatever its tags say).
 * Whole words only, so "coconut" is not a nut and "butternut" is not butter.
 * @param {string} name
 * @returns {string[]}
 */
function ingredientTagsFromName(name) {
  const lower = String(name).toLowerCase();
  if (!lower) return [];
  const found = new Set();
  for (const words of Object.values(RULE_TO_TAGS)) {
    for (const word of words) {
      const source = lower.replace(word === "butter" ? NUT_BUTTER : /$^/, " ");
      const pattern = word.replace(/[-\s]/g, "[-\\s]");
      if (new RegExp(`\\b${pattern}(?:s|es)?\\b`).test(source)) found.add(word);
    }
  }
  return [...found];
}

const NOT_NUTS = new Set(["coconut", "butternut", "doughnut", "donut", "nutmeg", "nutritional-yeast"]);

function nutTagsOf(tags) {
  return tags.filter(
    (t) => RULE_TO_TAGS.nuts.includes(t) || (!NOT_NUTS.has(t) && /nuts?$/.test(t))
  );
}

/**
 * @param {string[]} tags
 * @param {DietProfile} profile
 */
function clearsProfile(tags, profile) {
  for (const rule of profile.prohibited) {
    const blocked = RULE_TO_TAGS[rule];
    if (!blocked) continue;
    if (rule === "nuts") {
      const nutTags = nutTagsOf(tags);
      if (!nutTags.length) continue;
      const allowed = new Set();
      for (const key of profile.permitted) {
        const ex = RULE_EXCEPTIONS[key];
        if (ex && ex.parent === "nuts") ex.tags.forEach((t) => allowed.add(t));
      }
      const specific = nutTags.filter((t) => t !== "nuts");
      // A bare "nuts" tag names no kind, so no exception can clear it.
      if (!specific.length) return false;
      if (specific.some((t) => !allowed.has(t))) return false;
      continue;
    }
    if (blocked.some((t) => tags.includes(t))) return false;
  }
  return true;
}

/**
 * Single-profile check kept for callers that only have a prohibited set.
 * @param {MealOption} option
 * @param {Set<string>} prohibited
 */
export function isOptionEligible(option, prohibited) {
  if (!prohibited.size) return true;
  return clearsProfile(optionTags(option), { prohibited, permitted: new Set() });
}

/**
 * @param {MealOption} option
 * @param {ConstraintRow[]} constraints
 */
export function isOptionEligibleForHousehold(option, constraints) {
  const profiles = dietProfiles(constraints);
  if (!profiles.length) return true;
  const tags = optionTags(option);
  return profiles.every((p) => clearsProfile(tags, p));
}

/**
 * @param {MealOption[]} options
 * @param {ConstraintRow[]} constraints
 */
export function filterEligibleOptions(options, constraints) {
  const profiles = dietProfiles(constraints);
  if (!profiles.length) return [...(options || [])];
  return (options || []).filter((o) => {
    const tags = optionTags(o);
    return profiles.every((p) => clearsProfile(tags, p));
  });
}
