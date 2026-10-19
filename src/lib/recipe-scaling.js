/**
 * Scale canonical recipe versions to household serving count (alpha default).
 * Keeps base servings on the version; returns scaled quantities for display/cook.
 *
 * Kitchen rounding stays within about 15% of the exact scaled amount.
 * Cups use quarter, third, and eighth fractions, and amounts under ¼ cup
 * are shown in tablespoons or teaspoons. Weights use the same idea.
 * Only real count items (the unit, or the ingredient's head noun) snap to
 * a whole or a half. "large shrimp" and "onion powder" are not counts.
 *
 * The shopping list stores the exact scaled quantity in the recipe's unit,
 * to three decimal places. It does not round up to a purchasable package.
 * A recipe line of 2 tbsp is the same amount as a list line of 0.125 cup.
 */

const FRAC_CHAR = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
};

const FRAC_CLASS = "½⅓⅔¼¾⅛⅜";

const UNIT_SINGULAR = {
  cups: "cup",
  cup: "cup",
  tablespoons: "tbsp",
  tablespoon: "tbsp",
  teaspoons: "tsp",
  teaspoon: "tsp",
  tbsp: "tbsp",
  tsp: "tsp",
  cloves: "clove",
  clove: "clove",
  cans: "can",
  can: "can",
  ounces: "oz",
  ounce: "oz",
  oz: "oz",
  pounds: "lb",
  pound: "lb",
  lbs: "lb",
  lb: "lb",
  grams: "g",
  gram: "g",
  g: "g",
  kilograms: "kg",
  kilogram: "kg",
  kg: "kg",
  milliliters: "ml",
  milliliter: "ml",
  ml: "ml",
  liters: "l",
  liter: "l",
  l: "l",
  quarts: "qt",
  quart: "qt",
  qt: "qt",
  fillets: "fillet",
  fillet: "fillet",
  eggs: "egg",
  egg: "egg",
  onions: "onion",
  onion: "onion",
  limes: "lime",
  lime: "lime",
  avocados: "avocado",
  avocado: "avocado",
  tortillas: "tortilla",
  tortilla: "tortilla",
  bunches: "bunch",
  bunch: "bunch",
  heads: "head",
  head: "head",
  pieces: "piece",
  piece: "piece",
  slices: "slice",
  slice: "slice",
  breasts: "breast",
  breast: "breast",
  thighs: "thigh",
  thigh: "thigh",
  stalks: "stalk",
  stalk: "stalk",
  links: "link",
  link: "link",
  strips: "strip",
  strip: "strip",
};

const MEASURE_UNITS = new Set(["cup", "tbsp", "tsp", "oz", "lb", "g", "kg", "ml", "l", "qt"]);

/** The unit token itself is a count. Size words count only when they are the unit, as in "8 small". */
const COUNT_UNITS = new Set([
  "each",
  "whole",
  "clove",
  "fillet",
  "egg",
  "can",
  "onion",
  "lime",
  "avocado",
  "tortilla",
  "count",
  "piece",
  "slice",
  "breast",
  "thigh",
  "bunch",
  "head",
  "stalk",
  "link",
  "strip",
  "small",
  "medium",
  "large",
]);

const COUNT_NOUNS = new Set([
  "egg",
  "eggs",
  "fillet",
  "fillets",
  "clove",
  "cloves",
  "can",
  "cans",
  "onion",
  "onions",
  "lime",
  "limes",
  "avocado",
  "avocados",
  "tortilla",
  "tortillas",
  "breast",
  "breasts",
  "thigh",
  "thighs",
  "bunch",
  "bunches",
  "head",
  "heads",
]);

const NAME_SKIP = new Set([
  "large",
  "small",
  "medium",
  "whole",
  "fresh",
  "raw",
  "dried",
  "boneless",
  "skinless",
  "ground",
  "baby",
  "extra",
  "virgin",
  "kosher",
  "chopped",
  "diced",
  "minced",
  "sliced",
  "grated",
]);

