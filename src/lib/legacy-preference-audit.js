/**
 * Map of hard-coded preference values that already exist in the app
 * and the alpha catalog. Only unambiguous values are mapped.
 * Everything else stays unresolved. This module does not write Household 001.
 */

import { CASHEW_PERMITTED, BBQ_RESOLUTION } from "./cycle2-schema.js";
import { resolveTasteTerm } from "./taste-resolver.js";

/** Client constraint ids in public/app.js. */
export const LEGACY_CONSTRAINT_IDS = [
  "dairy",
  "meat",
  "poultry",
  "fish",
  "shellfish",
  "nuts",
  "cashew_ok",
  "none",
];

/** Client spark ids in public/app.js. Likes, not permissions. */
export const LEGACY_SPARK_IDS = ["crispy", "tacos", "curry", "fish", "sheet", "bright"];

export const LEGACY_EVIDENCE_KINDS = ["like", "dislike", "neutral"];

/**
 * Future Household 001 rows. Documentation only.
 * Do not write production D1 or Household 001 from this workstream.
 */
export const HH001_CASHEW_BACKFILL = Object.freeze({
  documentation_only: true,
  write_production: false,
  production_d1_id: "23aa3db3-1090-471b-8c8a-b6fe71f5c053",
  household_label: "Household 001",
  future_rows: Object.freeze([
    Object.freeze({ rule_key: "nuts", status: "prohibited" }),
    Object.freeze({ rule_key: "cashew", status: "permitted" }),
    Object.freeze({ rule_key: "dairy", status: "prohibited" }),
    Object.freeze({ rule_key: "meat", status: "prohibited" }),
    Object.freeze({ rule_key: "poultry", status: "prohibited" }),
    Object.freeze({ rule_key: "shellfish", status: "prohibited" }),
  ]),
});

const CONSTRAINT_MAP = {
  dairy: { concept_type: "hard_limit", limit_id: "no_dairy" },
  meat: { concept_type: "hard_limit", limit_id: "no_meat", includes_poultry: true },
  poultry: { concept_type: "hard_limit", limit_id: "no_poultry" },
  fish: { concept_type: "hard_limit", limit_id: "no_finfish", eligibility_only: true },
  shellfish: { concept_type: "hard_limit", limit_id: "no_shellfish" },
  nuts: { concept_type: "hard_limit", limit_id: "no_nuts" },
  cashew_ok: { concept_type: "hard_limit_exception", limit_id: CASHEW_PERMITTED, parent: "no_nuts" },
  cashew: { concept_type: "hard_limit_exception", limit_id: CASHEW_PERMITTED, parent: "no_nuts" },
};

const PRACTICAL_TOKENS = {
  sheet: "sheet-pan",
  "sheet-pan": "sheet-pan",
  skillet: "skillet",
  air_fry: "air-fryer",
  "air-fry": "air-fryer",
  stovetop: "stovetop",
};

const DIETARY_LABELS = {
  plant: "plant",
  "dairy-free": "dairy_free",
};

const ALLERGEN_TOKENS = {
  dairy: "dairy",
  nuts: "nuts",
  cashew: "cashew",
  walnut: "walnut",
  peanut: "peanut",
  almond: "almond",
  pecan: "pecan",
  hazelnut: "hazelnut",
  pistachio: "pistachio",
  macadamia: "macadamia",
  "pine-nut": "pine_nut",
  shellfish: "shellfish",
  fish: "finfish",
  finfish: "finfish",
  poultry: "poultry",
  meat: "meat",
};

const UNRESOLVED_REASONS = {
  none: "Client sentinel for an empty limit list. Not a stored rule.",
  fish_spark:
    "The spark names finfish as a liking. Finfish permission is eligibility, not a taste. Specific fish already in the vocabulary stay ingredients.",
  dislike: "Stored dislike is not clearly Less often, and it is not a ban or an allergy.",
  neutral: "Neutral has no Love, Like, or Less often rank.",
  seafood: "Seafood can mean finfish, shellfish, or both. The specific tag is the one that maps.",
  "asian-fusion": "No single cuisine. Not Chinese, Thai, Japanese, or Korean.",
  fillet: "A cut, not a meal style.",
  handheld: "Could be tacos, a sandwich, or something else. The recipe's other tags decide.",
  packet: "A cooking wrap, not a meal style.",
  plate: "Generic plate, and the code default when meal format is omitted.",
  "side-main": "Not one meal style.",
  mixed: "Code default, not an authored texture or ingredient.",
  savory:
    "Bare savory is the code default when flavor_profile is omitted. Diner-chosen Savory still exists. These recipes are not tagged Savory from that default.",
  "warm-spiced": "Not clearly spicy, smoky, or savory.",
  beans: "Does not say which bean.",
  pasta_ingredient: "Pasta is a meal style here, not a second ingredient concept.",
  weeknight:
    "concept() defaults weeknight to true. That flag is not a diner hint and not taste evidence.",
  avoid_line: "Explanation kind avoid is presentation. It is not a hard limit or a Less often rank.",
  stovetop_default: "methods defaults to stovetop alone. That default is not authored equipment.",
  title_word: "A word in the title is not stored metadata. It is not mapped.",
};

