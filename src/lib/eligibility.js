/**
 * Hard constraint eligibility — prohibited ingredients must not appear in options.
 * rule_key values align with client constraint ids (dairy, shellfish, meat, poultry, nuts).
 */

/** @typedef {{ rule_key: string, status?: string, member_id?: string|null }} ConstraintRow */
/** @typedef {{ meal_option_id?: string, name?: string, attributes_json?: string|object|null, tags?: string[] }} MealOption */

const RULE_TO_TAGS = {
  dairy: ["dairy", "milk", "cheese", "butter", "yogurt"],
  shellfish: ["shellfish", "shrimp", "crab", "lobster"],
  meat: ["meat", "beef", "pork", "lamb", "bacon", "sausage"],
  poultry: ["poultry", "chicken", "turkey", "duck"],
  nuts: ["nuts", "peanut", "almond", "walnut", "pecan", "hazelnut"],
};

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
 * @param {MealOption} option
 * @returns {string[]}
 */
export function optionTags(option) {
  if (Array.isArray(option.tags) && option.tags.length) {
    return option.tags.map((t) => String(t).toLowerCase());
  }
  let attrs = option.attributes_json;
  if (typeof attrs === "string") {
    try {
      attrs = JSON.parse(attrs);
    } catch {
      attrs = null;
    }
  }
  if (attrs && Array.isArray(attrs.tags)) {
    return attrs.tags.map((t) => String(t).toLowerCase());
  }
  const name = (option.name || "").toLowerCase();
  const inferred = [];
  for (const [rule, tags] of Object.entries(RULE_TO_TAGS)) {
    if (tags.some((t) => name.includes(t))) inferred.push(rule);
  }
  return inferred;
}

/**
 * @param {MealOption} option
 * @param {Set<string>} prohibited
 */
export function isOptionEligible(option, prohibited) {
  if (!prohibited.size) return true;
  const tags = optionTags(option);
  for (const rule of prohibited) {
    const blocked = RULE_TO_TAGS[rule];
    if (!blocked) continue;
    if (blocked.some((t) => tags.includes(t))) return false;
    if (rule === "nuts" && tags.some((t) => t.includes("nut") && !t.includes("cashew"))) {
      return false;
    }
  }
  return true;
}

/**
 * @param {MealOption[]} options
 * @param {ConstraintRow[]} constraints
 */
export function filterEligibleOptions(options, constraints) {
  const prohibited = prohibitedRuleKeys(constraints);
  return (options || []).filter((o) => isOptionEligible(o, prohibited));
}
