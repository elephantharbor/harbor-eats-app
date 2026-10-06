/**
 * D-07 client helpers: shelves, URL shape, empty states. No ranking or filtering.
 */

import { emptyQuery, serializeQueryString } from "./query.js";

export const SHELF_MIN_TOTAL = 4;

/** @type {{ id: string, title: string, subtitle: string, query: object }[]} */
export const DISCOVERY_SHELVES = [
  { id: "good_matches", title: "Good matches", altTitle: "Fits your table", subtitle: "Picked from what your table likes", altSubtitle: "Every one of these works for everyone eating", query: {} },
  { id: "easy", title: "Easy", subtitle: "Short on steps, light on fuss", query: { criteria: { effort_levels: ["easy"] } } },
  { id: "quick", title: "Under 30 minutes", subtitle: "On the table in half an hour", query: { criteria: { quick: true } } },
  { id: "simple", title: "Simple ingredients", subtitle: "Familiar ingredients, nothing hard to find", query: { criteria: { ingredient_complexities: ["simple"] } } },
  { id: "seafood", title: "Fish & seafood", subtitle: "Fish and shellfish dinners", query: { criteria: { protein_groups: ["seafood"] } } },
  { id: "plant", title: "Plant-forward", subtitle: "Vegetarian-friendly dinners", query: { criteria: { diet: ["plant"] } } },
  { id: "different", title: "Something different", subtitle: "Ones you haven’t cooked lately", query: { criteria: { different: true } } },
];

const EXPLICIT_PREFIX = "explicit_";

/**
 * @param {object} query normalized discovery query
 */
/**
 * Whether the chip-row time control is in an applied state.
 * @param {object} criteria
 */
export function timeChipIsOn(criteria) {
  const c = criteria || {};
  return c.quick === true || c.max_minutes != null;
}

/**
 * Toggle patch for the chip-row “Under 30 min” control (§6.2).
 * @param {object} criteria normalized criteria
 */
export function timeChipTogglePatch(criteria) {
  if (timeChipIsOn(criteria)) {
    return { quick: false, max_minutes: null };
  }
  return { quick: true, max_minutes: null };
}

export function queryHasActiveCriteria(query) {
  if (!query) return false;
  if (query.text) return true;
  const c = query.criteria || {};
  if (c.quick) return true;
  if (c.different) return true;
  if (c.max_minutes != null) return true;
  for (const key of [
    "cuisines",
    "meal_styles",
    "flavors",
    "ingredients",
    "exclude_ingredients",
    "effort_levels",
    "ingredient_complexities",
    "methods",
    "equipment",
    "protein_groups",
    "diet",
    "textures",
  ]) {
    if (Array.isArray(c[key]) && c[key].length) return true;
  }
  return false;
}

/**
 * Browser URL query string (contract names, no schema/limit/offset).
 * @param {object} query normalized
 * @param {object} [ctx] discovery context fields for the URL
 */
export function browserDiscoverySearch(query, ctx) {
  const full = serializeQueryString(query);
  const params = new URLSearchParams(full);
  params.delete("schema");
  params.delete("limit");
  params.delete("offset");
  if (ctx) {
    const mode = ctx.mode || "standalone";
    if (mode !== "standalone") params.set("mode", mode);
    if (ctx.dinner_plan_id) params.set("dinner_plan_id", ctx.dinner_plan_id);
    if (ctx.meal_id) params.set("meal_id", ctx.meal_id);
    if (mode === "choose_for_plan" && ctx.position != null) {
      params.set("position", String(ctx.position));
    }
    if (mode === "standalone") {
      for (const id of ctx.participant_ids || []) {
        params.append("participant_id", id);
      }
    }
  }
  return params;
}

/**
 * Strip replace-mode fields and unsupported diet tokens from a /find URL (D-07 closure §1, §3).
 * @param {URLSearchParams} params
 */
export function repairFindBrowserParams(params) {
  const mode = params.get("mode") || "standalone";
  if (mode === "replace_plan_meal") {
    params.delete("position");
    while (params.has("participant_id")) params.delete("participant_id");
  }
  if (params.has("diet")) {
    const kept = params
      .get("diet")
      .split(",")
      .map((s) => s.trim())
      .filter((t) => t === "plant");
    if (kept.length) params.set("diet", [...new Set(kept)].join(","));
    else params.delete("diet");
  }
  return params;
}

/**
 * @param {object} row discovery result row
 * @param {(id: string) => string|null} memberName
 * @param {{ total_minutes?: number, effort_level?: string, ingredient_complexity?: string }} [recipeFallback]
 */
export function discoveryWhyLines(row, memberName, recipeFallback) {
  const lines = [];
  if (row) {
    const taste = tasteReasonLine(row, memberName);
    if (taste) lines.push(taste);
    if ((row.reasons || []).includes("explicit_different")) {
      lines.push("You haven’t made this one lately");
    }
    const minutes = row.total_minutes;
    if (minutes != null && minutes <= 30) {
      lines.push("On the table in " + minutes + " minutes");
    }
    if (row.effort_level === "easy") {
      lines.push("Easy: short on steps, light on fuss");
    }
    if (row.ingredient_complexity === "simple") {
      lines.push("Familiar ingredients, nothing hard to find");
    }
  } else if (recipeFallback) {
    const minutes = recipeFallback.total_minutes;
    if (minutes != null && minutes <= 30) {
      lines.push("On the table in " + minutes + " minutes");
    }
    if (recipeFallback.effort_level === "easy") {
      lines.push("Easy: short on steps, light on fuss");
    }
    if (recipeFallback.ingredient_complexity === "simple") {
      lines.push("Familiar ingredients, nothing hard to find");
    }
  }
  return lines.slice(0, 3);
}