function unresolved(source, value, reason) {
  return {
    source,
    value,
    status: "unresolved",
    concept_type: null,
    vocabulary_slug: null,
    vocabulary_slugs: [],
    limit_id: null,
    practical_detail: null,
    dietary_label: null,
    allergen: null,
    reason,
  };
}

function mapped(source, value, extra) {
  return {
    source,
    value,
    status: "mapped",
    concept_type: extra.concept_type,
    vocabulary_slug: extra.vocabulary_slug || null,
    vocabulary_slugs: extra.vocabulary_slugs || (extra.vocabulary_slug ? [extra.vocabulary_slug] : []),
    limit_id: extra.limit_id || null,
    practical_detail: extra.practical_detail || null,
    dietary_label: extra.dietary_label || null,
    allergen: extra.allergen || null,
    reason: extra.reason || null,
    includes_poultry: extra.includes_poultry || false,
    eligibility_only: extra.eligibility_only || false,
  };
}

function tasteHit(source, value, category) {
  const hit = resolveTasteTerm(value);
  if (hit.status !== "resolved" || hit.concept.category !== category) return null;
  return mapped(source, value, {
    concept_type: "taste",
    vocabulary_slug: hit.vocabulary_slug,
  });
}

/**
 * @param {string} source
 * @param {unknown} value
 */
export function classifyLegacyValue(source, value) {
  const raw = String(value ?? "").trim();
  const key = raw.toLowerCase();

  if (source === "constraint") {
    if (key === "none") return unresolved(source, raw, UNRESOLVED_REASONS.none);
    const row = CONSTRAINT_MAP[key];
    if (!row) return unresolved(source, raw, "No hard-limit id for this constraint.");
    return mapped(source, raw, row);
  }

  if (source === "evidence_kind") {
    if (key === "like") {
      return mapped(source, raw, {
        concept_type: "taste_rank",
        reason: "Like is the Like rank when the tag itself resolves to a taste. The tag is classified separately.",
      });
    }
    if (key === "dislike") return unresolved(source, raw, UNRESOLVED_REASONS.dislike);
    if (key === "neutral") return unresolved(source, raw, UNRESOLVED_REASONS.neutral);
    return unresolved(source, raw, "Unknown evidence kind.");
  }

  if (source === "spark") {
    if (key === "fish") return unresolved(source, raw, UNRESOLVED_REASONS.fish_spark);
    if (PRACTICAL_TOKENS[key]) {
      return mapped(source, raw, {
        concept_type: "practical",
        practical_detail: PRACTICAL_TOKENS[key],
        reason: "Sheet-pan easy is equipment, not a flavor.",
      });
    }
    const hit = resolveTasteTerm(key);
    if (hit.status === "resolved") {
      return mapped(source, raw, { concept_type: "taste", vocabulary_slug: hit.vocabulary_slug });
    }
    return unresolved(source, raw, "Spark does not match one taste.");
  }

  if (source === "cuisine") {
    const hit = tasteHit(source, key, "cuisine");
    if (hit) return hit;
    return unresolved(source, raw, UNRESOLVED_REASONS[key] || "Cuisine does not match one vocabulary cuisine.");
  }

  if (source === "meal_format") {
    if (PRACTICAL_TOKENS[key]) {
      return mapped(source, raw, {
        concept_type: "practical",
        practical_detail: PRACTICAL_TOKENS[key],
      });
    }
    const hit = tasteHit(source, key, "meal_style");
    if (hit) return hit;
    return unresolved(source, raw, UNRESOLVED_REASONS[key] || "Meal format is not one meal style.");
  }

  if (source === "texture") {
    if (!key || key === "mixed") return unresolved(source, raw, UNRESOLVED_REASONS.mixed);
    const hit = tasteHit(source, key, "texture");
    if (hit) return hit;
    return unresolved(source, raw, "Texture is not a vocabulary texture.");
  }

  if (source === "flavor_profile") {
    if (!key || key === "savory" || key === "mixed") {
      return unresolved(source, raw || "savory", UNRESOLVED_REASONS.savory);
    }
    const parts = key.split(/-+/).map((part) => part.trim()).filter(Boolean);
    /** @type {string[]} */
    const slugs = [];
    for (const part of parts) {
      const hit = resolveTasteTerm(part);
      if (hit.status !== "resolved" || hit.concept.category !== "flavor") {
        return unresolved(source, raw, UNRESOLVED_REASONS[key] || "Flavor profile is not a set of flavor terms.");
      }
      slugs.push(hit.vocabulary_slug);
    }
    return mapped(source, raw, { concept_type: "taste", vocabulary_slugs: slugs });
  }

  if (source === "tag") {
    if (ALLERGEN_TOKENS[key]) {
      return mapped(source, raw, { concept_type: "allergen", allergen: ALLERGEN_TOKENS[key] });
    }
    if (DIETARY_LABELS[key]) {
      return mapped(source, raw, { concept_type: "dietary", dietary_label: DIETARY_LABELS[key] });
    }
    if (key === "seafood") return unresolved(source, raw, UNRESOLVED_REASONS.seafood);
    if (PRACTICAL_TOKENS[key]) {
      return mapped(source, raw, {
        concept_type: "practical",
        practical_detail: PRACTICAL_TOKENS[key],
      });
    }
    const hit = resolveTasteTerm(key);
    if (hit.status === "resolved") {
      return mapped(source, raw, { concept_type: "taste", vocabulary_slug: hit.vocabulary_slug });
    }
    return unresolved(source, raw, "Tag is not a taste, allergen, or dietary label.");
  }

  if (source === "primary_ingredient") {
    if (!key || key === "mixed") return unresolved(source, raw, UNRESOLVED_REASONS.mixed);
    if (key === "beans") return unresolved(source, raw, UNRESOLVED_REASONS.beans);
    if (key === "pasta") return unresolved(source, raw, UNRESOLVED_REASONS.pasta_ingredient);
    const hit = tasteHit(source, key, "ingredient");
    if (hit) return hit;
    return unresolved(source, raw, "Primary ingredient is not one vocabulary ingredient.");
  }

  if (source === "method") {
    if (key === "grill") {
      return mapped(source, raw, {
        concept_type: "taste",
        vocabulary_slug: "grilled",
        practical_detail: "grill",
        reason: "An authored grill method is the grilled meal style and grill equipment. Grill-friendly remains a separate diner hint.",
      });
    }
    if (PRACTICAL_TOKENS[key]) {
      return mapped(source, raw, {
        concept_type: "practical",
        practical_detail: PRACTICAL_TOKENS[key],
      });
    }
    return unresolved(source, raw, "Method is not authored equipment.");
  }

  if (source === "weeknight_flag") return unresolved(source, raw, UNRESOLVED_REASONS.weeknight);
  if (source === "presentation") return unresolved(source, raw, UNRESOLVED_REASONS.avoid_line);

  return unresolved(source, raw, "Unknown legacy source.");
}

