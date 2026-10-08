/**
 * Map factory package tokens into catalog import records.
 * Unknown tokens fail loudly; nothing is silently dropped.
 */

const FACTORY_PACKAGE_ALLERGEN_TOKENS = new Set([
  "egg",
  "milk",
  "soy",
  "wheat",
  "sesame",
  "peanut",
  "tree_nut",
  "cashew",
  "shellfish",
  "finfish",
  "poultry",
  "meat",
]);

const CATALOG_ALLERGEN_TOKENS = new Set([
  "egg",
  "milk",
  "soy",
  "wheat",
  "sesame",
  "peanut",
  "cashew",
  "nuts",
  "shellfish",
  "finfish",
  "poultry",
  "meat",
  "dairy",
  "walnut",
  "almond",
  "pecan",
  "hazelnut",
  "pistachio",
  "macadamia",
  "pine_nut",
]);

const FACTORY_DIETARY_LABEL_TOKENS = new Set(["dairy_free", "vegetarian", "plant_based", "fish"]);

const CATALOG_DIETARY_LABEL_TOKENS = new Set(["dairy_free", "vegetarian", "plant", "fish"]);

const PROVENANCE_MAP = {
  original_ai_assisted: "ai_assisted",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function sortedUnique(values) {
  return [...new Set(values.filter((item) => item != null && item !== ""))].sort();
}

/**
 * @param {string|null|undefined} raw
 */
export function normalizeFactoryPublicationStatus(raw) {
  if (raw == null || raw === "") return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (text.toLowerCase() === "draft") return "draft";
  return text;
}

/**
 * @param {string|null|undefined} raw
 * @returns {{ ok: true, value: string|null } | { ok: false, token: string }}
 */
export function mapFactoryProvenance(raw) {
  if (raw == null || raw === "") return { ok: true, value: null };
  const token = String(raw).trim();
  if (!token) return { ok: true, value: null };
  if (PROVENANCE_MAP[token]) return { ok: true, value: PROVENANCE_MAP[token] };
  if (token === "ai_assisted" || token === "legacy_unknown") return { ok: true, value: token };
  return { ok: false, token };
}

/**
 * @param {string} label
 * @returns {{ ok: true, value: string } | { ok: false, token: string }}
 */
export function mapFactoryDietaryLabel(label) {
  const token = String(label || "").trim().toLowerCase();
  if (!token) return { ok: false, token: String(label) };
  if (!FACTORY_DIETARY_LABEL_TOKENS.has(token)) return { ok: false, token };
  if (token === "plant_based") return { ok: true, value: "plant" };
  return { ok: true, value: token };
}

/**
 * @param {object} pkg
 * @returns {{ ok: true, allergens: string[] } | { ok: false, unknown: string[] }}
 */
export function mapFactoryPackageAllergens(pkg) {
  const version = pkg?.recipe_version || {};
  const eligibility = version.dietary_eligibility || {};
  const raw = asArray(version.allergens).map((item) => String(item || "").trim().toLowerCase());
  /** @type {string[]} */
  const unknown = [];
  /** @type {string[]} */
  const mapped = [];

  for (const token of raw) {
    if (!token) continue;
    if (token === "tree_nut") continue;
    if (!FACTORY_PACKAGE_ALLERGEN_TOKENS.has(token)) {
      unknown.push(token);
      continue;
    }
    if (token === "cashew") mapped.push("cashew");
    else mapped.push(token);
  }

  if (raw.includes("tree_nut")) {
    const cashewOnly =
      raw.includes("cashew") && String(eligibility.nut_policy || "").toLowerCase() === "cashews_only_ok";
    if (cashewOnly) {
      if (!mapped.includes("cashew")) mapped.push("cashew");
    } else {
      mapped.push("nuts");
    }
  }

  if (unknown.length) return { ok: false, unknown: sortedUnique(unknown) };
  const allergens = sortedUnique(mapped);
  for (const token of allergens) {
    if (!CATALOG_ALLERGEN_TOKENS.has(token)) {
      return { ok: false, unknown: [token] };
    }
  }
  return { ok: true, allergens };
}

/**
 * @param {object} pkg
 * @param {string[]} mappedAllergens
 */
export function eligibilityTagsFromMappedFactory(pkg, mappedAllergens) {
  const version = pkg?.recipe_version || {};
  const eligibility = version.dietary_eligibility || {};
  /** @type {string[]} */
  const tags = [];
  if (eligibility.contains_meat === true) tags.push("meat");
  if (eligibility.contains_poultry === true) tags.push("poultry");
  if (eligibility.contains_finfish === true) tags.push("finfish");
  if (eligibility.contains_shellfish === true) tags.push("shellfish");
  if (eligibility.contains_dairy === true) tags.push("dairy");
  for (const token of mappedAllergens) tags.push(token);
  const nutPolicy = String(eligibility.nut_policy || "").toLowerCase();
  if (nutPolicy === "cashews_only_ok" && mappedAllergens.includes("cashew") && !tags.includes("cashew")) {
    tags.push("cashew");
  }
  return sortedUnique(tags);
}

/**
 * Accept pantry_familiarity and the Batch B alias sourcing_difficulty.
 * @param {object} sidecar
 */
export function normalizeD03ComplexityFactors(sidecar) {
  const factors = sidecar?.classification?.complexity_factors;
  if (!factors || typeof factors !== "object") return factors;
  const next = { ...factors };
  if (
    Object.prototype.hasOwnProperty.call(next, "sourcing_difficulty") &&
    !Object.prototype.hasOwnProperty.call(next, "pantry_familiarity")
  ) {
    next.pantry_familiarity = next.sourcing_difficulty;
    delete next.sourcing_difficulty;
  }
  return next;
}

export {
  FACTORY_PACKAGE_ALLERGEN_TOKENS,
  CATALOG_ALLERGEN_TOKENS,
  FACTORY_DIETARY_LABEL_TOKENS,
  CATALOG_DIETARY_LABEL_TOKENS,
};
