/** Shopping list quantity formatting and post-change row tags (Cycle 3). */

export const SHOP_QTY_FRACS = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [3 / 8, "3/8"],
  [1 / 3, "1/3"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
];

const QTY_EPS = 1e-6;
const SHOP_LINE_EPS = 1e-6;
/**
 * Stored quantities are rounded to 3 decimals (roundQuantity).
 * 1/3 and 2/3 land as 0.333 and 0.667. Half a thousandth covers that
 * pair only. Other fractions still need an exact match.
 */
const STORED_THIRD_TOL = 0.00051;

/** @param {object} line */
export function normalizeShopLineForCompare(line) {
  if (!line) return null;
  return {
    line_id: line.line_id,
    quantity: Number(line.quantity) || 0,
    still_needed: !!line.still_needed,
    list_state: line.list_state || "open",
  };
}

function shopLineCompareKey(line) {
  if (!line || !line.ingredient_id) return null;
  return String(line.ingredient_id) + "\0" + String(line.unit || "");
}

function shopCompareMap(lines) {
  const map = new Map();
  for (const line of lines || []) {
    const key = shopLineCompareKey(line);
    const row = normalizeShopLineForCompare(line);
    if (!key || !row) continue;
    map.set(key, row);
  }
  return map;
}

/**
 * Whether shopping lines changed in a way that should surface a list toast.
 * @param {object[]} beforeLines
 * @param {object[]} afterLines
 */
export function shopListMateriallyChanged(beforeLines, afterLines) {
  const before = shopCompareMap(beforeLines);
  const after = shopCompareMap(afterLines);
  const ids = new Set([...before.keys(), ...after.keys()]);
  for (const id of ids) {
    const b = before.get(id);
    const a = after.get(id);
    if (!b || !a) return true;
    if (
      Math.abs(b.quantity - a.quantity) > SHOP_LINE_EPS ||
      b.still_needed !== a.still_needed ||
      b.list_state !== a.list_state
    ) {
      return true;
    }
  }
  return false;
}

function neededQty(row) {
  return row && row.still_needed ? row.quantity : 0;
}

/**
 * Counts for the post-shopping list-change toast from a before/after diff only.
 * @param {object[]} beforeLines
 * @param {object[]} afterLines
 */
export function shopListChangeCounts(beforeLines, afterLines) {
  const before = shopCompareMap(beforeLines);
  const after = shopCompareMap(afterLines);
  const ids = new Set([...before.keys(), ...after.keys()]);
  let added = 0;
  let removed = 0;
  for (const id of ids) {
    const b = before.get(id);
    const a = after.get(id);
    if (!b && a) {
      if (a.still_needed) added++;
      continue;
    }
    if (b && !a) {
      if (b.still_needed) removed++;
      continue;
    }
    if (!b || !a) continue;
    const bNeed = neededQty(b);
    const aNeed = neededQty(a);
    if (!b.still_needed && a.still_needed) added++;
    else if (b.still_needed && !a.still_needed) removed++;
    else if (b.still_needed && a.still_needed) {
      if (aNeed > bNeed + SHOP_LINE_EPS) added++;
      else if (bNeed > aNeed + SHOP_LINE_EPS) removed++;
    }
  }
  return { added, removed };
}

function fractionTolerance(target) {
  if (Math.abs(target - 1 / 3) < 1e-12 || Math.abs(target - 2 / 3) < 1e-12) return STORED_THIRD_TOL;
  return QTY_EPS;
}

export function formatShopQuantityAmount(num) {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const whole = Math.floor(abs + QTY_EPS);
  const fracPart = abs - whole;
  if (fracPart < QTY_EPS) return sign + String(whole);
  for (let i = 0; i < SHOP_QTY_FRACS.length; i++) {
    const pair = SHOP_QTY_FRACS[i];
    if (Math.abs(fracPart - pair[0]) < fractionTolerance(pair[0])) {
      return whole > 0 ? sign + whole + " " + pair[1] : sign + pair[1];
    }
  }
  const trimmed = String(abs);
  const short = trimmed.indexOf(".") >= 0 ? trimmed.replace(/\.?0+$/, "") : trimmed;
  return sign + short;
}

