/**
 * Objective culinary defects. These are not a flavor score and not a
 * salt-per-serving floor. Acid, garlic, onion, umami, oil, and garnish
 * are not required.
 *
 * Salt weights: UC ANR publication 390575, November 2023, "Salt for
 * Preserving and Cooking" (https://ucanr.edu/sites/default/files/2023-11/390575.pdf).
 * Diamond Crystal kosher 2.8 g/tsp, Morton coarse kosher 4.8 g/tsp,
 * canning/table salt 6 g/tsp. The spoons are not interchangeable.
 */

export const SALT_GRAMS_PER_TSP = Object.freeze({
  diamond_crystal: 2.8,
  morton_kosher: 4.8,
  table: 6,
});

export const SALT_REFERENCE =
  "UC ANR publication 390575 (November 2023): Diamond Crystal kosher salt 2.8 g per teaspoon, Morton coarse kosher salt 4.8 g per teaspoon, table salt 6 g per teaspoon.";

const FDA_SEAFOOD_F = 145;
const FDA_POULTRY_F = 165;
const FDA_GROUND_F = 160;
const FDA_WHOLE_MUSCLE_F = 145;

const BAN_RE =
  /\b(?:do not|don't) (?:add|salt)\b[^.!\n]{0,80}\b(?:salt|oil|cheese|butter|garlic|lemon|lime|herbs?|chili|pepper|cream|garnish|dill)\b|\b(?:none is added|no oil is listed|no oil and no cheese|there is no (?:chili|lime|garlic|oil|salt|lemon))\b/i;

const BAN_REASON_RE =
  /\b(because|already (salty|seasoned)|preserved lemon|allergen|dairy|plant-based|peanut contract|not part of this|would add|food safety|this package does not|hard contract|not in the ingredient)\b/i;

const BRAND_SALT_RE = /\b(diamond crystal|morton|table salt|canning salt|fine sea salt|flaky sea salt)\b/i;

const BOIL_STARCH_RE =
  /\b(boil|boiling)\b[\s\S]{0,180}\b(pasta|linguine|spaghetti|noodle|soba|udon|rice|couscous|quinoa|potato|potatoes|barley|farro|polenta)\b|\b(pasta|linguine|spaghetti|noodle|soba|udon|rice|couscous|quinoa|potato|potatoes)\b[\s\S]{0,180}\b(boil|boiling)\b/i;

const RATIO_RE =
  /\b\d+(?:\.\d+)?\s*(?:%|percent\b)|\b\d+(?:\.\d+)?\s*g\b[\s\S]{0,80}\b(?:water|qt|quart|liter|cups?)\b|\b(?:water|qt|quart|liter|cups?)\b[\s\S]{0,80}\b\d+(?:\.\d+)?\s*g\b|\bper\s+\d*\s*(?:qt|quart|liter|cups?)\b/i;

const UNSALTED_REASON_RE =
  /\b(unsalted|do not salt|don't salt)\b[\s\S]{0,160}\b(because|the (soy|miso|dressing|sauce|broth|stock) seasons)\b/i;

const RAW_TASTE_RE =
  /\btaste the (raw )?(chicken|salmon|fish fillet|shrimp|pork|ground beef|burger)\b/i;

const OPTIONAL_SPAN_RE = /\bOptional\b[\s\S]{0,800}?immunocompromised/gi;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function ingredientsOf(pkg) {
  return asArray(pkg?.recipe_version?.ingredients);
}

function stepsOf(pkg) {
  return asArray(pkg?.recipe_version?.steps);
}

function ingredientLabel(item) {
  return String(item?.name || item?.display_name || "").trim();
}

function stepBlob(step) {
  return `${step?.title || ""}\n${step?.body || ""}\n${asArray(step?.ingredient_refs).join("\n")}`;
}

function roundQuarter(value) {
  return Math.round(value * 4) / 4;
}

/**
 * Gram weight is authoritative. Volumes are the UC ANR teaspoon weights,
 * rounded to the nearest 1/4 teaspoon for the spoon the cook is holding.
 * @param {number} grams
 */
export function saltEquivalents(grams) {
  const g = Number(grams);
  return {
    grams: g,
    diamond_crystal_tsp: roundQuarter(g / SALT_GRAMS_PER_TSP.diamond_crystal),
    morton_kosher_tsp: roundQuarter(g / SALT_GRAMS_PER_TSP.morton_kosher),
    table_tsp: roundQuarter(g / SALT_GRAMS_PER_TSP.table),
    reference: SALT_REFERENCE,
  };
}

export function saltNote(grams, role = "") {
  const eq = saltEquivalents(grams);
  const roleText = role ? `${role} ` : "";
  return (
    `${roleText}${eq.grams} g Diamond Crystal kosher salt ` +
    `(${eq.diamond_crystal_tsp} tsp). The same weight is ${eq.morton_kosher_tsp} tsp Morton coarse kosher salt ` +
    `or ${eq.table_tsp} tsp table salt. ${SALT_REFERENCE}`
  );
}

function push(list, code, detail) {
  list.push({ code, detail });
}

function saltIngredient(item) {
  return /\bsalt\b/i.test(ingredientLabel(item));
}

function saltIsSpecified(item) {
  const text = `${ingredientLabel(item)} ${item?.note || ""} ${item?.unit || ""}`;
  const grams = item?.unit === "g" || item?.unit === "gram" || item?.unit === "grams" || /\bg\b|\bgrams?\b/i.test(String(item?.note || ""));
  return BRAND_SALT_RE.test(text) && (grams || item?.unit === "g");
}

function proteinClass(pkg) {
  const version = pkg?.recipe_version || {};
  const elig = version.dietary_eligibility || {};
  const text = `${pkg?.dish?.title || ""} ${version.title || ""} ${ingredientsOf(pkg).map(ingredientLabel).join(" ")}`
    .toLowerCase()
    .replace(/\bfish sauce\b/g, " ")
    .replace(/\bchar siu\b/g, " ");
  if (elig.contains_poultry === true || /\b(chicken|turkey|duck)\b/.test(text)) return "poultry";
  if (/\bground (beef|pork|turkey|chicken|lamb)\b|\bburger\b/.test(text)) return "ground";
  if (
    elig.contains_finfish === true ||
    elig.contains_shellfish === true ||
    /\b(salmon|cod|shrimp|clam|tuna|trout|arctic char|scallop|halibut|branzino|swordfish|mussel|barramundi|fish)\b/.test(text)
  ) {
    return "seafood";
  }
  if (elig.contains_meat === true || /\b(steak|beef|pork chop|lamb)\b/.test(text)) return "whole_muscle";
  return null;
}

function banHasReason(body, pkg) {
  if (BAN_REASON_RE.test(body)) return true;
  const version = pkg?.recipe_version || {};
  const elig = version.dietary_eligibility || {};
  const labels = [
    ...asArray(version.dietary_labels),
    ...asArray(version.dietary_tags),
    ...asArray(pkg?.projection?.dietary_labels),
    ...asArray(pkg?.dish?.tags),
  ].map((item) => String(item).toLowerCase());
  const dairyFree =
    labels.includes("dairy_free") || labels.includes("dairy-free") || elig.contains_dairy === false;
  const plant =
    labels.includes("plant") ||
    labels.includes("plant_based") ||
    labels.includes("plant-based") ||
    elig.plant_based_compatible === true;
  if (dairyFree && /\b(cheese|butter|milk|cream|yogurt|dairy)\b/i.test(body)) return true;
  if (plant && /\b(meat|bacon|fish sauce|shrimp|pork|beef|chicken|sausage)\b/i.test(body)) return true;
  if (/\bthere is no lime in this dish\b/i.test(body)) return true;
  if (/\bdo not add oil\b/i.test(body) && /\b(char|dry skillet|dry pan)\b/i.test(body)) return true;
  return false;
}

function fdaFloor(kind) {
  if (kind === "poultry") return FDA_POULTRY_F;
  if (kind === "ground") return FDA_GROUND_F;
  if (kind === "seafood" || kind === "shellfish") return FDA_SEAFOOD_F;
  if (kind === "whole_muscle") return FDA_WHOLE_MUSCLE_F;
  return null;
}

function labeledOptionalSpans(prose) {
  /** @type {[number, number][]} */
  const spans = [];
  for (const match of prose.matchAll(OPTIONAL_SPAN_RE)) {
    const slice = match[0];
    if (!/does not meet/i.test(slice)) continue;
    if (!/higher risk/i.test(slice)) continue;
    if (!/USDA\/FDA|USDA|FDA/i.test(slice)) continue;
    spans.push([match.index, match.index + slice.length]);
  }
  return spans;
}

function spanCovers(index, spans) {
  return spans.some(([start, end]) => index >= start && index < end);
}

function blankSpans(prose, spans) {
  let out = prose;
  for (const [start, end] of [...spans].reverse()) {
    out = `${out.slice(0, start)}${" ".repeat(end - start)}${out.slice(end)}`;
  }
  return out;
}

function temperatureWindowKind(window, dishKind) {
  const text = window.replace(/\bfish sauce\b/gi, " ");
  if (/\b(shrimp|scallops?)\b/i.test(text)) return "shellfish";
  if (/\b(salmon|tuna|halibut|branzino|swordfish|cod|fish|fillet)\b/i.test(text)) return "seafood";
  if (/\b(chicken|turkey|duck|breast)\b/i.test(text)) return "poultry";
  if (/\b(steak|beef|pork|lamb|chop)\b/i.test(text)) return "whole_muscle";
  if (/\bground\b/i.test(text)) return "ground";
  return dishKind;
}

function mentionsInternalOrProtein(window) {
  return /\b(internal|thickest|center|interior|doneness|chicken|turkey|duck|salmon|cod|fish|shrimp|scallop|tuna|steak|beef|pork|lamb|halibut|branzino|swordfish|chop|fillet|breast)\b/i.test(
    window.replace(/\bfish sauce\b/gi, " ")
  );
}

/** A doneness cue, including "pull at 120 F" with no protein noun in the window. */
function aboutDoneness(window) {
  const text = window.replace(/\bfish sauce\b/gi, " ");
  return (
    /\b(internal|thickest|center|doneness|chicken|turkey|duck|salmon|cod|fish|shrimp|clam|tuna|steak|beef|pork|lamb|scallop|halibut|branzino|chop|fillet|breast|pull|target|at least|medium-rare|medium rare)\b/i.test(
      text
    )
  );
}

/**
 * Oven, grill, and skillet settings are not a doneness target.
 * A window that also says pull, target, or at least is still doneness.
 */
function applianceSettingOnly(window) {
  if (!looksLikeApplianceHeat(window)) return false;
  return !/\b(pull|target|at least|medium-rare|medium rare|internal|doneness)\b/i.test(window);
}

/** "130 F is a diner's choice" names a preference. It does not tell the cook to stop there. */
function dinerChoiceAside(window) {
  return /diner['’]s choice/i.test(window) && !/\b(pull|target|at least)\b/i.test(window);
}

function collectText(value, out) {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectText(item, out);
  }
}

function looksLikeApplianceHeat(window) {
  return (
    /\b(oven|grill|grates|broiler|broil|preheat|direct high heat|smoking)\b/i.test(window) &&
    !/\b(internal|thickest|center|interior)\b/i.test(window)
  );
}

/**
 * Shrimp and scallops may state the FDA primary as opaque and firm.
 * Every other protein needs an internal temperature at or above the floor,
 * outside any labeled optional note, and not an oven or grill setting.
 */
function primaryIsSafe(primary, windowKind, windowFloor) {
  if (windowKind === "shellfish" && /\bopaque\b/i.test(primary) && /\bfirm\b/i.test(primary)) return true;
  const temps = [...primary.matchAll(/(\d{2,3})(?:\s*°|\s*degrees)?\s*F\b/gi)];
  for (const match of temps) {
    const temp = Number(match[1]);
    if (temp < windowFloor) continue;
    const at = match.index || 0;
    const window = primary.slice(Math.max(0, at - 90), at + 80);
    if (looksLikeApplianceHeat(window)) continue;
    if (!mentionsInternalOrProtein(window)) continue;
    return true;
  }
  return false;
}

/**
 * @param {object} pkg catalog package
 * @returns {{ fails: {code: string, detail: string}[], warnings: {code: string, detail: string}[] }}
 */
export function assessCulinaryQuality(pkg) {
  /** @type {{code: string, detail: string}[]} */
  const fails = [];
  /** @type {{code: string, detail: string}[]} */
  const warnings = [];
  const version = pkg?.recipe_version || {};
  const ingredients = ingredientsOf(pkg);
  const steps = stepsOf(pkg);
  const overrides = new Set(asArray(pkg?.reviewer_overrides || version.reviewer_overrides));
  const labels = ingredients.map(ingredientLabel).filter(Boolean);
  const ids = new Set(ingredients.map((item) => item?.ingredient_id).filter(Boolean));
  const names = new Set(labels.map((name) => name.toLowerCase()));

  for (const [index, item] of ingredients.entries()) {
    const name = ingredientLabel(item);
    if (!name) {
      push(fails, "ingredient_name", `ingredients[${index}] has no name`);
      continue;
    }
    const qty = item.quantity;
    const numeric = typeof qty === "number" && Number.isFinite(qty) && qty > 0;
    const textual = typeof qty === "string" && /\d/.test(qty);
    if (!numeric && !textual) push(fails, "ingredient_amount", `${name} has no usable amount`);
    if (numeric && !item.unit) push(fails, "ingredient_unit", `${name} has a number and no unit`);
    const refHit = steps.some((step) => {
      const blob = stepBlob(step).toLowerCase();
      const refs = asArray(step?.ingredient_refs).map((ref) => String(ref).toLowerCase());
      return (
        refs.includes(name.toLowerCase()) ||
        (item.ingredient_id && refs.includes(String(item.ingredient_id).toLowerCase())) ||
        blob.includes(name.toLowerCase())
      );
    });
    if (!refHit) push(fails, "unused_ingredient", name);
    if (saltIngredient(item) && !saltIsSpecified(item)) {
      push(fails, "salt_type", `${name} does not name a salt and a gram weight (${SALT_REFERENCE})`);
    }
  }

  steps.forEach((step, index) => {
    const body = String(step?.body || "");
    for (const ref of asArray(step?.ingredient_refs)) {
      const key = String(ref).toLowerCase();
      if (!names.has(key) && !ids.has(ref) && ![...ids].some((id) => String(id).toLowerCase() === key)) {
        push(fails, "unlisted_ingredient", `step ${index + 1} refs ${ref}`);
      }
    }
    if (BAN_RE.test(body) && !banHasReason(body, pkg) && !overrides.has(`do_not_add:${index + 1}`)) {
      push(fails, "unexplained_ban", `step ${index + 1}: ${body.slice(0, 140)}`);
    }
    if (RAW_TASTE_RE.test(body) && !/\bcooked\b/i.test(body)) {
      push(fails, "taste_raw", `step ${index + 1}`);
    }
  });

  const fields = [];
  collectText(pkg, fields);
  const served = `${version.doneness || ""}\n${steps.map((step) => step?.body || "").join("\n")}`;
  const kind = proteinClass(pkg);
  const floor = fdaFloor(kind);
  if (floor) {
    /** @type {{windowKind: string, windowFloor: number, temp: number}[]} */
    const optionalLows = [];
    for (const prose of fields) {
      const spans = labeledOptionalSpans(prose);
      const temps = [...prose.matchAll(/(\d{2,3})(?:\s*°|\s*degrees)?\s*F\b/gi)];
      for (const match of temps) {
        const temp = Number(match[1]);
        if (temp >= floor) continue;
        const at = match.index || 0;
        const window = prose.slice(Math.max(0, at - 90), at + 80);
        if (!aboutDoneness(window)) continue;
        const windowKind = temperatureWindowKind(window, kind);
        const windowFloor = fdaFloor(windowKind) || floor;
        if (temp >= windowFloor) continue;
        if (spanCovers(at, spans)) {
          optionalLows.push({ windowKind, windowFloor, temp });
          continue;
        }
        if (applianceSettingOnly(window)) continue;
        if (dinerChoiceAside(window)) continue;
        const doneness = String(version.doneness || "");
        const carryoverStated =
          new RegExp(`(?:carryover|rises to|rising to)[\\s\\S]{0,40}\\b${windowFloor}\\s*F\\b`, "i").test(doneness) ||
          new RegExp(`(?:carryover|rises to|rising to)[\\s\\S]{0,40}\\b${windowFloor}\\s*F\\b`, "i").test(window);
        if (carryoverStated && temp >= windowFloor - 10) continue;
        push(fails, "unsafe_temperature", `${windowKind} instruction ${temp} F is below the FDA ${windowFloor} F default`);
      }
    }
    if (optionalLows.length) {
      const primary = blankSpans(served, labeledOptionalSpans(served));
      const seen = new Set();
      for (const item of optionalLows) {
        const key = `${item.windowKind}:${item.windowFloor}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!primaryIsSafe(primary, item.windowKind, item.windowFloor)) {
          push(
            fails,
            "unsafe_temperature",
            `${item.windowKind} names ${item.temp} F inside an optional note, and the primary instruction is not the FDA default`
          );
        }
      }
    }
  }

  const boil = steps.map((step) => step?.body || "").join("\n");
  if (BOIL_STARCH_RE.test(boil) && !RATIO_RE.test(boil) && !UNSALTED_REASON_RE.test(boil) && !overrides.has("boiling_salt_ratio")) {
    push(warnings, "boiling_salt_ratio", "Boiled starch or potatoes have no salt ratio and no stated reason to leave the water unsalted");
  }

  return { fails, warnings };
}

export function culinaryQualityPasses(pkg) {
  return assessCulinaryQuality(pkg).fails.length === 0;
}
