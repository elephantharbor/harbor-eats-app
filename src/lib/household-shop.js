/**
 * Household shopping list.
 * Recipe quantities come from dinner_shop_line, which syncShopping already
 * built with scaleForDiners and aggregateContributions. This module does not
 * scale, and it does not call a model.
 *
 * A line is what the shopper checks off. A requirement is one source.
 * Recipe onions and a typed onion stay as two requirements on one line when
 * the ingredient and unit match. Deleting the typed one leaves the recipe.
 */

import { canonicalIngredient, normalizeUnit, roundQuantity, SHOPPING_INGREDIENT_ALIASES } from "./ingredient-identity.js";
import { machineUnit, presentShopFaces, shopNameForDisplay } from "./shop-display.js";

const QTY_EPS = 0.0005;

export const LIST_STATES = ["open", "already_have", "purchased", "skipped"];
export const CATEGORY_ORDER = ["produce", "dairy", "meat", "bakery", "pantry", "frozen", "household", "other"];
export const CATEGORY_LABELS = {
  produce: "Produce",
  dairy: "Dairy",
  meat: "Meat",
  bakery: "Bakery",
  pantry: "Pantry",
  frozen: "Frozen",
  household: "Household",
  other: "Other",
};

const CATEGORY_RULES = [
  ["produce", /\b(onion|cilantro|banana|lemon|lime|garlic|tomato|pepper|herb|lettuce|spinach|apple|potato|carrot|ginger|scallion|avocado|cucumber|kale|cabbage|mushroom|basil|parsley|mint|chili|chile)\b/i],
  ["dairy", /\b(oat milk|milk|cheese|yogurt|butter|cream|egg)\b/i],
  ["meat", /\b(chicken|beef|pork|salmon|fish|shrimp|tofu|turkey|sausage|bacon|steak)\b/i],
  ["bakery", /\b(bread|bagel|tortilla|bun|pita)\b/i],
  ["frozen", /\b(frozen|ice cream)\b/i],
  ["household", /\b(paper towel|detergent|soap|foil|trash|sponge|tissue|napkin|cleaner|bleach|laundry)\b/i],
  ["pantry", /\b(coffee|rice|oil|sauce|flour|sugar|salt|pasta|bean|oat|broth|spice|vinegar|soy|honey|cereal)\b/i],
];