/**
 * Client keys to hard-limit rules. An exception without its parent is dropped.
 * @param {string[]} keys
 */
export function rulesFromLegacyKeys(keys) {
  const list = (keys || []).map((key) => String(key || "").trim()).filter((key) => key && key !== "none");
  /** @type {{ id: string, status: "prohibited"|"permitted" }[]} */
  const rules = [];
  const seen = new Set();
  for (const key of list) {
    const classified = classifyLegacyValue("constraint", key);
    if (classified.status !== "mapped") continue;
    if (classified.concept_type === "hard_limit_exception") {
      if (!list.includes("nuts") || seen.has(classified.limit_id)) continue;
      seen.add(classified.limit_id);
      rules.push({ id: classified.limit_id, status: "permitted" });
      continue;
    }
    if (seen.has(classified.limit_id)) continue;
    seen.add(classified.limit_id);
    rules.push({ id: classified.limit_id, status: "prohibited" });
  }
  return rules;
}

export function auditKnownClientPreferences() {
  const rows = [];
  for (const id of LEGACY_CONSTRAINT_IDS) rows.push(classifyLegacyValue("constraint", id));
  for (const id of LEGACY_SPARK_IDS) rows.push(classifyLegacyValue("spark", id));
  for (const id of LEGACY_EVIDENCE_KINDS) rows.push(classifyLegacyValue("evidence_kind", id));
  rows.push(classifyLegacyValue("weeknight_flag", "true"));
  rows.push(classifyLegacyValue("presentation", "avoid"));
  rows.push(classifyLegacyValue("flavor_profile", "savory"));
  return rows;
}

/**
 * Distinct catalog field values and how they classify.
 * Title words are not read.
 * @param {object[]} concepts
 */
export function auditCatalogFields(concepts) {
  /** @type {Map<string, ReturnType<typeof classifyLegacyValue>>} */
  const found = new Map();
  const add = (source, value) => {
    if (value == null || value === "") return;
    const row = classifyLegacyValue(source, value);
    found.set(`${source}:${String(value).toLowerCase()}`, row);
  };
  for (const concept of concepts || []) {
    add("cuisine", concept.cuisine);
    add("meal_format", concept.meal_format);
    add("texture", concept.texture);
    add("flavor_profile", concept.flavor_profile);
    add("primary_ingredient", concept.primary_ingredient);
    for (const tag of concept.tags || []) add("tag", tag);
    for (const spark of concept.sparks || []) add("spark", spark);
    const methods = concept.current_version?.methods || [];
    const soleDefault = methods.length === 1 && methods[0] === "stovetop";
    if (soleDefault) {
      found.set("method:stovetop-default", unresolved("method", "stovetop", UNRESOLVED_REASONS.stovetop_default));
    } else {
      for (const method of methods) add("method", method);
    }
  }
  return [...found.values()].sort((a, b) =>
    `${a.source}:${a.value}`.localeCompare(`${b.source}:${b.value}`)
  );
}

export function bbqResolution() {
  return {
    ...BBQ_RESOLUTION,
    resolved_slug: resolveTasteTerm("BBQ").vocabulary_slug,
    separate_barbecue_row: false,
  };
}