/**
 * @param {object} query normalized
 * @param {object} [ctx]
 */
export function findPathFromState(query, ctx) {
  const params = browserDiscoverySearch(query, ctx);
  const qs = params.toString();
  return qs ? `/find?${qs}` : "/find";
}

/**
 * @param {object} shelf shelf definition
 * @param {object} response discovery search response for that shelf
 */
export function shelfDisplayTitle(shelf, response) {
  if (shelf.id !== "good_matches") return shelf.title;
  const results = (response && response.results) || [];
  const tasteHit = results.some(function (r) {
    return r.primary_reason === "taste_love" || r.primary_reason === "taste_like";
  });
  return tasteHit ? shelf.title : shelf.altTitle;
}

export function shelfDisplaySubtitle(shelf, response) {
  if (shelf.id !== "good_matches") return shelf.subtitle;
  const results = (response && response.results) || [];
  const tasteHit = results.some(function (r) {
    return r.primary_reason === "taste_love" || r.primary_reason === "taste_like";
  });
  return tasteHit ? shelf.subtitle : shelf.altSubtitle;
}

/**
 * @param {object} query
 * @param {number} total
 * @param {Record<string, number>} excluded
 */
export function emptyStateKind(query, total, excluded) {
  if (total > 0) return null;
  const counts = excluded || {};
  const hasExplicit = Object.keys(counts).some(function (k) {
    return k.startsWith(EXPLICIT_PREFIX) && counts[k] > 0;
  });
  if (hasExplicit) return "relax";
  if (query && query.text) return "text";
  return "nothing_fits";
}

const REMOVAL_ORDER = [
  ["explicit_quick", "time"],
  ["explicit_max_minutes", "time"],
  ["explicit_effort", "easy"],
  ["explicit_complexity", "simple"],
  ["explicit_cuisine", "cuisine"],
  ["explicit_meal_style", "style"],
  ["explicit_flavor", "flavor"],
  ["explicit_ingredient", "ingredient"],
  ["explicit_protein", "protein"],
  ["explicit_diet", "diet"],
  ["explicit_texture", "texture"],
  ["explicit_different", "different"],
];

/**
 * Chips for §11.2, at most three.
 * @param {Record<string, number>} excluded
 * @param {object} query normalized
 */
export function relaxRemoveChips(excluded, query) {
  const counts = excluded || {};
  const chips = [];
  for (const [code, kind] of REMOVAL_ORDER) {
    if (!counts[code]) continue;
    if (kind === "time") {
      if (query.criteria.quick) chips.push({ label: "Under 30 min", patch: { quick: false, max_minutes: null } });
      else if (query.criteria.max_minutes != null) chips.push({ label: "Under " + query.criteria.max_minutes + " min", patch: { max_minutes: null } });
    } else if (kind === "easy") chips.push({ label: "Easy", patch: { effort_levels: [] } });
    else if (kind === "simple") chips.push({ label: "Simple ingredients", patch: { ingredient_complexities: [] } });
    else if (kind === "different") chips.push({ label: "Something different", patch: { different: false } });
    else if (kind === "cuisine" && query.criteria.cuisines.length) {
      chips.push({ label: query.criteria.cuisines[0], patch: { cuisines: query.criteria.cuisines.slice(1) } });
    } else if (kind === "style" && query.criteria.meal_styles.length) {
      chips.push({ label: query.criteria.meal_styles[0], patch: { meal_styles: query.criteria.meal_styles.slice(1) } });
    } else if (kind === "flavor" && query.criteria.flavors.length) {
      chips.push({ label: query.criteria.flavors[0], patch: { flavors: query.criteria.flavors.slice(1) } });
    } else if (kind === "ingredient" && query.criteria.ingredients.length) {
      chips.push({ label: query.criteria.ingredients[0], patch: { ingredients: query.criteria.ingredients.slice(1) } });
    } else if (kind === "protein" && query.criteria.protein_groups.length) {
      chips.push({ label: "Fish & seafood", patch: { protein_groups: [] } });
    } else if (kind === "diet" && query.criteria.diet.length) {
      chips.push({ label: "Plant-forward", patch: { diet: [] } });
    } else if (kind === "texture" && query.criteria.textures.length) {
      chips.push({ label: query.criteria.textures[0], patch: { textures: query.criteria.textures.slice(1) } });
    }
    if (chips.length >= 3) break;
  }
  return chips.slice(0, 3);
}

/**
 * @param {object} result discovery result row
 * @param {(id: string) => string|null} memberName
 */
export function tasteReasonLine(result, memberName) {
  if (!result) return "";
  const pr = result.primary_reason;
  if (pr !== "taste_love" && pr !== "taste_like") return "";
  const hits = (result.taste_hits || []).slice(0, 2);
  const terms = hits
    .map(function (h) {
      return h.display_name || h.term_slug || "";
    })
    .filter(Boolean);
  if (!terms.length) return "";
  const joined = terms.length === 1 ? terms[0] : terms[0] + " and " + terms[1];
  const other = hits.find(function (h) {
    return h.member_id && memberName && memberName(h.member_id) && h.member_id !== h.viewer_id;
  });
  if (other && memberName(other.member_id)) {
    const who = memberName(other.member_id);
    return pr === "taste_love" ? who + " loves " + joined : who + " likes " + joined;
  }
  return pr === "taste_love" ? "You told us you love " + joined : "You said you like " + joined;
}

export function defaultBrowseQuery() {
  return emptyQuery();
}

export function apiSearchQueryString(query, limit) {
  const q = { ...query, limit: limit || 50, offset: 0 };
  return serializeQueryString(q);
}