const DISPLAY_FRACTIONS = [
  [0.125, "⅛"],
  [1 / 3, "⅓"],
  [0.25, "¼"],
  [0.375, "⅜"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

const CUP_FRACTIONS = [0, 0.25, 1 / 3, 0.375, 0.5, 2 / 3, 0.75];
const RELATIVE_LIMIT = 0.15;

/**
 * @param {string|undefined} raw
 * @returns {number|null}
 */
function parseAmount(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s || /for serving/i.test(s)) return null;
  let m = s.match(new RegExp(`^(\\d+)\\s*([${FRAC_CLASS}])?$`));
  if (m) {
    const whole = Number(m[1]);
    const frac = m[2] ? FRAC_CHAR[m[2]] || 0 : 0;
    return whole + frac;
  }
  m = s.match(new RegExp(`^([${FRAC_CLASS}])$`));
  if (m) return FRAC_CHAR[m[1]] ?? null;
  m = s.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]);
  m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  return null;
}

function singularUnit(token) {
  const key = String(token || "").trim().toLowerCase();
  if (!key) return "";
  return UNIT_SINGULAR[key] || key;
}

function headNoun(name) {
  const words = String(name || "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean)
    .filter((word) => !NAME_SKIP.has(word));
  return words[words.length - 1] || "";
}

/**
 * True when the line is a countable thing, not a measured weight or volume.
 * The unit wins. A measure unit is never a count, even if the name says "onion" or "large".
 * With no unit, only the last noun counts, so "onion powder" stays a measure.
 * @param {string} unit
 * @param {string} [name]
 */
export function isCountItem(unit, name = "") {
  const token = singularUnit(unit);
  if (token && MEASURE_UNITS.has(token)) return false;
  if (token && COUNT_UNITS.has(token)) return true;
  if (token) return false;
  const noun = headNoun(name);
  return COUNT_NOUNS.has(noun);
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  for (const [value, glyph] of DISPLAY_FRACTIONS) {
    if (Math.abs(frac - value) < 0.02) return whole > 0 ? `${whole}${glyph}` : glyph;
  }
  const trimmed = (Math.round(n * 100) / 100).toString().replace(/\.?0+$/, "");
  return trimmed;
}

function displayUnit(unit, amount) {
  if (!unit || unit === "count") return "";
  if (unit === "fl oz") return "fl oz";
  if (["tbsp", "tsp", "oz", "lb", "g", "kg", "ml", "l", "qt", "small", "medium", "large", "each", "whole"].includes(unit)) {
    return unit;
  }
  const plural = amount > 1.001;
  if (!plural) return unit;
  if (unit === "cup") return "cups";
  if (unit === "clove") return "cloves";
  if (unit === "can") return "cans";
  if (unit === "fillet") return "fillets";
  if (unit === "egg") return "eggs";
  if (unit === "bunch") return "bunches";
  if (unit === "head") return "heads";
  return unit;
}

function joinQuantity(amount, unit, tail) {
  return [formatNumber(amount), displayUnit(unit, amount), tail].filter(Boolean).join(" ");
}

function nearest(n, steps, floor = 0) {
  let best = null;
  let bestDelta = Infinity;
  const start = Math.max(0, Math.floor(n) - 1);
  const end = Math.ceil(n) + 1;
  for (let whole = start; whole <= end; whole += 1) {
    for (const step of steps) {
      const value = whole + step;
      if (value < floor - 1e-9) continue;
      const delta = Math.abs(value - n);
      if (delta < bestDelta - 1e-12) {
        best = value;
        bestDelta = delta;
      }
    }
  }
  return best == null ? n : best;
}

function within(n, snapped) {
  if (!(n > 0)) return snapped === 0;
  return Math.abs(snapped - n) / n <= RELATIVE_LIMIT + 1e-9;
}

function snapStep(n, step) {
  if (!(n > 0)) return 0;
  const snapped = Math.round(n / step) * step;
  if (snapped > 0 && within(n, snapped)) return snapped;
  const finer = Math.round(n * 10) / 10;
  if (within(n, finer)) return finer;
  return Math.round(n * 100) / 100;
}

function snapCount(n) {
  if (!(n > 0)) return 0;
  const snapped = Math.round(n * 2) / 2;
  return snapped < 0.5 ? 0.5 : snapped;
}

function snapTsp(tsp) {
  if (!(tsp > 0)) return { amount: 0, unit: "tsp" };
  const snapped = nearest(tsp, [0, 0.125, 1 / 3, 0.25, 0.375, 0.5, 2 / 3, 0.75, 0.875]);
  if (snapped > 0 && within(tsp, snapped)) return { amount: snapped, unit: "tsp" };
  const fine = Math.round(tsp * 100) / 100;
  return { amount: fine > 0 ? fine : Math.round(tsp * 1000) / 1000, unit: "tsp" };
}

function snapTbsp(tbsp) {
  if (!(tbsp > 0)) return { amount: 0, unit: "tbsp" };
  if (tbsp >= 0.5) {
    const snapped = nearest(tbsp, [0, 0.25, 0.5, 0.75]);
    if (within(tbsp, snapped)) return { amount: snapped, unit: "tbsp" };
  }
  return snapTsp(tbsp * 3);
}

function snapCups(cups) {
  if (!(cups > 0)) return { amount: 0, unit: "cup" };
  if (cups < 0.25 - 1e-9) return snapTbsp(cups * 16);
  return { amount: nearest(cups, CUP_FRACTIONS, 0.25), unit: "cup" };
}

function snapQuarts(qt) {
  if (!(qt > 0)) return { amount: 0, unit: "qt" };
  if (qt < 0.25 - 1e-9) return snapCups(qt * 4);
  return { amount: nearest(qt, CUP_FRACTIONS, 0.25), unit: "qt" };
}

function snapLiters(liters) {
  if (!(liters > 0)) return { amount: 0, unit: "l" };
  if (liters < 0.25 - 1e-9) return { amount: snapStep(liters * 1000, 5), unit: "ml" };
  return { amount: nearest(liters, CUP_FRACTIONS, 0.25), unit: "l" };
}

function snapPounds(lb) {
  if (!(lb > 0)) return { amount: 0, unit: "lb" };
  if (lb < 0.25 - 1e-9) return { amount: snapStep(lb * 16, 0.25), unit: "oz" };
  return { amount: nearest(lb, CUP_FRACTIONS, 0.25), unit: "lb" };
}

function snapAmount(amount, unit) {
  if (unit === "cup") return snapCups(amount);
  if (unit === "qt") return snapQuarts(amount);
  if (unit === "l") return snapLiters(amount);
  if (unit === "lb") return snapPounds(amount);
  if (unit === "tbsp") return snapTbsp(amount);
  if (unit === "tsp") return snapTsp(amount);
  if (unit === "fl oz") return { amount: snapStep(amount, amount >= 1 ? 0.25 : 0.1), unit: "fl oz" };
  if (unit === "g" || unit === "ml") return { amount: amount >= 2 ? snapStep(amount, 0.5) : snapStep(amount, 0.1), unit };
  if (unit === "kg") {
    if (amount < 0.05) return { amount: snapStep(amount * 1000, 0.5), unit: "g" };
    return { amount: snapStep(amount, 0.01), unit: "kg" };
  }
  if (unit === "oz") return { amount: snapStep(amount, amount >= 1 ? 0.25 : 0.1), unit: "oz" };
  if (isCountItem(unit, "")) return { amount: snapCount(amount), unit };
  return { amount: snapStep(amount, 0.01), unit };
}

function splitRest(rest) {
  const parts = String(rest || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { unit: "", tail: "" };
  const first = parts[0].toLowerCase();
  const second = (parts[1] || "").toLowerCase();
  if ((first === "fl" || first === "fluid") && (second === "oz" || second === "ounce" || second === "ounces")) {
    return { unit: "fl oz", tail: parts.slice(2).join(" ") };
  }
  return { unit: singularUnit(parts[0]), tail: parts.slice(1).join(" ") };
}

/** @param {string} quantity @returns {{ amount: number, unit: string }|null} */
export function parsedQuantity(quantity) {
  const text = String(quantity || "").trim();
  const leading = text.match(new RegExp(`^([\\d${FRAC_CLASS}./\\s]+)\\s*(.*)$`));
  if (!leading) return null;
  const amount = parseAmount(leading[1].trim().replace(/\s+/g, " "));
  if (amount == null) return null;
  return { amount, unit: splitRest(leading[2]).unit };
}

/**
 * Read a scaled display string back into `baseUnit` so an audit can compare it
 * with the exact scaled number. Tablespoons under a cup compare as cups.
 * @param {string} display
 * @param {string} baseUnit
 * @returns {number|null}
 */
export function interpretedAmount(display, baseUnit) {
  const parsed = parsedQuantity(display);
  if (!parsed) return null;
  const amount = parsed.amount;
  const shown = parsed.unit === "fl oz" ? "fl oz" : singularUnit(parsed.unit);
  const base = baseUnit === "fl oz" ? "fl oz" : singularUnit(baseUnit);
  if (!shown || shown === base || shown === "count" || base === "count") return amount;
  const toCup = { cup: 1, tbsp: 1 / 16, tsp: 1 / 48 };
  const toTbsp = { tbsp: 1, tsp: 1 / 3 };
  const toLb = { lb: 1, oz: 1 / 16 };
  const toQt = { qt: 1, cup: 1 / 4, tbsp: 1 / 64, tsp: 1 / 192 };
  const toL = { l: 1, ml: 0.001 };
  const toG = { g: 1, kg: 1000 };
  const families = [toCup, toTbsp, toLb, toQt, toL, toG];
  for (const family of families) {
    if (family[shown] != null && family[base] != null) return (amount * family[shown]) / family[base];
  }
  return null;
}

/**
 * @param {string|undefined} quantity
 * @param {number} ratio
 * @param {string} [ingredientName]
 */
export function scaleIngredientQuantity(quantity, ratio, ingredientName = "", dinerCount = null) {
  const q = String(quantity || "").trim();
  if (q.toLowerCase() === "for serving" && dinerCount != null) {
    return `${dinerCount} serving${dinerCount === 1 ? "" : "s"}`;
  }
  if (!quantity || ratio === 1) return quantity;
  if (/^for serving$/i.test(q)) return q;

  const parenCount = q.match(/^(\d+)\s*(\([^)]+\))(.*)$/i);
  if (parenCount) {
    const count = formatNumber(snapCount(Number(parenCount[1]) * ratio));
    const tail = parenCount[3].trim();
    return tail ? `${count} ${parenCount[2]} ${tail}` : `${count} ${parenCount[2]}`;
  }

  const leading = q.match(new RegExp(`^([\\d${FRAC_CLASS}./\\s]+)\\s*(.*)$`));
  if (!leading) return q;
  const amountRaw = leading[1].trim();
  const rest = leading[2].trim();
  const base = parseAmount(amountRaw.replace(/\s+/g, " "));
  if (base == null) return q;
  const scaled = base * ratio;
  const { unit, tail } = splitRest(rest);
  const count = isCountItem(unit, ingredientName);
  const snapped = count ? { amount: snapCount(scaled), unit } : snapAmount(scaled, unit);
  return joinQuantity(snapped.amount, snapped.unit, tail);
}

/**
 * @param {import('./recipe-store.js').RecipeVersion} version
 * @param {number} targetServings diner count for this view
 */
export function scaleRecipeVersion(version, targetServings) {
  const baseServings = version.base_servings ?? version.servings ?? 4;
  const requested = Math.max(1, Math.min(8, Number(targetServings) || baseServings));
  const ratio = requested / baseServings;
  const ingredients = (version.ingredients || []).map((ing) => {
    const unit = String(ing.unit || "").toLowerCase();
    const raw = String(ing.quantity || "").trim();
    if (unit === "serving" || /^for serving$/i.test(raw)) {
      return {
        ...ing,
        quantity: `${requested} serving${requested === 1 ? "" : "s"}`,
      };
    }
    return {
      ...ing,
      quantity: scaleIngredientQuantity(ing.quantity, ratio, ing.name, requested),
    };
  });
  return {
    ...version,
    servings: requested,
    base_servings: baseServings,
    requested_servings: requested,
    scale_factor: ratio,
    ingredients,
  };
}
