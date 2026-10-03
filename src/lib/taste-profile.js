/**
 * Diner taste reads and writes on top of the Cycle 2 contract.
 *
 * Tastes belong to one member. Nothing here averages a household, writes a
 * hard limit, or adds a vocabulary term. Search goes through resolveTasteTerm.
 * Eligibility questions go through decideEligibility. Consumer copy goes
 * through presentStance, so an inferred row's confidence never leaves this file.
 */

import { requireSession } from "./auth.js";
import {
  CONTRACT_TABLES,
  HARD_LIMIT_LABELS,
  TARGETED_FEEDBACK,
  TARGETED_FEEDBACK_CODES,
  TASTE_RANKS,
  TASTE_RANK_LABELS,
  TASTE_REMOVE,
} from "./cycle2-schema.js";
import { rulesFromLegacyKeys } from "./legacy-preference-audit.js";
import { canonicalRecipeVersion } from "./meal-identity.js";
import {
  decideEligibility,
  presentStance,
  recordTargetedFeedback,
  removeTaste,
  setTaste,
} from "./preference-concepts.js";
import { catalogVocabularyCoverage } from "./recipe-package.js";
import { resolveTasteTerm } from "./taste-resolver.js";
import { getTasteTerm, listVocabulary, normalizeTasteTerm } from "./taste-vocabulary.js";

const T = CONTRACT_TABLES;

/** Friendly browse headings. Order is the browse order. */
export const BROWSE_GROUPS = [
  { category: "meal_style", title: "Kinds of dinner" },
  { category: "cuisine", title: "Cuisines" },
  { category: "flavor", title: "Flavors" },
  { category: "texture", title: "Textures" },
  { category: "ingredient", title: "Ingredients" },
];

/** First screen of onboarding. Small and varied on purpose; Browse more has the rest. */
export const STARTER_SLUGS = [
  "tacos",
  "curries",
  "pasta",
  "crispy",
  "spicy",
  "smoky",
  "mediterranean",
  "japanese",
  "mushrooms",
  "salmon",
];

for (const slug of STARTER_SLUGS) {
  const term = getTasteTerm(slug);
  if (!term || !term.active) throw new Error(`starter taste is not in the vocabulary: ${slug}`);
}

/** Named fish a diner can rank. Shown when someone searches the bare word "fish". */
const NAMED_FISH = ["salmon", "cod", "swordfish", "arctic-char"];

/**
 * Words that describe what is safe to eat, not what tastes good. Search
 * points these at Diet limits instead of pretending they are tastes.
 */
const LIMIT_WORDS = new Set([
  "fish",
  "finfish",
  "no fish",
  "seafood",
  "shellfish",
  "dairy",
  "no dairy",
  "nuts",
  "no nuts",
  "nut",
  "meat",
  "no meat",
  "poultry",
  "vegetarian",
  "vegan",
  "allergy",
  "allergies",
  "gluten",
  "gluten free",
]);

/** Consumer names for hard limits. "No fish" matches the Diet limits screen. */
const LIMIT_NAMES = {
  ...HARD_LIMIT_LABELS,
  no_finfish: "No fish",
  allergy: "allergy",
  prohibited_ingredient: "no-go",
};

const MAX_CHANGES = 80;

let coverageCache = null;
function coverage() {
  if (!coverageCache) coverageCache = catalogVocabularyCoverage();
  return coverageCache;
}

/** Test seam: recompute catalog coverage (the catalog is edited in parallel). */
export function resetCoverageCache() {
  coverageCache = null;
}

function groupTitle(category) {
  const g = BROWSE_GROUPS.find((row) => row.category === category);
  return g ? g.title : "";
}

/**
 * Consumer view of one vocabulary term. on_menu is a yes/no so the UI can say
 * plainly when nothing matches yet. Counts are not exposed.
 * @param {import("./taste-vocabulary.js").TasteTerm} term
 */
export function termView(term) {
  return {
    slug: term.slug,
    name: term.display_name,
    category: term.category,
    group: groupTitle(term.category),
    on_menu: (coverage()[term.slug] || 0) > 0,
  };
}