export function formatShopQty(line) {
  if (line.quantity == null || line.quantity === "") return "";
  const raw = line.quantity;
  const num = typeof raw === "number" ? raw : Number(raw);
  let amount;
  if (!Number.isNaN(num) && String(raw).trim() !== "") {
    amount = formatShopQuantityAmount(num);
  } else {
    amount = String(raw);
  }
  const unit = line.unit;
  if (!unit || unit === "count") return amount;
  return amount + " " + unit;
}

/** Unicode for the fractions formatShopQuantityAmount already recognizes. No new rounding. */
export const SHOP_QTY_UNICODE = Object.freeze({
  "1/8": "⅛",
  "1/4": "¼",
  "3/8": "⅜",
  "1/3": "⅓",
  "1/2": "½",
  "2/3": "⅔",
  "3/4": "¾",
});

const DISPLAY_UNIT = Object.freeze({
  tsp: "teaspoon",
  tbsp: "tablespoon",
  teaspoon: "teaspoon",
  tablespoon: "tablespoon",
  cup: "cup",
  oz: "oz",
  lb: "lb",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  can: "can",
  clove: "clove",
  bunch: "bunch",
  head: "head",
  package: "package",
  jar: "jar",
  carton: "carton",
  serving: "serving",
  dozen: "dozen",
  pack: "pack",
  ounce: "ounce",
  pound: "pound",
  gram: "gram",
  kilogram: "kilogram",
  milliliter: "milliliter",
  liter: "liter",
});

export function unicodeShopAmount(ascii) {
  return String(ascii).replace(/\d+\/\d+/g, (token) => SHOP_QTY_UNICODE[token] || token);
}