const VULGAR_FRACTIONS = {
  "½": [1, 2],
  "⅓": [1, 3],
  "⅔": [2, 3],
  "¼": [1, 4],
  "¾": [3, 4],
  "⅛": [1, 8],
  "⅜": [3, 8],
  "⅝": [5, 8],
  "⅞": [7, 8],
};
const VULGAR_CHARS = Object.keys(VULGAR_FRACTIONS).join("");
const QTY_TOKEN = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+\s*[${VULGAR_CHARS}]|[${VULGAR_CHARS}]|\d+(?:\.\d+)?)`;

export function categoryForName(name) {
  const text = String(name || "");
  const folded = text.replace(/\b([A-Za-z]{4,})s\b/g, "$1");
  const haystack = folded === text ? text : text + " " + folded;
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(haystack)) return category;
  }
  return "other";
}

export function isFiniteQty(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function numOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? roundQuantity(n) : null;
}

export function collapseKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function safeToken(value) {
  return String(value || "x")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "x";
}

/**
 * General-item primary key. The list id is part of the key, so two households
 * can reuse one client request id. safeToken drops underscores, so this value
 * always contains a second underscore and cannot equal a legacy `hrg_<request>` id.
 */
export function generalRequirementId(shopListId, clientRequestId) {
  const request = clientRequestId ? safeToken(clientRequestId) : safeToken(crypto.randomUUID());
  return `hrg_${safeToken(shopListId)}_${request}`;
}

/** Ids written before the list was part of the key. Still stored and still loaded. */
export function legacyGeneralRequirementId(clientRequestId) {
  return `hrg_${safeToken(clientRequestId || "x")}`;
}

function foldShopPlural(ingredientId) {
  if (!ingredientId) return ingredientId;
  if (SHOPPING_INGREDIENT_ALIASES[ingredientId]) return SHOPPING_INGREDIENT_ALIASES[ingredientId];
  if (ingredientId.endsWith("s") && !ingredientId.endsWith("ss") && ingredientId.length > 3) {
    const singular = ingredientId.slice(0, -1);
    const targets = new Set(Object.values(SHOPPING_INGREDIENT_ALIASES));
    if (targets.has(singular) || SHOPPING_INGREDIENT_ALIASES[singular]) {
      return SHOPPING_INGREDIENT_ALIASES[singular] || singular;
    }
  }
  return ingredientId;
}

function parseQuantityToken(token) {
  const compact = String(token || "").trim();
  const vulgar = compact.match(new RegExp(`^(\\d+)?\\s*([${VULGAR_CHARS}])$`));
  if (vulgar) {
    const whole = vulgar[1] ? Number(vulgar[1]) : 0;
    const pair = VULGAR_FRACTIONS[vulgar[2]];
    if (!pair) return null;
    return roundQuantity(whole + pair[0] / pair[1]);
  }
  if (token.includes("/")) {
    const parts = token.trim().split(/\s+/);
    if (parts.length === 2) {
      const [n, d] = parts[1].split("/").map(Number);
      if (!d) return null;
      return roundQuantity(Number(parts[0]) + n / d);
    }
    const [n, d] = token.split("/").map(Number);
    if (!d) return null;
    return roundQuantity(n / d);
  }
  const n = Number(token);
  return Number.isFinite(n) ? roundQuantity(n) : null;
}

/**
 * Deterministic add-item parser. No network and no model.
 * A bare name is kept, with no invented unit. A bare number is rejected.
 * "3 onions" keeps the 3 and does not invent "each".
 */
export function parseGeneralItem(text) {
  const raw = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return { ok: false, error: "item_name_required" };
  if (raw.length > 80) return { ok: false, error: "item_too_long" };
  if (new RegExp(`^${QTY_TOKEN}$`).test(raw)) return { ok: false, error: "item_name_required" };

  let rest = raw;
  let quantity = null;
  const qty = rest.match(new RegExp(`^(${QTY_TOKEN})(?:\\s+|$)`));
  if (qty && qty[1]) {
    quantity = parseQuantityToken(qty[1]);
    rest = rest.slice(qty[0].length);
  } else {
    const article = rest.match(/^(a|an)\s+/i);
    if (article) {
      quantity = 1;
      rest = rest.slice(article[0].length);
    }
  }

  let unit = null;
  const unitMatch = rest.match(/^([A-Za-z]+)\s+(\S.*)$/);
  if (unitMatch) {
    const normalized = normalizeUnit(unitMatch[1]);
    if (normalized) {
      unit = normalized;
      rest = unitMatch[2];
    }
  }

  rest = rest.trim();
  if (!rest) return { ok: false, error: "item_name_required" };
  const canon = canonicalIngredient(rest);
  const folded = canon.display_name || rest;
  const display = preserveTypedName(rest, folded);
  let ingredientId = canon.ingredient_id && canon.ingredient_id !== "unknown" ? canon.ingredient_id : null;
  ingredientId = foldShopPlural(ingredientId);
  const measured = quantity != null && !!unit;
  return {
    ok: true,
    display_name: display,
    preparation: canon.preparation,
    ingredient_id: ingredientId,
    general_key: collapseKey(folded),
    quantity,
    unit: measured ? unit : "unparsed",
    unparsed: measured ? 0 : 1,
  };
}

export function identityForParsed(parsed) {
  const measured = parsed.unparsed !== 1 && parsed.unit && parsed.unit !== "unparsed";
  if (measured && parsed.ingredient_id) {
    return { ingredient_id: parsed.ingredient_id, general_key: null, unit: parsed.unit };
  }
  return {
    ingredient_id: parsed.ingredient_id || null,
    general_key: parsed.general_key || collapseKey(parsed.display_name),
    unit: parsed.unit || "unparsed",
  };
}

export function lineIdentityKey(line) {
  return `${line.ingredient_id || ""}\u0000${line.general_key || ""}\u0000${line.unit || ""}`;
}

export function householdLineId(shopListId, identity) {
  const key = identity.general_key || identity.ingredient_id || "item";
  return `hl_${safeToken(shopListId)}_${safeToken(key)}_${safeToken(identity.unit)}`;
}

export function requestedQuantity(line) {
  const req = numOrNull(line.quantity_required);
  const man = numOrNull(line.quantity_manual);
  if (req == null && man == null) return null;
  return roundQuantity((req || 0) + (man || 0));
}

/**
 * Purchase quantity. A stale override is not the number we shop:
 * the fresh requirement is, and the earlier amount stays visible for review.
 */
export function buyQuantity(line) {
  if (line.override_stale) return requestedQuantity(line);
  const over = numOrNull(line.quantity_override);
  if (over != null) return over;
  return requestedQuantity(line);
}

export function requirementMateriallyChanged(before, after) {
  const b = numOrNull(before);
  const a = numOrNull(after);
  if (b == null && a == null) return false;
  if (b == null || a == null) return true;
  return Math.abs(b - a) > QTY_EPS;
}

export function emptyHouseholdList({ shop_list_id, household_id, now, dinner_plan_id = null }) {
  return {
    shop_list_id,
    household_id,
    status: "open",
    revision: 1,
    content_revision: 1,
    dinner_plan_id,
    trip_method: null,
    lines: [],
    created_at: now,
    updated_at: now,
  };
}

function clone(list) {
  return structuredClone(list);
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function findLine(list, identity) {
  const key = lineIdentityKey(identity);
  return list.lines.find((line) => lineIdentityKey(line) === key) || null;
}

function findClientRequest(list, clientRequestId) {
  if (!clientRequestId) return null;
  for (const line of list.lines) {
    const hit = (line.requirements || []).find((req) => req.client_request_id === clientRequestId);
    if (hit) return line;
  }
  return null;
}

function findSource(list, sourceKey) {
  for (const line of list.lines) {
    const req = (line.requirements || []).find((row) => row.source_key === sourceKey);
    if (req) return { line, req };
  }
  return null;
}

function shopperSettled(line) {
  return (
    line.list_state === "purchased" ||
    line.list_state === "already_have" ||
    line.list_state === "skipped" ||
    numOrNull(line.quantity_override) != null ||
    !!line.override_stale
  );
}

function hasActiveRecipe(line) {
  return (line.requirements || []).some((req) => req.origin === "recipe" && req.still_needed);
}

function blankLine(shopListId, identity, seed, now) {
  const name = seed.display_name || identity.general_key || identity.ingredient_id || "Item";
  return {
    line_id: householdLineId(shopListId, identity),
    ingredient_id: identity.ingredient_id || null,
    general_key: identity.general_key || null,
    display_name: name,
    name_custom: 0,
    preparation: seed.preparation || null,
    unit: identity.unit,
    quantity_required: null,
    quantity_manual: null,
    quantity_override: null,
    override_basis: null,
    override_stale: 0,
    reconcile_note: null,
    list_state: "open",
    still_needed: 1,
    surplus_quantity: 0,
    meal_ids: [],
    recipe_version_ids: [],
    category: categoryForName(name),
    category_custom: 0,
    unparsed: identity.unit === "unparsed" ? 1 : 0,
    note: null,
    requirements: [],
    created_at: now,
    updated_at: now,
  };
}

function sumQuantities(rows) {
  const nums = rows.map((row) => numOrNull(row.quantity)).filter((n) => n != null);
  if (!nums.length) return null;
  return roundQuantity(nums.reduce((total, n) => total + n, 0));
}

function reconcileCopy(override, requested, unit) {
  const yours = formatTrueQuantity(override);
  const next = requested == null ? "nothing" : formatTrueQuantity(requested);
  const yoursUnit = humanUnit(unit, override);
  const nextUnit = requested == null ? "" : humanUnit(unit, requested);
  const yoursLabel = yoursUnit ? `${yours} ${yoursUnit}` : yours;
  const nextLabel = next === "nothing" ? "nothing" : nextUnit ? `${next} ${nextUnit}` : next;
  return `Recipes now need ${nextLabel}. Your earlier amount was ${yoursLabel}.`;
}

function recompute(list, now) {
  for (const line of list.lines) {
    const reqs = line.requirements || [];
    const activeRecipe = reqs.filter((req) => req.origin === "recipe" && req.still_needed);
    const activeGeneral = reqs.filter((req) => req.origin === "general" && req.still_needed);
    const prevRequired = numOrNull(line.quantity_required);
    const nextRequired = sumQuantities(activeRecipe);
    const nextManual = sumQuantities(activeGeneral);
    const nextRequested = nextRequired == null && nextManual == null ? null : roundQuantity((nextRequired || 0) + (nextManual || 0));
    if (prevRequired != null && nextRequired != null && prevRequired > nextRequired + QTY_EPS) {
      line.surplus_quantity = roundQuantity(prevRequired - nextRequired);
    } else if (prevRequired != null && nextRequired == null && activeRecipe.length === 0 && reqs.some((req) => req.origin === "recipe")) {
      line.surplus_quantity = prevRequired;
    } else {
      line.surplus_quantity = 0;
    }
    if (numOrNull(line.quantity_override) != null) {
      const basis = numOrNull(line.override_basis);
      const compare = basis == null ? prevRequired : basis;
      if (requirementMateriallyChanged(compare, nextRequested)) {
        line.override_stale = 1;
        line.reconcile_note = reconcileCopy(line.quantity_override, nextRequested, line.unit);
      } else if (line.override_stale && basis != null && !requirementMateriallyChanged(basis, nextRequested)) {
        line.override_stale = 0;
        line.reconcile_note = null;
      }
    }
    line.quantity_required = nextRequired;
    line.quantity_manual = nextManual;
    line.still_needed = activeRecipe.length || activeGeneral.length ? 1 : 0;
    const mealSource = activeRecipe.length ? activeRecipe : reqs.filter((req) => req.origin === "recipe");
    line.meal_ids = unique(mealSource.flatMap((req) => req.meal_ids || []));
    line.recipe_version_ids = unique(mealSource.flatMap((req) => req.recipe_version_ids || []));
    const prep = unique(mealSource.map((req) => req.preparation).filter(Boolean));
    line.preparation = prep.length ? prep.sort().join(", ") : line.preparation;
    if (!line.name_custom) {
      const named = activeRecipe[0] || activeGeneral[0] || reqs[0];
      if (named?.display_name) line.display_name = named.display_name;
    }
    if (!line.category_custom) line.category = categoryForName(line.display_name);
    line.unparsed = line.unit === "unparsed" ? 1 : 0;
    line.updated_at = now;
  }
  list.lines = list.lines.filter((line) => (line.requirements || []).length || shopperSettled(line) || line.still_needed);
  list.lines.sort((a, b) => String(a.display_name).localeCompare(String(b.display_name)) || String(a.unit).localeCompare(String(b.unit)));
}

function pruneObsolete(list) {
  for (const line of list.lines) {
    if (shopperSettled(line)) continue;
    line.requirements = (line.requirements || []).filter((req) => req.origin !== "recipe" || req.still_needed);
  }
  list.lines = list.lines.filter((line) => (line.requirements || []).length);
}

function contentSignature(list) {
  return JSON.stringify(
    list.lines.map((line) => ({
      id: line.line_id,
      name: line.display_name,
      unit: line.unit,
      buy: buyQuantity(line),
      required: line.quantity_required,
      manual: line.quantity_manual,
      override: line.quantity_override,
      stale: line.override_stale ? 1 : 0,
      needed: line.still_needed ? 1 : 0,
      state: line.list_state,
      meals: line.meal_ids,
      versions: line.recipe_version_ids,
      category: line.category,
      note: line.note,
      rec: line.reconcile_note,
      reqs: (line.requirements || []).map((req) => [req.source_key, req.quantity, req.still_needed ? 1 : 0, req.unit]),
    }))
  );
}

function withoutMarks(list) {
  return {
    dinner_plan_id: list.dinner_plan_id,
    lines: (list.lines || []).map((line) => ({ ...line, list_state: "open" })),
  };
}

function finish(before, after, now) {
  const changed =
    contentSignature(before) !== contentSignature(after) || before.dinner_plan_id !== after.dinner_plan_id;
  if (!changed) return { ok: true, list: before, changed: false, content_changed: false };
  const contentChanged = contentSignature(withoutMarks(before)) !== contentSignature(withoutMarks(after));
  after.updated_at = now;
  return { ok: true, list: after, changed: true, content_changed: contentChanged };
}

function versionIdsFor(plan, mealIds) {
  const wanted = new Set(mealIds || []);
  if (!wanted.size) return [];
  return unique(
    (plan?.meals || [])
      .filter((meal) => wanted.has(meal.meal_id) && meal.recipe_version_id)
      .map((meal) => meal.recipe_version_id)
  );
}

function planState(value) {
  if (value === "checked") return "purchased";
  return LIST_STATES.includes(value) ? value : "open";
}

/**
 * Copy the current plan's shop lines onto the household list.
 * General requirements are never created or deleted here.
 */
export function projectPlanIntoList(list, plan, ctx = {}) {
  if (!plan?.dinner_plan_id) return { ok: true, list, changed: false, content_changed: false };
  const now = ctx.now || list.updated_at;
  const next = clone(list);
  const planId = plan.dinner_plan_id;
  if (next.dinner_plan_id && next.dinner_plan_id !== planId) {
    for (const line of next.lines) {
      for (const req of line.requirements || []) {
        if (req.origin === "recipe" && req.dinner_plan_id === next.dinner_plan_id) {
          req.still_needed = 0;
          req.quantity = 0;
        }
      }
    }
  }
  const completed = plan.status === "completed";
  const shopLines = completed ? [] : plan.shop_lines || [];
  const seen = new Set();
  for (const shopLine of shopLines) {
    const unit = shopLine.unit || "unparsed";
    const sourceKey = `recipe:${planId}:${shopLine.ingredient_id}:${unit}`;
    seen.add(sourceKey);
    const identity = { ingredient_id: shopLine.ingredient_id, general_key: null, unit };
    let host = findLine(next, identity);
    const found = findSource(next, sourceKey);
    if (!host) {
      host = blankLine(next.shop_list_id, identity, shopLine, now);
      host.list_state = planState(shopLine.list_state);
      next.lines.push(host);
    }
    if (found && found.line !== host) {
      found.line.requirements = found.line.requirements.filter((req) => req !== found.req);
      host.requirements.push(found.req);
    }
    let req = (host.requirements || []).find((row) => row.source_key === sourceKey);
    if (!req) {
      req = {
        requirement_id: `hr_${safeToken(planId)}_${safeToken(shopLine.ingredient_id)}_${safeToken(unit)}`,
        origin: "recipe",
        dinner_plan_id: planId,
        plan_line_id: shopLine.line_id,
        meal_ids: [],
        recipe_version_ids: [],
        quantity: null,
        unit,
        still_needed: 1,
        source_key: sourceKey,
        client_request_id: null,
        display_name: shopLine.display_name,
        preparation: shopLine.preparation || null,
      };
      host.requirements.push(req);
    }
    req.dinner_plan_id = planId;
    req.plan_line_id = shopLine.line_id;
    req.meal_ids = [...(shopLine.meal_ids || [])];
    req.recipe_version_ids = versionIdsFor(plan, shopLine.meal_ids);
    req.quantity = shopLine.still_needed ? numOrNull(shopLine.quantity) : 0;
    req.unit = unit;
    req.still_needed = shopLine.still_needed ? 1 : 0;
    req.display_name = shopLine.display_name;
    req.preparation = shopLine.preparation || null;
    if (!host.name_custom && shopLine.display_name) host.display_name = shopLine.display_name;
  }
  for (const line of next.lines) {
    for (const req of line.requirements || []) {
      if (req.origin === "recipe" && req.dinner_plan_id === planId && !seen.has(req.source_key)) {
        req.still_needed = 0;
        req.quantity = 0;
      }
    }
  }
  if (completed) {
    for (const line of next.lines) {
      for (const req of line.requirements || []) {
        if (req.origin === "recipe" && req.dinner_plan_id === planId) {
          req.still_needed = 0;
          req.quantity = 0;
        }
      }
    }
  }
  pruneObsolete(next);
  recompute(next, now);
  next.dinner_plan_id = planId;
  return finish(list, next, now);
}

export function addGeneralItem(list, text, ctx = {}) {
  const parsed = parseGeneralItem(text);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };
  const now = ctx.now;
  if (ctx.client_request_id) {
    const existing = findClientRequest(list, ctx.client_request_id);
    if (existing) return { ok: true, list, changed: false, content_changed: false, line_id: existing.line_id, idempotent: true };
  }
  const next = clone(list);
  const identity = identityForParsed(parsed);
  let line = findLine(next, identity);
  if (!line) {
    line = blankLine(next.shop_list_id, identity, parsed, now);
    next.lines.push(line);
  }
  const reqId =
    ctx.requirement_id || generalRequirementId(list.shop_list_id, ctx.client_request_id || ctx.id || null);
  line.requirements.push({
    requirement_id: reqId,
    origin: "general",
    dinner_plan_id: null,
    plan_line_id: null,
    meal_ids: [],
    recipe_version_ids: [],
    quantity: parsed.quantity,
    unit: identity.unit,
    still_needed: 1,
    source_key: `general:${reqId}`,
    client_request_id: ctx.client_request_id || null,
    display_name: parsed.display_name,
    preparation: parsed.preparation,
  });
  if (!line.name_custom && !hasActiveRecipe(line)) line.display_name = parsed.display_name;
  recompute(next, now);
  const result = finish(list, next, now);
  result.line_id = line.line_id;
  return result;
}

export function setLineState(list, action, ctx = {}) {
  const next = clone(list);
  const line = next.lines.find((row) => row.line_id === action.line_id);
  if (!line) return { ok: false, error: "line_not_found", status: 404 };
  const state = action.list_state === "checked" ? "purchased" : action.list_state;
  if (!LIST_STATES.includes(state)) return { ok: false, error: "list_state_invalid", status: 400 };
  if (line.list_state === state) return { ok: true, list, changed: false, content_changed: false, idempotent: true };
  line.list_state = state;
  line.updated_at = ctx.now;
  return finish(list, next, ctx.now);
}

export function deleteGeneralSource(list, lineId, ctx = {}) {
  const next = clone(list);
  const line = next.lines.find((row) => row.line_id === lineId);
  if (!line) return { ok: false, error: "line_not_found", status: 404 };
  const before = line.requirements.length;
  line.requirements = (line.requirements || []).filter((req) => req.origin !== "general");
  if (line.requirements.length === before) return { ok: false, error: "general_source_missing", status: 400 };
  if (!line.requirements.length) next.lines = next.lines.filter((row) => row.line_id !== lineId);
  else recompute(next, ctx.now);
  return finish(list, next, ctx.now);
}

export function resolveOverride(list, action, ctx = {}) {
  const next = clone(list);
  const line = next.lines.find((row) => row.line_id === action.line_id);
  if (!line) return { ok: false, error: "line_not_found", status: 404 };
  if (action.keep) {
    line.override_stale = 0;
    line.override_basis = requestedQuantity(line);
    line.reconcile_note = null;
  } else {
    line.quantity_override = null;
    line.override_basis = null;
    line.override_stale = 0;
    line.reconcile_note = null;
  }
  line.updated_at = ctx.now;
  return finish(list, next, ctx.now);
}

function moveRequirements(next, from, reqs, identity, now) {
  let host = findLine(next, identity);
  if (!host || host === from) {
    if (host === from) {
      from.ingredient_id = identity.ingredient_id;
      from.general_key = identity.general_key;
      from.unit = identity.unit;
      from.line_id = householdLineId(next.shop_list_id, identity);
      return from;
    }
    host = blankLine(next.shop_list_id, identity, { display_name: from.display_name, preparation: from.preparation }, now);
    host.list_state = "open";
    host.category = from.category;
    host.category_custom = from.category_custom;
    next.lines.push(host);
  }
  for (const req of reqs) {
    req.unit = identity.unit;
    host.requirements.push(req);
  }
  from.requirements = from.requirements.filter((req) => !reqs.includes(req));
  if (!from.requirements.length && !shopperSettled(from)) {
    next.lines = next.lines.filter((row) => row !== from);
  }
  return host;
}

export function editLine(list, action, ctx = {}) {
  const next = clone(list);
  let line = next.lines.find((row) => row.line_id === action.line_id);
  if (!line) return { ok: false, error: "line_not_found", status: 404 };
  const patch = action.patch || {};
  const now = ctx.now;
  if (patch.list_state != null) {
    const state = patch.list_state === "checked" ? "purchased" : patch.list_state;
    if (!LIST_STATES.includes(state)) return { ok: false, error: "list_state_invalid", status: 400 };
    line.list_state = state;
  }
  if (patch.category != null) {
    if (!CATEGORY_ORDER.includes(patch.category)) return { ok: false, error: "category_invalid", status: 400 };
    line.category = patch.category;
    line.category_custom = 1;
  }
  if (patch.note !== undefined) {
    const note = patch.note == null ? null : String(patch.note).trim().slice(0, 80);
    line.note = note || null;
  }
  if (patch.display_name != null) {
    const name = String(patch.display_name).trim().replace(/\s+/g, " ").slice(0, 80);
    if (!name) return { ok: false, error: "item_name_required", status: 400 };
    const recipe = (line.requirements || []).some((req) => req.origin === "recipe");
    if (recipe) {
      line.display_name = name;
      line.name_custom = 1;
    } else {
      const parsed = parseGeneralItem(name);
      if (!parsed.ok) return parsed;
      const identity = identityForParsed({ ...parsed, quantity: null, unit: line.unit, unparsed: line.unparsed });
      if (line.unit !== "unparsed") {
        identity.unit = line.unit;
        identity.general_key = null;
        if (!identity.ingredient_id) identity.general_key = parsed.general_key;
      } else {
        identity.unit = "unparsed";
        identity.general_key = parsed.general_key;
      }
      line.display_name = parsed.display_name;
      line.name_custom = 0;
      line.ingredient_id = identity.ingredient_id;
      line.general_key = identity.general_key;
      line.line_id = householdLineId(next.shop_list_id, identity);
      for (const req of line.requirements || []) {
        if (req.origin === "general") req.display_name = parsed.display_name;
      }
    }
  }
  if (patch.unit != null) {
    const unit = normalizeUnit(patch.unit) || (patch.unit === "unparsed" ? "unparsed" : null);
    if (!unit) return { ok: false, error: "unit_invalid", status: 400 };
    const generals = (line.requirements || []).filter((req) => req.origin === "general");
    const recipes = (line.requirements || []).filter((req) => req.origin === "recipe");
    if (recipes.length && generals.length) {
      const identity = {
        ingredient_id: line.ingredient_id,
        general_key: unit === "unparsed" ? line.general_key || collapseKey(line.display_name) : null,
        unit,
      };
      if (unit !== "unparsed" && identity.ingredient_id) identity.general_key = null;
      if (!identity.ingredient_id) identity.general_key = line.general_key || collapseKey(line.display_name);
      line = moveRequirements(next, line, generals, identity, now) || line;
    } else if (!recipes.length) {
      const identity = {
        ingredient_id: line.ingredient_id,
        general_key: unit !== "unparsed" && line.ingredient_id ? null : line.general_key || collapseKey(line.display_name),
        unit,
      };
      line = moveRequirements(next, line, generals, identity, now) || line;
    }
  }
  if (patch.quantity !== undefined) {
    const qty = patch.quantity == null || patch.quantity === "" ? null : numOrNull(patch.quantity);
    if (patch.quantity != null && patch.quantity !== "" && qty == null) {
      return { ok: false, error: "quantity_invalid", status: 400 };
    }
    const current = next.lines.find((row) => row.line_id === line.line_id) || line;
    if (hasActiveRecipe(current) || (current.requirements || []).some((req) => req.origin === "recipe" && req.still_needed)) {
      if (qty == null) {
        current.quantity_override = null;
        current.override_basis = null;
        current.override_stale = 0;
        current.reconcile_note = null;
      } else {
        current.quantity_override = qty;
        current.override_basis = requestedQuantity({ ...current, quantity_override: null, override_stale: 0 });
        current.override_stale = 0;
        current.reconcile_note = null;
      }
    } else {
      const generals = (current.requirements || []).filter((req) => req.origin === "general" && req.still_needed);
      if (!generals.length) return { ok: false, error: "general_source_missing", status: 400 };
      generals[0].quantity = qty;
      for (const extra of generals.slice(1)) extra.quantity = 0;
      if (qty == null) current.unit = current.unit === "unparsed" ? "unparsed" : current.unit;
    }
  }
  recompute(next, now);
  const merged = [];
  const seen = new Map();
  for (const row of next.lines) {
    const key = lineIdentityKey(row);
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, row);
      merged.push(row);
      continue;
    }
    prior.requirements.push(...row.requirements);
    if (shopperSettled(row) && !shopperSettled(prior)) prior.list_state = row.list_state;
  }
  next.lines = merged;
  recompute(next, now);
  return finish(list, next, now);
}

/**
 * Removes completed household items and recipe rows the plan dropped.
 * Open household items, skipped items, and bought items the dinners still
 * need all stay. This is not a trip archive.
 */
export function clearCompleted(list, ctx = {}) {
  const next = clone(list);
  next.lines = next.lines.filter((line) => {
    if (!line.still_needed) return false;
    if (line.list_state === "open" || line.list_state === "skipped") return true;
    if (line.list_state === "purchased" || line.list_state === "already_have") {
      return (line.requirements || []).some((req) => req.origin === "recipe" && req.still_needed);
    }
    return true;
  });
  for (const line of next.lines) {
    line.requirements = (line.requirements || []).filter((req) => req.still_needed || req.origin === "general");
  }
  recompute(next, ctx.now);
  return finish(list, next, ctx.now);
}

export function setTripMethod(list, tripMethod, ctx = {}) {
  if (tripMethod != null && tripMethod !== "instore" && tripMethod !== "order_online") {
    return { ok: false, error: "trip_method_invalid", status: 400 };
  }
  const next = clone(list);
  next.trip_method = tripMethod || null;
  if (next.trip_method === list.trip_method) return { ok: true, list, changed: false, content_changed: false };
  next.updated_at = ctx.now;
  return { ok: true, list: next, changed: true, content_changed: false };
}

export function formatTrueQuantity(value) {
  const n = numOrNull(value);
  if (n == null) return "";
  return String(n);
}

export function humanUnit(unit, quantity) {
  return machineUnit(unit, quantity);
}

/** The matching key is folded. The words the shopper typed keep their capitals. */
function preserveTypedName(original, folded) {
  const source = String(original || "").trim().replace(/\s+/g, " ");
  const target = String(folded || "").trim();
  if (!source) return target;
  if (!target) return source;
  const idx = source.toLowerCase().lastIndexOf(target.toLowerCase());
  if (idx < 0) return source;
  return source.slice(idx, idx + target.length);
}

export function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

function lineExportName(line) {
  return shopNameForDisplay(line.display_name);
}

export function presentLine(line, mealTitles = {}) {
  const buy = buyQuantity(line);
  const faces = presentShopFaces({ quantity: buy, unit: line.unit, name: line.display_name });
  const spoken = { display: faces.humanQuantity, accessible: faces.humanAccessible };
  const titles = (line.meal_ids || []).map((id) => mealTitles[id]).filter(Boolean);
  const origins = new Set((line.requirements || []).map((req) => req.origin));
  let origin = "general";
  if (origins.has("recipe") && origins.has("general")) origin = "mixed";
  else if (origins.has("recipe")) origin = "recipe";
  return {
    line_id: line.line_id,
    origin,
    ingredient_id: line.ingredient_id,
    general_key: line.general_key,
    display_name: line.display_name,
    product_name: faces.product,
    name_custom: !!line.name_custom,
    preparation: line.preparation,
    unit: line.unit,
    quantity_required: line.quantity_required,
    quantity_manual: line.quantity_manual,
    quantity_override: line.quantity_override,
    override_basis: line.override_basis,
    override_stale: !!line.override_stale,
    reconcile_note: line.reconcile_note,
    buy_quantity: buy,
    quantity_label: spoken.display,
    quantity_accessible: spoken.accessible,
    list_state: line.list_state,
    still_needed: !!line.still_needed,
    surplus_quantity: line.surplus_quantity || 0,
    meal_ids: line.meal_ids || [],
    meal_titles: titles,
    recipe_version_ids: line.recipe_version_ids || [],
    category: line.category || "other",
    unparsed: !!line.unparsed,
    note: line.note,
    sources: (line.requirements || []).map((req) => ({
      requirement_id: req.requirement_id,
      origin: req.origin,
      quantity: req.quantity,
      unit: req.unit,
      still_needed: !!req.still_needed,
      dinner_plan_id: req.dinner_plan_id || null,
      meal_ids: req.meal_ids || [],
    })),
  };
}

function sectionItems(lines, { includeSkipped, mealTitles }) {
  return lines
    .filter((line) => includeSkipped || line.list_state !== "skipped")
    .map((line) => {
      const presented = presentLine(line, mealTitles);
      return {
        name: lineExportName(line),
        quantity: presented.buy_quantity,
        unit: humanUnit(line.unit, presented.buy_quantity),
        category: presented.category,
        meals: presented.meal_titles,
        note: line.note || line.reconcile_note || "",
        list_state: line.list_state,
      };
    });
}

export function exportSections(list, { includeSkipped = false, mealTitles = {} } = {}) {
  const dinners = [];
  const house = [];
  const bought = [];
  const have = [];
  const leaving = [];
  const dropped = [];
  for (const line of list.lines || []) {
    if (!line.still_needed) {
      dropped.push(line);
      continue;
    }
    if (line.list_state === "skipped") {
      leaving.push(line);
      continue;
    }
    if (line.list_state === "purchased") {
      bought.push(line);
      continue;
    }
    if (line.list_state === "already_have") {
      have.push(line);
      continue;
    }
    if ((line.requirements || []).some((req) => req.origin === "recipe")) dinners.push(line);
    else house.push(line);
  }
  const byCategory = (rows) => {
    const groups = new Map();
    for (const line of rows) {
      const category = CATEGORY_ORDER.includes(line.category) ? line.category : "other";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(line);
    }
    return CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => ({
      name: CATEGORY_LABELS[category],
      category,
      items: sectionItems(groups.get(category), { includeSkipped, mealTitles }),
    }));
  };
  const sections = [
    ...byCategory(dinners),
    house.length
      ? { name: "Around the house", category: "house", items: sectionItems(house, { includeSkipped, mealTitles }) }
      : null,
    bought.length ? { name: "Bought", category: "bought", items: sectionItems(bought, { includeSkipped, mealTitles }) } : null,
    have.length ? { name: "Already have", category: "already_have", items: sectionItems(have, { includeSkipped, mealTitles }) } : null,
    includeSkipped && leaving.length
      ? { name: "Leaving off", category: "skipped", items: sectionItems(leaving, { includeSkipped: true, mealTitles }) }
      : null,
    dropped.length
      ? { name: "No longer needed", category: "dropped", items: sectionItems(dropped, { includeSkipped, mealTitles }) }
      : null,
  ].filter(Boolean);
  return sections;
}

export function renderExportText(list, options = {}) {
  return renderExportTextFromSections(exportSections(list, options), options.headline || "");
}

export function renderExportTextFromSections(sections, headline) {
  const lines = ["FlavorWeave list"];
  if (headline) lines.push(headline);
  lines.push("");
  for (const section of sections) {
    lines.push(section.name);
    for (const item of section.items) {
      const amount = formatTrueQuantity(item.quantity);
      const unit = item.unit || "";
      const qty = amount ? (unit ? `${amount} ${unit}` : amount) : "";
      const meal = item.meals && item.meals.length ? ` (${item.meals.slice(0, 2).join(", ")})` : "";
      lines.push(`${qty ? `${qty} ` : ""}${item.name}${meal}`.trim());
    }
    lines.push("");
  }
  return `${lines.join("\n").trim()}\n`;
}

export function renderExportCsv(sections) {
  const rows = [["section", "name", "quantity", "unit", "note"]];
  for (const section of sections) {
    for (const item of section.items) {
      rows.push([
        section.name,
        item.name,
        formatTrueQuantity(item.quantity),
        item.unit || "",
        item.note || "",
      ]);
    }
  }
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

export function shareSnapshot(list, { headline = "", mealTitles = {} } = {}) {
  const sections = exportSections(list, { includeSkipped: false, mealTitles }).map((section) => ({
    name: section.name,
    category: section.category,
    items: section.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      meals: item.meals || [],
    })),
  }));
  return { headline, sections };
}

/**
 * Public recipe text. Yield is a count, never a member name or a diet limit.
 */
export function renderRecipeExport({ title, yieldLine, ingredients, steps }) {
  const lines = [String(title || "Recipe").trim(), yieldLine || "For 1 person", "", "Ingredients"];
  for (const item of ingredients || []) {
    const amount = formatTrueQuantity(item.quantity);
    const unit = humanUnit(item.unit, item.quantity) || (item.unit && item.unit !== "count" && item.unit !== "unparsed" ? item.unit : "");
    const qty = amount ? (unit ? `${amount} ${unit}` : amount) : "";
    const name = item.name || item.display_name || "Item";
    lines.push(`${qty ? `${qty} ` : ""}${name}`.trim());
  }
  lines.push("", "Steps");
  (steps || []).forEach((step, index) => {
    const text = typeof step === "string" ? step : step.text || step.body || "";
    lines.push(`${index + 1}. ${text}`);
  });
  return `${lines.join("\n").trim()}\n`;
}

export function recipeYieldLine({ dinerCount, guestCount }) {
  const n = Math.max(1, Math.min(8, Number(dinerCount) || 1));
  const guests = Math.max(0, Number(guestCount) || 0);
  if (guests > 0) return `For ${n} · ${guests} ${guests === 1 ? "guest" : "guests"}`;
  return `For ${n} ${n === 1 ? "person" : "people"}`;
}

export const SHOP_EXPORT_TYPES = ["copy_app", "image", "copy", "share", "print", "download"];
export const SHOP_EXPORT_SURFACES = ["shop_sheet", "shop_menu", "api"];
/** generated is the payload. succeeded is the one completed handoff. */
export const SHOP_EXPORT_STAGES = ["generated", "attempted", "succeeded", "cancelled", "failed"];

export const SHOP_EVENT_PROPS = {
  shopping_item_added: ["origin", "unparsed", "has_quantity"],
  shopping_item_edited: ["fields"],
  shopping_item_completed: ["list_state"],
  shopping_mode_selected: ["mode", "scope"],
  shopping_list_shared: ["channel"],
  shopping_list_exported: ["format"],
  shopping_conflict: ["op"],
  shop_export: ["type", "ok", "surface", "stage"],
};

/** Edit patch keys editLine understands. Anything else never reaches telemetry. */
export const SHOP_EDIT_FIELDS = ["category", "display_name", "list_state", "note", "quantity", "unit"];

/** Mutation ops the list route accepts, plus the generic "write" fallback. */
export const SHOP_CONFLICT_OPS = [
  "add_item",
  "clear_completed",
  "delete_general",
  "edit_line",
  "resolve_override",
  "set_state",
  "set_trip_method",
  "write",
];

function cleanEventValue(key, value) {
  if (key === "fields") {
    const known = String(value)
      .split(",")
      .map((field) => field.trim())
      .filter((field) => SHOP_EDIT_FIELDS.includes(field));
    const unique = [...new Set(known)].sort();
    return unique.length ? unique.join(",") : null;
  }
  if (key === "op") return SHOP_CONFLICT_OPS.includes(value) ? value : null;
  if (key === "type") return SHOP_EXPORT_TYPES.includes(value) ? value : null;
  if (key === "surface") return SHOP_EXPORT_SURFACES.includes(value) ? value : null;
  if (key === "stage") return SHOP_EXPORT_STAGES.includes(value) ? value : null;
  if (key === "ok") {
    if (value === true || value === 1 || value === "true") return true;
    if (value === false || value === 0 || value === "false") return false;
    return null;
  }
  return value;
}

/**
 * shop_export stores only the closed field set. Any other key is dropped.
 * Returns { handled: false } for events that keep the legacy props path.
 */
export function storedEventProps(eventName, body) {
  if (eventName !== "shop_export") return { handled: false };
  if (body && body.stage != null && !SHOP_EXPORT_STAGES.includes(body.stage)) {
    return { handled: true, error: "invalid_event" };
  }
  const safe = sanitizeShopEvent(eventName, body || {});
  if (!safe || !safe.type) return { handled: true, error: "invalid_event" };
  return { handled: true, props: safe };
}

/**
 * One completed export per user action.
 * A row with `stage` counts only when that stage is `succeeded`.
 * A legacy row has no stage: the clipboard confirmation was surface shop_sheet.
 * The server generation (surface api) is not a second completion.
 */
function shopExportProps(row) {
  const props = row && row.props ? row.props : row;
  if (!props || typeof props !== "object") return null;
  return props;
}

function shopExportSucceeded(props) {
  if (props.stage) return props.stage === "succeeded";
  return props.surface === "shop_sheet" && (props.ok === true || props.ok === 1 || props.ok === "true");
}

export function countCompletedShopExports(rows) {
  let count = 0;
  for (const row of rows || []) {
    const props = shopExportProps(row);
    if (props && shopExportSucceeded(props)) count += 1;
  }
  return count;
}

/**
 * Image handoff completions.
 * A share that falls back to a file save is type `download` on `shop_sheet`.
 * That row is one image export. It is not a text-file download (`shop_menu`).
 * Counting type `download` alone mixes the two and under-counts images.
 */
export function summarizeShopExports(rows) {
  const summary = {
    completed: 0,
    image_exports: 0,
    file_downloads: 0,
    by_type: {},
  };
  for (const row of rows || []) {
    const props = shopExportProps(row);
    if (!props || !shopExportSucceeded(props)) continue;
    summary.completed += 1;
    const type = props.type || "unknown";
    summary.by_type[type] = (summary.by_type[type] || 0) + 1;
    const imageFallback = type === "download" && props.surface === "shop_sheet";
    if (type === "image" || imageFallback) summary.image_exports += 1;
    else if (type === "download") summary.file_downloads += 1;
  }
  return summary;
}

export function sanitizeShopEvent(name, props) {
  const allow = SHOP_EVENT_PROPS[name];
  if (!allow) return null;
  const out = {};
  for (const key of allow) {
    if (!props || props[key] == null) continue;
    const value = cleanEventValue(key, props[key]);
    if (value != null) out[key] = value;
  }
  return out;
}