export function tasteCatalog() {
  const active = listVocabulary().filter((term) => term.active);
  return {
    starters: STARTER_SLUGS.map((slug) => termView(getTasteTerm(slug))),
    groups: BROWSE_GROUPS.map((g) => ({
      category: g.category,
      title: g.title,
      terms: active
        .filter((term) => term.category === g.category)
        .map(termView)
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),
    ranks: TASTE_RANKS.map((rank) => ({ rank, label: TASTE_RANK_LABELS[rank] })),
    feedback: TARGETED_FEEDBACK_CODES.map((code) => ({
      code,
      label: TARGETED_FEEDBACK[code].label,
    })),
  };
}

function namedFishPhrase() {
  const names = NAMED_FISH.map((slug) => getTasteTerm(slug))
    .filter(Boolean)
    .map((term) => term.display_name);
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

/**
 * One search box, one deterministic answer. Exact alias match only.
 * @param {unknown} query
 */
export function searchTastes(query) {
  const raw = String(query ?? "").trim().slice(0, 80);
  const hit = resolveTasteTerm(raw);
  if (hit.status === "resolved" && hit.concept) {
    return { status: "resolved", query: raw, match: termView(hit.concept), message: null };
  }
  const key = normalizeTasteTerm(raw);
  if (!key) return { status: "empty", query: raw, match: null, message: null };
  if (key === "fish" || key === "finfish" || key === "no fish") {
    return {
      status: "limit",
      query: raw,
      match: null,
      message: `Whether fish is on your plate is a diet limit, not a taste. You can still pick ${namedFishPhrase()} if you love them.`,
    };
  }
  if (LIMIT_WORDS.has(key)) {
    return {
      status: "limit",
      query: raw,
      match: null,
      message: "That sounds like a diet limit. Set those in Diet limits, where they always win over tastes.",
    };
  }
  if (hit.status === "inactive") {
    return {
      status: "inactive",
      query: raw,
      match: null,
      message: `We’ve retired “${raw}”. Try Browse more for something close.`,
    };
  }
  return {
    status: "unresolved",
    query: raw,
    match: null,
    message: `We don’t have “${raw}” as a taste yet. Try a dish, a cuisine, or Browse more.`,
  };
}

/**
 * Stored constraint_rule rows to hard-limit rules for one diner.
 * Household-wide rows (member_id NULL) apply to everyone.
 * @param {{ member_id?: string|null, rule_key: string, status?: string }[]} rows
 * @param {string} memberId
 */
export function hardRulesForMember(rows, memberId) {
  const mine = (rows || []).filter((row) => !row.member_id || row.member_id === memberId);
  const keys = [];
  for (const row of mine) {
    const status = row.status || "prohibited";
    if (status === "prohibited") keys.push(row.rule_key);
    else if (status === "permitted" && row.rule_key === "cashew") keys.push("cashew");
  }
  return rulesFromLegacyKeys(keys);
}

function limitNote(blockedIds, name) {
  const labels = [...new Set(blockedIds.map((id) => LIMIT_NAMES[id] || id))];
  const which = labels.length === 1 ? `Your ${labels[0]} limit` : "Your diet limits";
  return `${which} still comes first, so ${name} won’t show up in your picks.`;
}

const RANK_ORDER = { love: 0, like: 1, less_often: 2 };

/**
 * The Fine-tune screen's data for one diner.
 * @param {{
 *   memberId: string,
 *   rows: { member_id: string, vocabulary_slug: string, rank: string, stance: string, confidence?: number|null }[],
 *   rules?: { id: string, status?: string, substance?: string|null }[],
 * }} input
 */
export function presentTasteProfile(input) {
  const memberId = input.memberId;
  const rules = input.rules || [];
  const told = [];
  const learning = [];
  for (const row of input.rows || []) {
    if (row.member_id !== memberId) continue;
    const term = getTasteTerm(row.vocabulary_slug);
    if (!term || !TASTE_RANKS.includes(row.rank)) continue;
    const stance = presentStance(row);
    const verdict = decideEligibility({
      limits: [{ member_id: memberId, rules }],
      recipe: { vocabulary_tag_ids: [term.slug] },
      tastes: [row],
    });
    const blockedIds = verdict.blocked.flatMap((b) => b.limit_ids);
    const view = termView(term);
    if (stance.stance === "inferred" && blockedIds.length) continue;
    const item = {
      ...view,
      rank: row.rank,
      rank_label: TASTE_RANK_LABELS[row.rank],
      stance: stance.stance,
      stance_label: stance.label,
      editable: stance.editable,
      limit_note: blockedIds.length ? limitNote(blockedIds, term.display_name) : null,
      menu_note:
        !view.on_menu && row.rank !== "less_often" && !blockedIds.length
          ? "Nothing on the menu has this yet. We’ll keep it in mind as new dinners land."
          : null,
    };
    (stance.stance === "inferred" ? learning : told).push(item);
  }
  const order = (a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank] || a.name.localeCompare(b.name);
  told.sort(order);
  learning.sort(order);
  return { member_id: memberId, told, learning };
}

/**
 * Validate a batch of changes for one diner against the contract, without I/O.
 * Accepts { vocabulary_slug | term, rank } where rank is a taste rank or "remove".
 * @param {object[]} current that diner's rows
 * @param {string} memberId
 * @param {object[]} changes
 * @param {string} dataOrigin
 */
export function planTasteChanges(current, memberId, changes, dataOrigin) {
  let tastes = (current || []).filter((row) => row.member_id === memberId);
  const writes = [];
  const results = [];
  for (const change of changes || []) {
    const rank = change && change.rank;
    let slug = change && change.vocabulary_slug ? String(change.vocabulary_slug) : null;
    if (!slug && change && change.term != null) {
      const hit = resolveTasteTerm(change.term);
      slug = hit.status === "resolved" ? hit.vocabulary_slug : null;
    }
    const term = slug ? getTasteTerm(slug) : null;
    if (!term || !term.active) {
      results.push({ vocabulary_slug: slug, ok: false, error: "unknown_taste" });
      continue;
    }
    if (rank === TASTE_REMOVE) {
      const out = removeTaste(tastes, memberId, term.slug);
      tastes = out.tastes;
      writes.push({ op: "remove", vocabulary_slug: term.slug });
      results.push({ vocabulary_slug: term.slug, ok: true, removed: true, hard_limit_written: false });
      continue;
    }
    if (!TASTE_RANKS.includes(rank)) {
      results.push({ vocabulary_slug: term.slug, ok: false, error: "invalid_rank" });
      continue;
    }
    const out = setTaste(tastes, {
      member_id: memberId,
      vocabulary_slug: term.slug,
      rank,
      stance: "explicit",
      data_origin: dataOrigin,
    });
    tastes = out.tastes;
    writes.push({ op: "upsert", vocabulary_slug: term.slug, rank, data_origin: out.taste.data_origin });
    results.push({ vocabulary_slug: term.slug, ok: true, rank });
  }
  return { tastes, writes, results };
}

// ——— D1 ———

async function ensureVocabularyRow(db, slug, ts) {
  const term = getTasteTerm(slug);
  if (!term) throw new Error(`unknown taste: ${slug}`);
  if (term.parent_slug) await ensureVocabularyRow(db, term.parent_slug, ts);
  await db
    .prepare(
      `INSERT OR IGNORE INTO ${T.taste_vocabulary}
        (slug, display_name, category, parent_slug, active, synonyms_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      term.slug,
      term.display_name,
      term.category,
      term.parent_slug,
      term.active ? 1 : 0,
      JSON.stringify(term.synonyms),
      ts
    )
    .run();
}

export async function loadMemberTasteRows(db, householdId, memberId) {
  const res = await db
    .prepare(
      `SELECT member_id, vocabulary_slug, rank, stance, confidence, data_origin, updated_at
         FROM ${T.diner_taste}
        WHERE household_id = ? AND member_id = ?`
    )
    .bind(householdId, memberId)
    .all();
  return (res && res.results) || [];
}

export async function loadMemberHardRules(db, householdId, memberId) {
  const res = await db
    .prepare(
      `SELECT member_id, rule_key, status FROM constraint_rule
        WHERE household_id = ? AND (member_id = ? OR member_id IS NULL)`
    )
    .bind(householdId, memberId)
    .all();
  return hardRulesForMember((res && res.results) || [], memberId);
}

export async function loadTasteProfile(db, householdId, memberId) {
  const [rows, rules] = await Promise.all([
    loadMemberTasteRows(db, householdId, memberId),
    loadMemberHardRules(db, householdId, memberId),
  ]);
  return presentTasteProfile({ memberId, rows, rules });
}

function tasteId() {
  return `dt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

/**
 * Apply explicit Love / Like / Less often / remove for one diner.
 * An explicit write replaces an inferred row for the same term.
 */
export async function applyTasteChanges(db, { householdId, memberId, changes, dataOrigin, now }) {
  const ts = now || new Date().toISOString();
  const current = await loadMemberTasteRows(db, householdId, memberId);
  const plan = planTasteChanges(current, memberId, changes, dataOrigin);
  for (const write of plan.writes) {
    if (write.op === "remove") {
      await db
        .prepare(`DELETE FROM ${T.diner_taste} WHERE household_id = ? AND member_id = ? AND vocabulary_slug = ?`)
        .bind(householdId, memberId, write.vocabulary_slug)
        .run();
      continue;
    }
    await ensureVocabularyRow(db, write.vocabulary_slug, ts);
    await db
      .prepare(
        `INSERT INTO ${T.diner_taste}
          (taste_id, household_id, member_id, vocabulary_slug, rank, stance, confidence, data_origin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'explicit', NULL, ?, ?, ?)
         ON CONFLICT(member_id, vocabulary_slug) DO UPDATE SET
           rank = excluded.rank,
           stance = 'explicit',
           confidence = NULL,
           data_origin = excluded.data_origin,
           updated_at = excluded.updated_at`
      )
      .bind(tasteId(), householdId, memberId, write.vocabulary_slug, write.rank, write.data_origin, ts, ts)
      .run();
  }
  return { results: plan.results };
}

/**
 * Model hook for a future learner. Writes a tentative row unless the diner
 * already told us something about that term. No route calls this yet, and a
 * meal rating alone produces nothing (attributeTastesFromMealRating is empty).
 */
export async function recordInferredTaste(db, { householdId, memberId, vocabularySlug, rank, confidence, dataOrigin, now }) {
  const ts = now || new Date().toISOString();
  const current = await loadMemberTasteRows(db, householdId, memberId);
  const out = setTaste(current, {
    member_id: memberId,
    vocabulary_slug: vocabularySlug,
    rank,
    stance: "inferred",
    confidence,
    data_origin: dataOrigin,
  });
  if (out.rejected) return { written: false, reason: out.rejected };
  await ensureVocabularyRow(db, out.taste.vocabulary_slug, ts);
  await db
    .prepare(
      `INSERT INTO ${T.diner_taste}
        (taste_id, household_id, member_id, vocabulary_slug, rank, stance, confidence, data_origin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'inferred', ?, ?, ?, ?)
       ON CONFLICT(member_id, vocabulary_slug) DO UPDATE SET
         rank = excluded.rank,
         confidence = excluded.confidence,
         data_origin = excluded.data_origin,
         updated_at = excluded.updated_at
       WHERE ${T.diner_taste}.stance = 'inferred'`
    )
    .bind(tasteId(), householdId, memberId, out.taste.vocabulary_slug, out.taste.rank, out.taste.confidence, out.taste.data_origin, ts, ts)
    .run();
  return { written: true };
}

/**
 * Optional "Loved the crunch" style note on one cooked meal. Not a survey,
 * not a standing taste, not a hard limit.
 */
export async function saveTargetedFeedback(db, { householdId, memberId, mealOptionId, recipeVersionId, code, dataOrigin, now }) {
  let versionId = recipeVersionId || null;
  if (mealOptionId) {
    const mo = await db
      .prepare(
        `SELECT mo.recipe_slug, mo.recipe_version FROM meal_option mo
           JOIN plan p ON p.plan_id = mo.plan_id
          WHERE mo.meal_option_id = ? AND p.household_id = ?`
      )
      .bind(mealOptionId, householdId)
      .first();
    if (!mo) return { ok: false, error: "meal_option_not_found" };
    versionId = canonicalRecipeVersion(mo, recipeVersionId, null);
  }
  if (!versionId) return { ok: false, error: "recipe_version_required" };
  const row = recordTargetedFeedback({
    member_id: memberId,
    recipe_version_id: versionId,
    code,
    data_origin: dataOrigin,
  });
  const feedbackId = `tf_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await db
    .prepare(
      `INSERT INTO ${T.targeted_feedback}
        (feedback_id, household_id, member_id, meal_option_id, recipe_version_id, code, stance, data_origin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'explicit', ?, ?)`
    )
    .bind(feedbackId, householdId, memberId, mealOptionId || null, row.recipe_version_id, row.code, row.data_origin, now || new Date().toISOString())
    .run();
  return { ok: true, feedback: { feedback_id: feedbackId, ...row } };
}

// ——— HTTP ———

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function fail(error, status = 400, extra = {}) {
  return respond({ ok: false, error, ...extra }, status);
}

function matchMember(path, suffix) {
  const m = path.match(new RegExp(`^/api/members/([^/]+)/${suffix}$`));
  return m ? decodeURIComponent(m[1]) : null;
}

async function readJson(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

function storeUnavailable(e) {
  const msg = String((e && e.message) || e);
  return /no such table/i.test(msg);
}

/**
 * Handles the diner taste routes. Returns null for any other path.
 * @param {{ DB: any }} env
 * @param {Request} request
 * @param {string} path
 * @param {URL} url
 * @param {{ writeOrigin: (env: any, householdId: string, request: Request, body: object) => Promise<string> }} deps
 */
export async function routeTasteRequest(env, request, path, url, deps) {
  const method = request.method;
  if (path === "/api/tastes/catalog" && method === "GET") {
    return respond({ ok: true, ...tasteCatalog() });
  }
  if (path === "/api/tastes/search" && method === "GET") {
    return respond({ ok: true, ...searchTastes(url.searchParams.get("q")) });
  }

  const tastesFor = matchMember(path, "tastes");
  const feedbackFor = matchMember(path, "taste-feedback");
  if (!tastesFor && !feedbackFor) return null;
  if (tastesFor && method !== "GET" && method !== "POST") return null;
  if (feedbackFor && method !== "POST") return null;

  const auth = await requireSession(env.DB, request);
  if (auth.error) return auth.error;
  const session = auth.session;
  const memberId = tastesFor || feedbackFor;
  // Each diner owns their profile. Nobody edits, or averages, someone else's.
  if (memberId !== session.member_id) return fail("forbidden_other_diner", 403);

  try {
    if (tastesFor && method === "GET") {
      const profile = await loadTasteProfile(env.DB, session.household_id, memberId);
      return respond({ ok: true, profile });
    }
    const body = await readJson(request);
    if (body === null) return fail("invalid_json");
    if (body.household_id && body.household_id !== session.household_id) {
      return fail("forbidden_cross_household", 403);
    }
    const origin = await deps.writeOrigin(env, session.household_id, request, body);

    if (tastesFor) {
      const changes = Array.isArray(body.changes) ? body.changes : body.rank ? [body] : [];
      if (!changes.length) return fail("changes_required");
      if (changes.length > MAX_CHANGES) return fail("too_many_changes");
      const out = await applyTasteChanges(env.DB, {
        householdId: session.household_id,
        memberId,
        changes,
        dataOrigin: origin,
      });
      const profile = await loadTasteProfile(env.DB, session.household_id, memberId);
      const okAny = out.results.some((r) => r.ok);
      return respond({ ok: okAny, results: out.results, profile }, okAny ? 200 : 400);
    }

    if (!TARGETED_FEEDBACK[body.code]) return fail("unknown_feedback");
    if (!body.meal_option_id && !body.recipe_version_id) return fail("recipe_version_required");
    const saved = await saveTargetedFeedback(env.DB, {
      householdId: session.household_id,
      memberId,
      mealOptionId: body.meal_option_id || null,
      recipeVersionId: body.recipe_version_id || null,
      code: body.code,
      dataOrigin: origin,
    });
    if (!saved.ok) return fail(saved.error, saved.error === "meal_option_not_found" ? 404 : 400);
    return respond({ ok: true, feedback: saved.feedback }, 201);
  } catch (e) {
    if (storeUnavailable(e)) return fail("taste_store_unavailable", 503);
    throw e;
  }
}