function pluralNoun(word) {
  if (/^loaf$/i.test(word)) return `${word.slice(0, -1)}ves`;
  if (/s$/i.test(word)) return word;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(?:s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** Labels that stay the same above 1: abbreviations and dozen. */
const UNCOUNTED_UNIT = new Set(["oz", "lb", "g", "kg", "ml", "l", "dozen"]);

function unitWord(unitKey, quantity) {
  const label = DISPLAY_UNIT[unitKey] || unitKey;
  const n = Math.abs(Number(quantity));
  if (!Number.isFinite(n) || n <= 1 + QTY_EPS || UNCOUNTED_UNIT.has(label)) return label;
  return pluralNoun(label);
}

/**
 * A typed item can lead with a package or measure word the parser does not
 * treat as a unit ("1 dozen large eggs", "1 pack paper towels"). The head noun
 * is that lead word, so the last word keeps the shopper's own number.
 */
const PACKAGE_LEAD = new Set([
  "dozen", "pack", "packs", "package", "packages", "bag", "bags", "box", "boxes", "bottle", "bottles",
  "case", "cases", "carton", "cartons", "can", "cans", "jar", "jars", "bunch", "bunches", "head", "heads",
  "loaf", "loaves", "roll", "rolls", "container", "containers", "tub", "tubs", "bundle", "bundles",
]);

function matchHead(source, replacement) {
  const next = String(replacement || "");
  if (!source || !next) return next;
  const first = String(source).charAt(0);
  if (first.toLowerCase() !== first.toUpperCase() && first === first.toUpperCase()) {
    return next.charAt(0).toUpperCase() + next.slice(1);
  }
  return next.charAt(0).toLowerCase() + next.slice(1);
}

function singularNoun(word) {
  const lower = word.toLowerCase();
  if (lower === "potatoes") return matchHead(word, "potato");
  if (lower === "tomatoes") return matchHead(word, "tomato");
  if (/ies$/i.test(word) && word.length > 4) return matchHead(word, `${word.slice(0, -3).toLowerCase()}y`);
  if (/(?:ss|us|is)$/i.test(word)) return word;
  if (/s$/i.test(word) && word.length > 3) return word.slice(0, -1);
  return word;
}

function countableNoun(name, quantity) {
  const text = String(name || "").trim().replace(/\s+/g, " ");
  if (!text || text.length > 48 || !/^[A-Za-z][A-Za-z' -]*$/.test(text)) return null;
  const words = text.split(" ");
  const lower = words.map((word) => word.toLowerCase());
  const n = Math.abs(Number(quantity));
  const last = words.length - 1;
  // A leading package word is the measure, not a noun to pluralize.
  if (last > 0 && PACKAGE_LEAD.has(lower[0])) return text;
  const next = words.slice();
  if (Number.isFinite(n) && n > 1 + QTY_EPS) next[last] = pluralNoun(next[last]);
  else if (Number.isFinite(n) && Math.abs(n - 1) <= QTY_EPS) next[last] = singularNoun(next[last]);
  return next.join(" ");
}

/**
 * Shopper-facing quantity. The amount comes from formatShopQuantityAmount.
 * Display swaps those fractions for unicode. Accessible text keeps the slash form.
 * A countable each/count uses the item noun when the name is a plain word or phrase.
 * @param {{ quantity?: unknown, unit?: string|null, name?: string|null }} input
 */
export function presentShopQuantity({ quantity, unit, name } = {}) {
  if (quantity == null || quantity === "") return { display: "", accessible: "", unicode: false };
  const num = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isFinite(num)) return { display: "", accessible: "", unicode: false };
  const accessibleAmount = formatShopQuantityAmount(num);
  const displayAmount = unicodeShopAmount(accessibleAmount);
  const unicode = displayAmount !== accessibleAmount;
  const unitKey = unit == null ? "" : String(unit);
  if (!unitKey || unitKey === "count" || unitKey === "each" || unitKey === "unparsed") {
    const noun = countableNoun(name, num);
    if (noun) {
      return { display: `${displayAmount} ${noun}`, accessible: `${accessibleAmount} ${noun}`, unicode };
    }
    if (unitKey === "each") {
      return { display: `${displayAmount} each`, accessible: `${accessibleAmount} each`, unicode };
    }
    return { display: displayAmount, accessible: accessibleAmount, unicode };
  }
  const label = unitWord(unitKey, num);
  return { display: `${displayAmount} ${label}`, accessible: `${accessibleAmount} ${label}`, unicode };
}

/**
 * Display contract (S-05C.1).
 * Human surfaces speak the unit: native list, provider review, and the list image.
 * The grocery-app clipboard stays compact (tbsp, tsp) so a cart field can parse it.
 * A package word is the quantity, never a second copy of the product name.
 */
export const SHOP_DISPLAY = Object.freeze({
  human_surfaces: ["native_list", "provider_review", "list_image"],
  machine_surfaces: ["copy_app"],
  human_unit: "spoken",
  machine_unit: "compact",
});

/** Compact clipboard units. Spoken words live in DISPLAY_UNIT. */
const MACHINE_UNITS = Object.freeze({
  cup: ["cup", "cups"],
  tbsp: ["tbsp", "tbsp"],
  tsp: ["tsp", "tsp"],
  oz: ["oz", "oz"],
  lb: ["lb", "lb"],
  g: ["g", "g"],
  kg: ["kg", "kg"],
  ml: ["ml", "ml"],
  l: ["l", "l"],
  can: ["can", "cans"],
  clove: ["clove", "cloves"],
  bunch: ["bunch", "bunches"],
  head: ["head", "heads"],
  package: ["package", "packages"],
  jar: ["jar", "jars"],
  carton: ["carton", "cartons"],
  serving: ["serving", "servings"],
  dozen: ["dozen", "dozen"],
  pack: ["pack", "packs"],
  bag: ["bag", "bags"],
  box: ["box", "boxes"],
  bottle: ["bottle", "bottles"],
  case: ["case", "cases"],
  loaf: ["loaf", "loaves"],
  roll: ["roll", "rolls"],
  container: ["container", "containers"],
  tub: ["tub", "tubs"],
  bundle: ["bundle", "bundles"],
  count: ["", ""],
  unparsed: ["", ""],
});

const LEAD_UNIT = Object.freeze({
  dozen: "dozen",
  pack: "pack",
  packs: "pack",
  package: "package",
  packages: "package",
  bag: "bag",
  bags: "bag",
  box: "box",
  boxes: "box",
  bottle: "bottle",
  bottles: "bottle",
  case: "case",
  cases: "case",
  carton: "carton",
  cartons: "carton",
  can: "can",
  cans: "can",
  jar: "jar",
  jars: "jar",
  bunch: "bunch",
  bunches: "bunch",
  head: "head",
  heads: "head",
  loaf: "loaf",
  loaves: "loaf",
  roll: "roll",
  rolls: "roll",
  container: "container",
  containers: "container",
  tub: "tub",
  tubs: "tub",
  bundle: "bundle",
  bundles: "bundle",
});

export function machineUnit(unit, quantity) {
  const pair = MACHINE_UNITS[unit];
  if (!pair) return "";
  const n = Number(quantity);
  const plural = Number.isFinite(n) && Math.abs(n) > 1 + QTY_EPS;
  return plural ? pair[1] : pair[0];
}

/** Keep a shopper's capitals. Only an all-lowercase recipe name gains a first capital. */
export function shopNameForDisplay(name) {
  const text = String(name || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text !== text.toLowerCase()) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function countLikeUnit(unit) {
  return !unit || unit === "count" || unit === "each" || unit === "unparsed";
}

function packageLeadSplit(name, unitKey) {
  const text = String(name || "").trim().replace(/\s+/g, " ");
  const words = text.split(" ").filter(Boolean);
  if (words.length < 2) return null;
  const lead = LEAD_UNIT[words[0].toLowerCase()];
  if (!lead) return null;
  if (!countLikeUnit(unitKey) && lead !== unitKey) return null;
  if (!countLikeUnit(unitKey) && lead === unitKey) {
    return { unit: unitKey, product: words.slice(1).join(" ") };
  }
  if (!countLikeUnit(unitKey)) return null;
  return { unit: lead, product: words.slice(1).join(" ") };
}

/**
 * One line, two readings. `humanQuantity` is the native list and the provider review.
 * `imageQuantity` is the same spoken unit with the product kept in `product`.
 * `machineText` is the grocery-app clipboard line.
 * @param {{ quantity?: unknown, unit?: string|null, name?: string|null }} input
 */
export function presentShopFaces({ quantity, unit, name } = {}) {
  const rawName = String(name || "").trim().replace(/\s+/g, " ");
  const unitKey = unit == null ? "" : String(unit);
  const split = packageLeadSplit(rawName, unitKey);
  const product = split ? split.product : rawName;
  const measureUnit = split ? split.unit : unitKey;
  const num = typeof quantity === "number" ? quantity : Number(quantity);
  const finite = quantity != null && quantity !== "" && Number.isFinite(num);
  const empty = {
    product: product || rawName,
    exportName: product || rawName,
    humanQuantity: "",
    humanAccessible: "",
    imageQuantity: "",
    machineQuantity: "",
    machineQuantityUnicode: "",
    machineText: product || rawName,
  };
  if (!finite) return empty;

  const spoken = presentShopQuantity({
    quantity: num,
    unit: split ? measureUnit : unitKey,
    name: split ? "" : product,
  });
  const image = presentShopQuantity({ quantity: num, unit: measureUnit, name: "" });
  const amount = formatShopQuantityAmount(num);
  const unicodeAmount = unicodeShopAmount(amount);
  const compact = machineUnit(measureUnit, num);
  const machineQuantity = compact ? `${amount} ${compact}` : amount;
  const machineQuantityUnicode = compact ? `${unicodeAmount} ${compact}` : unicodeAmount;
  let exportName = product;
  if (!split && countLikeUnit(unitKey)) {
    const noun = countableNoun(product, num);
    if (noun) exportName = noun;
  }
  const machineText = machineQuantity ? `${machineQuantity} ${exportName}`.trim() : exportName;
  const imageQuantity = split || !countLikeUnit(measureUnit) ? image.display : unicodeAmount;
  return {
    product,
    exportName,
    humanQuantity: spoken.display,
    humanAccessible: spoken.accessible,
    imageQuantity,
    machineQuantity,
    machineQuantityUnicode,
    machineText,
  };
}

function lineKey(ingredientId, unit) {
  return ingredientId + "\0" + (unit || "");
}

/**
 * Reconstruct the pre-change snapshot from current open lines and unseen deltas.
 * @param {object[]} lines
 * @param {object[]} unseenDeltas newest-last
 */
export function rebuildShopSnapshotFromDeltas(lines, unseenDeltas) {
  const snap = {};
  (lines || []).forEach(function (l) {
    if (!l.still_needed) return;
    snap[lineKey(l.ingredient_id, l.unit)] = {
      quantity: l.quantity,
      list_state: l.list_state,
    };
  });
  const sorted = (unseenDeltas || [])
    .slice()
    .sort(function (a, b) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  sorted.forEach(function (d) {
    const key = lineKey(d.ingredient_id, d.unit);
    const qty = Number(d.quantity) || 0;
    if (d.kind === "added") {
      if (!snap[key]) return;
      const cur = Number(snap[key].quantity) || 0;
      const next = cur - qty;
      if (next <= QTY_EPS) delete snap[key];
      else snap[key].quantity = next;
    } else if (d.kind === "no_longer_needed") {
      if (snap[key]) snap[key].quantity = (Number(snap[key].quantity) || 0) + qty;
      else snap[key] = { quantity: qty, list_state: "open" };
    }
  });
  return snap;
}

/**
 * @param {object} line
 * @param {{
 *   tagsVisible: boolean,
 *   snapshot: Record<string, { quantity: unknown, list_state?: string }>,
 *   unseenDeltas: object[],
 *   formatQty?: (line: object) => string,
 * }} ctx
 */
export function shopLineChangeMeta(line, ctx) {
  const formatQty = ctx.formatQty || formatShopQty;
  if (!ctx.tagsVisible || !line || !line.still_needed) return null;
  const key = lineKey(line.ingredient_id, line.unit);
  const deltas = (ctx.unseenDeltas || []).filter(function (d) {
    return lineKey(d.ingredient_id, d.unit) === key;
  });
  const snap = ctx.snapshot[key];
  const newQty = Number(line.quantity) || 0;
  const oldQty = snap ? Number(snap.quantity) || 0 : null;
  const wasOnSnapshot = snap != null;
  const addedDeltas = deltas.filter(function (d) {
    return d.kind === "added";
  });

  if (!wasOnSnapshot && addedDeltas.length) {
    return { tag: "Added", tagClass: "badge--accent badge--sm", qtyLine: null };
  }

  if (wasOnSnapshot && oldQty != null && newQty > oldQty + QTY_EPS) {
    if (line.list_state === "purchased" || line.list_state === "already_have") {
      const extra = newQty - oldQty;
      const extraLabel = extra ? formatQty({ quantity: extra, unit: line.unit }) : "more";
      return {
        tag: extra ? "Get " + extraLabel + " more" : "Get more",
        tagClass: "badge--warning badge--sm",
        qtyLine:
          formatQty(line) +
          " now · you have " +
          formatQty({ quantity: snap.quantity, unit: line.unit }),
      };
    }
    return {
      tag: "More needed",
      tagClass: "badge--sm",
      qtyLine: formatQty(line) + " now · was " + formatQty({ quantity: snap.quantity, unit: line.unit }),
    };
  }

  if (line.surplus_quantity > 0 && newQty > QTY_EPS) {
    const was = newQty + Number(line.surplus_quantity);
    return {
      tag: "Less needed",
      tagClass: "badge--sm",
      qtyLine: formatQty(line) + " now · was " + formatQty({ quantity: was, unit: line.unit }),
    };
  }

  return null;
}
