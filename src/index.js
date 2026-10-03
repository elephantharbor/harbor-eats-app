/**
 * Harbor Eats consumer API (Workers + D1) — MVO write/read paths.
 * Ratings: 1–10 per diner; CML when every active member rated. No invented metrics.
 * Auth: HttpOnly session cookie; household scope enforced server-side (Phase 2).
 */

import { constraintRowsFromKeys, filterEligibleOptions } from "./lib/eligibility.js";
import { deriveHouseholdState, previousCompletedMeal } from "./lib/household-state.js";
import {
  createMemberSession,
  loadHouseholdActivity,
  loadPlanBundle,
  readSessionToken,
  resolveSession,
} from "./lib/session.js";
import { sessionClearCookieHeader } from "./lib/cookies.js";
import {
  requireSession,
  assertMemberInSessionHousehold,
  assertPlanInHousehold,
  countActiveMembers,
  validateInviteForHousehold,
} from "./lib/auth.js";
import { createRecoveryToken, consumeRecoveryToken } from "./lib/recovery.js";
import { deliverRecoveryLink } from "./lib/mail.js";
import { joinHouseholdViaInvite } from "./lib/invite-join.js";
import {
  mergeSettingsPatch,
  parseHouseholdSettings,
} from "./lib/household-settings.js";
import {
  loadMealHistory,
  loadRecommendationContext,
  rankMealsForHousehold,
  scoredToPlanOptions,
} from "./lib/recommendations.js";
import { buildTasteProfile } from "./lib/taste-model.js";
import {
  getConceptBySlug,
  getRecipeVersion,
  catalogCoverageMetrics,
} from "./lib/recipe-store.js";
import { scaleRecipeVersion } from "./lib/recipe-scaling.js";
import { resolveMealSelection, membersWithoutVote } from "./lib/selection-resolution.js";
import { runAllCatalogQualityChecks } from "./lib/catalog-quality.js";
import {
  originFromRequest,
  sqlRealHousehold,
  sqlRealRow,
  SYNTHETIC_ORIGIN,
} from "./lib/evidence-origin.js";
import { mergeCanonicalAttributes, projectMealOption, projectMealOptions } from "./lib/meal-option-view.js";
import {
  canonicalRecipeVersion,
  cookGuard,
  ratingGuard,
  selectionGuard,
  statusAfterCook,
  statusAfterSelection,
} from "./lib/meal-identity.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-HE-Session, X-FlavorWeave-Data-Origin",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS,
      ...extraHeaders,
    },
  });
}

function err(message, status = 400, extra = {}) {
  return json({ ok: false, error: message, ...extra }, status);
}

function nowIso() {
  return new Date().toISOString();
}


function productOrigin(requestUrl) {
  // Prefer request host (pages.dev or workers.dev); canonical product is pages.dev.
  try {
    if (requestUrl && requestUrl.origin) {
      const host = requestUrl.hostname || "";
      if (host.endsWith(".pages.dev") || host.endsWith(".workers.dev") || host.endsWith("elephantharbor.com")) {
        return requestUrl.origin;
      }
    }
  } catch { /* fall through */ }
  return "https://harbor-eats-app.pages.dev";
}


function id(prefix) {
  const u = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}_${u}`;
}

async function readBody(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function matchPath(pathname, pattern) {
  const pp = pathname.replace(/\/+$/, "") || "/";
  const parts = pp.split("/");
  const segs = pattern.split("/");
  if (parts.length !== segs.length) return null;
  const params = {};
  for (let i = 0; i < segs.length; i++) {
    if (segs[i].startsWith(":")) params[segs[i].slice(1)] = decodeURIComponent(parts[i]);
    else if (segs[i] !== parts[i]) return null;
  }
  return params;
}

async function handleHealth(env, url) {
  let d1 = "unbound";
  let recent_errors = null;
  /** @type {Record<string, unknown>|null} */
  let alpha_metrics = null;
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
      d1 = "ok";
      try {
        const since = new Date(Date.now() - 86400000).toISOString();
        const row = await env.DB.prepare(
          `SELECT COUNT(*) AS c FROM client_error WHERE created_at >= ?`
        )
          .bind(since)
          .first();
        recent_errors = row ? row.c : 0;
      } catch {
        recent_errors = null;
      }
      if (url && url.searchParams.get("metrics") === "alpha") {
        alpha_metrics = await loadAlphaOpsMetrics(env.DB);
      }
    } catch {
      d1 = "error";
    }
  }
  const catalog = runAllCatalogQualityChecks();
  return json({
    ok: true,
    app: env.APP_NAME || "harbor-eats-app",
    environment: env.ENVIRONMENT || "dev",
    d1,
    client_errors_24h: recent_errors,
    catalog_quality_ok: catalog.ok,
    catalog_coverage: catalogCoverageMetrics(),
    alpha_metrics,
    ts: nowIso(),
  });
}

async function loadAlphaOpsMetrics(db) {
  const q = async (sql) => {
    const row = await db.prepare(sql).first();
    return row ? row.c : 0;
  };
  const hh = sqlRealHousehold("h");
  return {
    households: await q(`SELECT COUNT(*) AS c FROM household h WHERE ${hh}`),
    active_members: await q(
      `SELECT COUNT(*) AS c FROM member m
       JOIN household h ON h.household_id = m.household_id
       WHERE m.status = 'active' AND ${hh}`
    ),
    plans: await q(
      `SELECT COUNT(*) AS c FROM plan p
       JOIN household h ON h.household_id = p.household_id
       WHERE ${sqlRealRow("p")} AND ${hh}`
    ),
    selections: await q(
      `SELECT COUNT(*) AS c FROM selection s
       JOIN household h ON h.household_id = s.household_id
       WHERE ${sqlRealRow("s")} AND ${hh}`
    ),
    cooks: await q(
      `SELECT COUNT(*) AS c FROM cook c
       JOIN household h ON h.household_id = c.household_id
       WHERE ${sqlRealRow("c")} AND ${hh}`
    ),
    ratings: await q(
      `SELECT COUNT(*) AS c FROM rating r
       JOIN household h ON h.household_id = r.household_id
       WHERE ${sqlRealRow("r")} AND ${hh}`
    ),
    completed_meal_loops: await q(
      `SELECT COUNT(*) AS c FROM plan p
       JOIN household h ON h.household_id = p.household_id
       WHERE p.status = 'Rated' AND ${sqlRealRow("p")} AND ${hh}`
    ),
    invites_sent: await q(
      `SELECT COUNT(*) AS c FROM event e
       JOIN household h ON h.household_id = e.household_id
       WHERE e.event_name = 'invite_sent' AND ${sqlRealRow("e")} AND ${hh}`
    ),
    invites_accepted: await q(
      `SELECT COUNT(*) AS c FROM event e
       JOIN household h ON h.household_id = e.household_id
       WHERE e.event_name = 'invite_accepted' AND ${sqlRealRow("e")} AND ${hh}`
    ),
    plan_generated: await q(
      `SELECT COUNT(*) AS c FROM event e
       JOIN household h ON h.household_id = e.household_id
       WHERE e.event_name = 'plan_generated' AND ${sqlRealRow("e")} AND ${hh}`
    ),
    recommendation_failures: await q(
      `SELECT COUNT(*) AS c FROM event e
       JOIN household h ON h.household_id = e.household_id
       WHERE e.event_name = 'recommendation_failed' AND ${sqlRealRow("e")} AND ${hh}`
    ),
  };
}

async function markSynthetic(env, table, idColumn, rowId) {
  await env.DB.prepare(`UPDATE ${table} SET data_origin = 'synthetic' WHERE ${idColumn} = ?`)
    .bind(rowId)
    .run();
}

async function createHousehold(env, body, request) {
  const display_name = (body.display_name || body.name || "").trim();
  if (!display_name) return err("display_name_required");
  const household_id = body.household_id || id("hh");
  const ts = nowIso();
  const status = body.status || "incubation_pilot";
  const timezone = body.timezone || "America/Chicago";
  const servings_default = Number.isFinite(body.servings_default)
    ? body.servings_default
    : 2;
  const origin = originFromRequest(request, body);
  const acquisition_source =
    origin === SYNTHETIC_ORIGIN ? "synthetic_qa" : body.acquisition_source || null;
  try {
    await env.DB.prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        household_id,
        display_name,
        status,
        timezone,
        servings_default,
        acquisition_source,
        ts,
        ts,
        origin
      )
      .run();
  } catch (e) {
    return err("household_create_failed", 500, { detail: String(e.message || e) });
  }
  return json({ ok: true, household_id, display_name, status, created_at: ts, data_origin: origin }, 201);
}

async function addMember(env, household_id, body, request) {
  const hh = await env.DB.prepare(
    "SELECT household_id FROM household WHERE household_id = ?"
  )
    .bind(household_id)
    .first();
  if (!hh) return err("household_not_found", 404);

  const auth = await requireSession(env.DB, request);
  if (auth.error) {
    const active = await countActiveMembers(env.DB, household_id);
    const invite_code = body.invite_code || null;
    if (invite_code) {
      const invErr = await validateInviteForHousehold(env.DB, invite_code, household_id);
      if (invErr) return err(invErr, invErr === "invite_expired" ? 410 : 403);
    } else if (active > 0) {
      return auth.error;
    }
  } else if (auth.session.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }

  const display_name = (body.display_name || body.name || "").trim();
  if (!display_name) return err("display_name_required");
  const member_id =
    body.member_id ||
    display_name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "") ||
    id("m");
  const ts = nowIso();
  const role = body.role || "member";
  const status = body.status || "active";
  try {
    await env.DB.prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, invite_code, inviter_member_id,
         invite_channel, invited_at, accepted_at, inherits_household_eligibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        member_id,
        household_id,
        display_name,
        role,
        status,
        body.invite_code || null,
        body.inviter_member_id || null,
        body.invite_channel || null,
        body.invited_at || (status === "invited" ? ts : null),
        body.accepted_at || (status === "active" ? ts : null),
        body.inherits_household_eligibility === 0 ? 0 : 1,
        ts,
        ts
      )
      .run();
  } catch (e) {
    return err("member_create_failed", 500, { detail: String(e.message || e) });
  }
  return json({ ok: true, member_id, household_id, display_name, role, status }, 201);
}

async function setConstraints(env, member_id, body, session) {
  const memberErr = await assertMemberInSessionHousehold(env.DB, member_id, session);
  if (memberErr) return err(memberErr, 403);

  const member = await env.DB.prepare(
    "SELECT member_id, household_id FROM member WHERE member_id = ?"
  )
    .bind(member_id)
    .first();
  if (!member) return err("member_not_found", 404);

  const household_id = session.household_id;
  let rules = Array.isArray(body.constraints)
    ? body.constraints.slice()
    : Array.isArray(body.rules)
      ? body.rules.slice()
      : [];
  if (rules.length === 0) {
    // Accept { rule_key, status } single or { keys: ["dairy", ...] }
    if (body.rule_key) {
      rules.push({
        rule_key: body.rule_key,
        status: body.status || "prohibited",
        includes_json: body.includes_json,
        note: body.note,
      });
    } else if (Array.isArray(body.keys)) {
      rules.push(...constraintRowsFromKeys(body.keys));
    }
  }
  // replace: the submitted list is this diner's full set, so an unticked limit is removed.
  const replace = body.replace === true;
  if (rules.length === 0 && !replace) return err("constraints_required");

  const ts = nowIso();
  const saved = [];
  try {
    for (const r of rules) {
      const rule_key = (r.rule_key || r.id || "").trim();
      if (!rule_key || rule_key === "none") continue;
      const status = r.status || "prohibited";
      if (status !== "prohibited" && status !== "permitted") {
        return err("invalid_constraint_status", 400, { rule_key });
      }
      const constraint_id = r.constraint_id || id("cr");
      await env.DB.prepare(
        `INSERT INTO constraint_rule
          (constraint_id, household_id, member_id, rule_key, status, includes_json, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(household_id, member_id, rule_key) DO UPDATE SET
           status = excluded.status,
           includes_json = excluded.includes_json,
           note = excluded.note,
           updated_at = excluded.updated_at`
      )
        .bind(
          constraint_id,
          household_id,
          member_id,
          rule_key,
          status,
          r.includes_json
            ? typeof r.includes_json === "string"
              ? r.includes_json
              : JSON.stringify(r.includes_json)
            : null,
          r.note || null,
          ts,
          ts
        )
        .run();
      saved.push({ rule_key, status });
    }
    if (replace) {
      const keep = saved.map((s) => s.rule_key);
      const placeholders = keep.map(() => "?").join(",");
      await env.DB.prepare(
        `DELETE FROM constraint_rule WHERE household_id = ? AND member_id = ?${
          keep.length ? ` AND rule_key NOT IN (${placeholders})` : ""
        }`
      )
        .bind(household_id, member_id, ...keep)
        .run();
    }
  } catch (e) {
    return err("constraints_save_failed", 500, { detail: String(e.message || e) });
  }
  return json({ ok: true, member_id, household_id, constraints: saved, replaced: replace });
}

async function createPlan(env, body, session) {
  const household_id = session.household_id;
  if (body.household_id && body.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }
  const hh = await env.DB.prepare(
    "SELECT household_id FROM household WHERE household_id = ?"
  )
    .bind(household_id)
    .first();
  if (!hh) return err("household_not_found", 404);

  const plan_id = body.plan_id || id("plan");
  const ts = nowIso();
  const options = Array.isArray(body.meal_options) && body.meal_options.length
    ? body.meal_options
    : [
        { letter: "A", name: body.option_a_name || "Option A" },
        { letter: "B", name: body.option_b_name || "Option B" },
        { letter: "C", name: body.option_c_name || "Option C" },
      ];
  if (options.length < 3 || options.length > 5) return err("meal_options_count_3_to_5");

  try {
    await env.DB.prepare(
      `INSERT INTO plan
        (plan_id, household_id, batch_id, status, created_at, updated_at, attribution_last_touch, attribution_kind)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        plan_id,
        household_id,
        body.batch_id || null,
        body.status || "Generated",
        ts,
        ts,
        body.attribution_last_touch || null,
        body.attribution_kind || null
      )
      .run();

    const createdOptions = [];
    for (const opt of options) {
      const letter = opt.letter;
      if (!["A", "B", "C", "D", "E"].includes(letter)) return err("invalid_letter", 400, { letter });
      const meal_option_id = opt.meal_option_id || `${plan_id}-${letter}`;
      await env.DB.prepare(
        `INSERT INTO meal_option
          (meal_option_id, plan_id, letter, name, recipe_slug, recipe_version, description_short, attributes_json, selected, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
      )
        .bind(
          meal_option_id,
          plan_id,
          letter,
          opt.name || `Option ${letter}`,
          opt.recipe_slug || null,
          opt.recipe_version || null,
          opt.description_short || null,
          opt.attributes_json
            ? typeof opt.attributes_json === "string"
              ? opt.attributes_json
              : JSON.stringify(opt.attributes_json)
            : null,
          ts
        )
        .run();
      createdOptions.push({ meal_option_id, letter, name: opt.name || `Option ${letter}` });
    }
    return json({ ok: true, plan_id, household_id, meal_options: createdOptions }, 201);
  } catch (e) {
    return err("plan_create_failed", 500, { detail: String(e.message || e) });
  }
}

async function createSelection(env, body, session, request) {
  const { plan_id, meal_option_id } = body;
  const household_id = session.household_id;
  if (!plan_id || !meal_option_id) {
    return err("plan_id_and_meal_option_id_required");
  }
  if (body.household_id && body.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }
  const planErr = await assertPlanInHousehold(env.DB, plan_id, session);
  if (planErr) return err(planErr, 403);
  const bundle = await loadPlanBundle(env.DB, plan_id);
  if (!bundle) return err("plan_not_found", 404);
  const origin = originFromRequest(request, body);
  const selection_id = body.selection_id || id("sel");
  const ts = nowIso();
  const source = body.source || "app";
  if (origin !== SYNTHETIC_ORIGIN) {
    const guard = selectionGuard(bundle, meal_option_id);
    if (!guard.ok) {
      return err(guard.error, guard.status || 409, { meal_option_id: guard.meal_option_id });
    }
    if (guard.unchanged) {
      return json({
        ok: true,
        plan_id,
        meal_option_id,
        status: bundle.plan.status,
        unchanged: true,
      });
    }
  }
  const nextStatus =
    origin === SYNTHETIC_ORIGIN
      ? bundle.plan.status
      : statusAfterSelection(bundle.plan.status, { locked: false });
  try {
    await env.DB.prepare(
      `INSERT INTO selection
        (selection_id, plan_id, meal_option_id, household_id, source, actor_member_id, share_object_id, created_at, data_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        selection_id,
        plan_id,
        meal_option_id,
        household_id,
        source,
        body.actor_member_id || session.member_id,
        body.share_object_id || null,
        ts,
        origin
      )
      .run();
    if (origin === SYNTHETIC_ORIGIN) {
      return json(
        { ok: true, selection_id, plan_id, meal_option_id, status: bundle.plan.status, synthetic: true },
        201
      );
    }
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE meal_option SET selected = CASE WHEN meal_option_id = ? THEN 1 ELSE 0 END WHERE plan_id = ?`
      ).bind(meal_option_id, plan_id),
      env.DB.prepare(`UPDATE plan SET status = ?, updated_at = ? WHERE plan_id = ?`).bind(
        nextStatus,
        ts,
        plan_id
      ),
    ]);
  } catch (e) {
    return err("selection_failed", 500, { detail: String(e.message || e) });
  }
  return json({ ok: true, selection_id, plan_id, meal_option_id, status: nextStatus }, 201);
}

async function createCook(env, body, session, request) {
  const { plan_id, meal_option_id } = body;
  const household_id = session.household_id;
  if (!plan_id || !meal_option_id) {
    return err("plan_id_and_meal_option_id_required");
  }
  if (body.household_id && body.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }
  const planErr = await assertPlanInHousehold(env.DB, plan_id, session);
  if (planErr) return err(planErr, 403);
  const bundle = await loadPlanBundle(env.DB, plan_id);
  if (!bundle) return err("plan_not_found", 404);
  const origin = originFromRequest(request, body);
  const cook_id = body.cook_id || id("cook");
  const ts = nowIso();
  const cooked_at = body.cooked_at || ts;
  const source = body.source || "app";
  if (origin !== SYNTHETIC_ORIGIN) {
    const guard = cookGuard(bundle, meal_option_id);
    if (!guard.ok) {
      return err(guard.error, guard.status || 409, { meal_option_id: guard.meal_option_id });
    }
    if (guard.idempotent) {
      return json({
        ok: true,
        cook_id: guard.cook_id,
        plan_id,
        meal_option_id,
        status: bundle.plan.status,
        unchanged: true,
      });
    }
  }
  try {
    await env.DB.prepare(
      `INSERT INTO cook
        (cook_id, plan_id, meal_option_id, household_id, source, actor_member_id, cooked_at, created_at, data_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        cook_id,
        plan_id,
        meal_option_id,
        household_id,
        source,
        body.actor_member_id || session.member_id,
        cooked_at,
        ts,
        origin
      )
      .run();
    if (origin === SYNTHETIC_ORIGIN) {
      return json(
        { ok: true, cook_id, plan_id, meal_option_id, status: bundle.plan.status, synthetic: true },
        201
      );
    }
    const nextStatus = statusAfterCook(bundle.plan.status);
    await env.DB.prepare(`UPDATE plan SET status = ?, updated_at = ? WHERE plan_id = ?`)
      .bind(nextStatus, ts, plan_id)
      .run();
    return json({ ok: true, cook_id, plan_id, meal_option_id, status: nextStatus }, 201);
  } catch (e) {
    return err("cook_failed", 500, { detail: String(e.message || e) });
  }
}

async function createRating(env, body, session, request) {
  const { plan_id, meal_option_id } = body;
  const household_id = session.household_id;
  const member_id = session.member_id;
  const score = Number(body.score);
  if (!plan_id || !meal_option_id) {
    return err("plan_id_and_meal_option_id_required");
  }
  if (body.household_id && body.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }
  if (body.member_id && body.member_id !== member_id) {
    return err("forbidden_member", 403);
  }
  const planErr = await assertPlanInHousehold(env.DB, plan_id, session);
  if (planErr) return err(planErr, 403);
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    return err("score_must_be_integer_1_to_10", 400, { score: body.score });
  }
  const bundle = await loadPlanBundle(env.DB, plan_id);
  if (!bundle) return err("plan_not_found", 404);
  const origin = originFromRequest(request, body);
  if (origin !== SYNTHETIC_ORIGIN) {
    const guard = ratingGuard(bundle, meal_option_id);
    if (!guard.ok) {
      return err(guard.error, guard.status || 409, { meal_option_id: guard.meal_option_id });
    }
  }
  const rating_id = body.rating_id || id("rate");
  const ts = nowIso();
  const source = body.source || "app";
  const moRow = await env.DB.prepare(
    `SELECT recipe_slug, recipe_version FROM meal_option WHERE meal_option_id = ?`
  )
    .bind(meal_option_id)
    .first();
  const existingReal = (bundle.ratings || []).find(
    (row) =>
      row.meal_option_id === meal_option_id &&
      row.member_id === member_id &&
      row.data_origin !== SYNTHETIC_ORIGIN
  );
  const recipe_version_id = canonicalRecipeVersion(
    moRow,
    body.recipe_version_id,
    existingReal && existingReal.recipe_version_id
  );
  if (origin === SYNTHETIC_ORIGIN && existingReal) {
    return json({
      ok: true,
      synthetic: true,
      unchanged: true,
      skipped: "real_rating_preserved",
      plan_status: bundle.plan.status,
      cml_complete: false,
      recipe_version_id: existingReal.recipe_version_id || recipe_version_id,
    });
  }
  try {
    await env.DB.prepare(
      `INSERT INTO rating
        (rating_id, plan_id, meal_option_id, household_id, member_id, score, note, source, created_at, updated_at, recipe_version_id, data_origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(meal_option_id, member_id) DO UPDATE SET
         score = excluded.score,
         note = excluded.note,
         source = excluded.source,
         updated_at = excluded.updated_at,
         recipe_version_id = COALESCE(rating.recipe_version_id, excluded.recipe_version_id),
         data_origin = excluded.data_origin`
    )
      .bind(
        rating_id,
        plan_id,
        meal_option_id,
        household_id,
        member_id,
        score,
        body.note || null,
        source,
        ts,
        ts,
        recipe_version_id,
        origin
      )
      .run();
    if (origin === SYNTHETIC_ORIGIN) {
      return json({
        ok: true,
        rating_id,
        member_id,
        score,
        plan_status: bundle.plan.status,
        cml_complete: false,
        synthetic: true,
        recipe_version_id,
      });
    }

    // Mark Rated only when every active member has a real rating for this meal_option
    const active = await env.DB.prepare(
      `SELECT member_id FROM member WHERE household_id = ? AND status = 'active'`
    )
      .bind(household_id)
      .all();
    const activeIds = (active.results || []).map((r) => r.member_id);
    let bothPresent = false;
    let planStatus = bundle.plan.status === "Rated" ? "Rated" : "Cooked";
    if (activeIds.length > 0) {
      const rated = await env.DB.prepare(
        `SELECT member_id FROM rating WHERE meal_option_id = ? AND data_origin = 'household'`
      )
        .bind(meal_option_id)
        .all();
      const ratedSet = new Set((rated.results || []).map((r) => r.member_id));
      bothPresent = activeIds.every((mid) => ratedSet.has(mid));
      if (bothPresent) {
        planStatus = "Rated";
        await env.DB.prepare(
          `UPDATE plan SET status = 'Rated', updated_at = ?,
             attribution_last_touch = COALESCE(?, attribution_last_touch),
             attribution_kind = COALESCE(?, attribution_kind)
           WHERE plan_id = ?`
        )
          .bind(
            ts,
            body.attribution_last_touch || null,
            body.attribution_kind || null,
            plan_id
          )
          .run();
      }
    }
    return json({
      ok: true,
      rating_id,
      member_id,
      score,
      plan_status: planStatus,
      cml_complete: bothPresent,
      recipe_version_id,
    });
  } catch (e) {
    return err("rating_failed", 500, { detail: String(e.message || e) });
  }
}

async function createEvent(env, body, session, request) {
  const event_name = body.event_name || body.event;
  if (!event_name) return err("event_name_required");
  if (body.household_id && body.household_id !== session.household_id) {
    return err("forbidden_cross_household", 403);
  }
  if (body.member_id && body.member_id !== session.member_id) {
    const memberErr = await assertMemberInSessionHousehold(env.DB, body.member_id, session);
    if (memberErr) return err(memberErr, 403);
  }
  // Allow known + HE-INV / HE-SHARE related; do not invent metrics — just store what client sends
  const event_id = body.event_id || id("evt");
  const ts = body.created_at || nowIso();
  let invite_code = body.invite_code || null;
  let share_object_id = body.share_object_id || null;
  // Normalize HE-INV / HE-SHARE prefixes if present in attribution
  if (!invite_code && typeof body.attribution_last_touch === "string" && body.attribution_last_touch.startsWith("HE-INV")) {
    invite_code = body.attribution_last_touch;
  }
  if (!share_object_id && typeof body.attribution_last_touch === "string" && body.attribution_last_touch.startsWith("HE-SHARE")) {
    share_object_id = body.attribution_last_touch;
  }
  const props = { ...body };
  delete props.event_name;
  delete props.event;
  delete props.event_id;
  delete props.household_id;
  delete props.member_id;
  delete props.plan_id;
  delete props.meal_option_id;
  delete props.invite_code;
  delete props.share_object_id;
  delete props.channel;
  delete props.attribution_last_touch;
  delete props.created_at;
  try {
    await env.DB.prepare(
      `INSERT INTO event
        (event_id, event_name, household_id, member_id, plan_id, meal_option_id,
         invite_code, share_object_id, channel, attribution_last_touch, props_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        event_id,
        event_name,
        session.household_id,
        body.member_id || session.member_id,
        body.plan_id || null,
        body.meal_option_id || null,
        invite_code,
        share_object_id,
        body.channel || null,
        body.attribution_last_touch || null,
        Object.keys(props).length ? JSON.stringify(props) : null,
        ts
      )
      .run();

    // When loop_completed, stamp plan last-touch if provided
    if (event_name === "loop_completed" && body.plan_id && body.attribution_last_touch) {
      let kind = "unknown";
      const lt = body.attribution_last_touch;
      if (lt.startsWith("HE-INV")) kind = "invite_code";
      else if (lt.startsWith("HE-SHARE")) kind = "share_object_id";
      else if (lt === "organic") kind = "organic";
      await env.DB.prepare(
        `UPDATE plan SET attribution_last_touch = ?, attribution_kind = ?, updated_at = ? WHERE plan_id = ?`
      )
        .bind(lt, kind, ts, body.plan_id)
        .run();
    }
  } catch (e) {
    return err("event_failed", 500, { detail: String(e.message || e) });
  }
  if (originFromRequest(request, body) === SYNTHETIC_ORIGIN) {
    await markSynthetic(env, "event", "event_id", event_id);
  }
  return json({ ok: true, event_id, event_name }, 201);
}


function makeHeToken(prefix) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  if (prefix === "HE-SHARE") return `HE-SHARE-${body.toLowerCase()}`;
  return `HE-INV-${body}`;
}

function parseOptionsSnapshot(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function ensurePlanWithOptions(env, household_id, plan_id, options, attribution) {
  const existing = await env.DB.prepare("SELECT plan_id FROM plan WHERE plan_id = ?")
    .bind(plan_id)
    .first();
  const ts = nowIso();
  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO plan
        (plan_id, household_id, batch_id, status, created_at, updated_at, attribution_last_touch, attribution_kind)
       VALUES (?, ?, NULL, 'Generated', ?, ?, ?, ?)`
    )
      .bind(
        plan_id,
        household_id,
        ts,
        ts,
        attribution?.attribution_last_touch || null,
        attribution?.attribution_kind || null
      )
      .run();
  }
  const created = [];
  for (const opt of options) {
    const letter = opt.letter;
    if (!["A", "B", "C", "D", "E"].includes(letter)) continue;
    const meal_option_id = opt.meal_option_id || `${plan_id}-${letter}`;
    const name = opt.name || opt.title || `Option ${letter}`;
    const incoming = {
      title: opt.title || name,
      chips: opt.chips || null,
      plate: opt.plate || null,
      tone: opt.tone || null,
      pers: opt.pers || null,
      minutes: opt.minutes || null,
      effort: opt.effort || null,
      meal_format: opt.meal_format || null,
      cuisine: opt.cuisine || null,
      recipe_slug: opt.recipe_slug || null,
      recipe_version_id: opt.recipe_version || opt.recipe_version_id || null,
      tags: opt.tags || null,
      score: typeof opt.score === "number" ? opt.score : null,
    };
    const existingOpt = await env.DB.prepare(
      `SELECT meal_option_id, attributes_json, recipe_slug, recipe_version
       FROM meal_option WHERE plan_id = ? AND letter = ?`
    )
      .bind(plan_id, letter)
      .first();
    const merged = mergeCanonicalAttributes(existingOpt && existingOpt.attributes_json, incoming);
    const projected = projectMealOption({
      letter,
      meal_option_id: (existingOpt && existingOpt.meal_option_id) || meal_option_id,
      name,
      recipe_slug: (existingOpt && existingOpt.recipe_slug) || opt.recipe_slug || merged.recipe_slug,
      recipe_version:
        (existingOpt && existingOpt.recipe_version) ||
        opt.recipe_version ||
        opt.recipe_version_id ||
        merged.recipe_version_id,
      attributes_json: merged,
    });
    const stored = {
      ...merged,
      title: projected.title || merged.title,
      chips: projected.chips,
      minutes: projected.minutes,
      effort: projected.effort,
      meal_format: projected.meal_format,
      cuisine: projected.cuisine,
      recipe_slug: projected.recipe_slug,
      recipe_version_id: projected.recipe_version_id,
      pers: merged.pers || null,
    };
    if (existingOpt) {
      await env.DB.prepare(
        `UPDATE meal_option
         SET name = ?, attributes_json = ?,
             recipe_slug = COALESCE(recipe_slug, ?),
             recipe_version = COALESCE(recipe_version, ?)
         WHERE plan_id = ? AND letter = ?`
      )
        .bind(
          name,
          JSON.stringify(stored),
          projected.recipe_slug,
          projected.recipe_version_id,
          plan_id,
          letter
        )
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO meal_option
          (meal_option_id, plan_id, letter, name, recipe_slug, recipe_version, description_short, attributes_json, selected, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
      )
        .bind(
          meal_option_id,
          plan_id,
          letter,
          name,
          projected.recipe_slug,
          projected.recipe_version_id,
          opt.description_short || null,
          JSON.stringify(stored),
          ts
        )
        .run();
    }
    created.push(projected);
  }
  return created;
}

async function createShare(env, body, requestUrl, session) {
  const household_id = session.household_id;
  if (body.household_id && body.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }
  const hh = await env.DB.prepare(
    "SELECT household_id FROM household WHERE household_id = ?"
  )
    .bind(household_id)
    .first();
  if (!hh) return err("household_not_found", 404);

  let options = parseOptionsSnapshot(body.options || body.meal_options || body.options_snapshot);
  if (!options || options.length === 0) {
    // Fall back to existing plan meal_options
    if (body.plan_id) {
      const rows = await env.DB.prepare(
        `SELECT meal_option_id, letter, name, attributes_json FROM meal_option WHERE plan_id = ? ORDER BY letter`
      )
        .bind(body.plan_id)
        .all();
      options = (rows.results || []).map((r) => {
        let attrs = {};
        try {
          attrs = r.attributes_json ? JSON.parse(r.attributes_json) : {};
        } catch {
          attrs = {};
        }
        return {
          meal_option_id: r.meal_option_id,
          letter: r.letter,
          name: r.name,
          title: attrs.title || r.name,
          chips: attrs.chips || null,
          plate: attrs.plate || null,
          tone: attrs.tone || null,
          pers: attrs.pers || null,
        };
      });
    }
  }
  if (!options || options.length === 0) return err("options_required");

  const plan_id = body.plan_id || id("plan");
  let snapshotOptions;
  try {
    snapshotOptions = await ensurePlanWithOptions(env, household_id, plan_id, options, {
      attribution_last_touch: body.attribution_last_touch || null,
      attribution_kind: body.attribution_kind || "share_object_id",
    });
  } catch (e) {
    return err("plan_ensure_failed", 500, { detail: String(e.message || e) });
  }

  const token =
    (typeof body.token === "string" && body.token.startsWith("HE-SHARE") && body.token) ||
    (typeof body.share_object_id === "string" &&
      body.share_object_id.startsWith("HE-SHARE") &&
      body.share_object_id) ||
    makeHeToken("HE-SHARE");
  const share_object_id = body.share_object_id && !String(body.share_object_id).startsWith("HE-SHARE")
    ? body.share_object_id
    : token;
  const ts = nowIso();
  const option_letters = snapshotOptions.map((o) => o.letter).join(",") || "A,B,C";
  const channel = body.channel || null;
  const expires_at = body.expires_at || null;
  const snapshot_json = JSON.stringify(snapshotOptions);

  try {
    await env.DB.prepare(
      `INSERT INTO share_choice
        (share_object_id, plan_id, household_id, created_by_member_id, token, option_letters,
         status, referrer_household_id, expires_at, created_at, options_snapshot_json, channel)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
       ON CONFLICT(share_object_id) DO UPDATE SET
         options_snapshot_json = excluded.options_snapshot_json,
         channel = excluded.channel,
         status = 'active'`
    )
      .bind(
        share_object_id,
        plan_id,
        household_id,
        body.created_by_member_id || session.member_id,
        token,
        option_letters,
        body.referrer_household_id || null,
        expires_at,
        ts,
        snapshot_json,
        channel
      )
      .run();
  } catch (e) {
    // token unique conflict — retry once with fresh token if client didn't pin one
    if (String(e.message || e).includes("UNIQUE") && !body.token && !body.share_object_id) {
      return err("share_token_collision", 409, { detail: String(e.message || e) });
    }
    return err("share_create_failed", 500, { detail: String(e.message || e) });
  }

  // Analytics event (server-side mirror; client also fires share_choice_created)
  try {
    await env.DB.prepare(
      `INSERT INTO event
        (event_id, event_name, household_id, member_id, plan_id, meal_option_id,
         invite_code, share_object_id, channel, attribution_last_touch, props_json, created_at)
       VALUES (?, 'share_choice_created', ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`
    )
      .bind(
        id("evt"),
        household_id,
        body.created_by_member_id || session.member_id,
        plan_id,
        share_object_id,
        channel,
        token,
        JSON.stringify({ token, option_letters }),
        ts
      )
      .run();
  } catch {
    /* non-fatal */
  }

  const origin = productOrigin(requestUrl);
  const share_url = `${origin}/share/${encodeURIComponent(token)}`;
  return json(
    {
      ok: true,
      share_object_id,
      token,
      plan_id,
      household_id,
      options: snapshotOptions,
      share_url,
      created_at: ts,
      expires_at,
      channel,
    },
    201
  );
}

async function resolveShare(env, token) {
  if (!token || !String(token).startsWith("HE-SHARE")) {
    return err("invalid_share_token", 400);
  }
  const row = await env.DB.prepare(
    `SELECT share_object_id, plan_id, household_id, token, option_letters, status,
            expires_at, created_at, options_snapshot_json, channel, created_by_member_id
     FROM share_choice WHERE token = ? OR share_object_id = ?`
  )
    .bind(token, token)
    .first();
  if (!row) return err("share_not_found", 404);

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return err("share_expired", 410, { token: row.token });
  }
  if (row.status === "revoked" || row.status === "expired") {
    return err("share_inactive", 410, { status: row.status, token: row.token });
  }

  const live = await env.DB.prepare(
    `SELECT meal_option_id, letter, name, recipe_slug, recipe_version, attributes_json
     FROM meal_option WHERE plan_id = ? ORDER BY letter`
  )
    .bind(row.plan_id)
    .all();
  let options = projectMealOptions(live.results || []);
  if (!options.length) {
    options = projectMealOptions(parseOptionsSnapshot(row.options_snapshot_json) || []);
  }

  // share_choice_viewed (server-side; client also fires)
  try {
    await env.DB.prepare(
      `INSERT INTO event
        (event_id, event_name, household_id, member_id, plan_id, meal_option_id,
         invite_code, share_object_id, channel, attribution_last_touch, props_json, created_at)
       VALUES (?, 'share_choice_viewed', ?, NULL, ?, NULL, NULL, ?, ?, ?, NULL, ?)`
    )
      .bind(
        id("evt"),
        row.household_id,
        row.plan_id,
        row.share_object_id,
        row.channel || null,
        row.token,
        nowIso()
      )
      .run();
  } catch {
    /* non-fatal */
  }

  return json({
    ok: true,
    share_object_id: row.share_object_id,
    token: row.token,
    plan_id: row.plan_id,
    household_id: row.household_id,
    options,
    status: row.status,
    channel: row.channel,
    created_at: row.created_at,
    expires_at: row.expires_at,
  });
}

async function createInvite(env, body, requestUrl, session) {
  const household_id = session.household_id;
  if (body.household_id && body.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }
  const hh = await env.DB.prepare(
    "SELECT household_id, display_name FROM household WHERE household_id = ?"
  )
    .bind(household_id)
    .first();
  if (!hh) return err("household_not_found", 404);

  let inviter_member_id = body.inviter_member_id || session.member_id;
  if (body.inviter_member_id && body.inviter_member_id !== session.member_id) {
    const memberErr = await assertMemberInSessionHousehold(
      env.DB,
      body.inviter_member_id,
      session
    );
    if (memberErr) return err(memberErr, 403);
    inviter_member_id = body.inviter_member_id;
  }

  const inviter = await env.DB.prepare(
    "SELECT member_id FROM member WHERE member_id = ? AND household_id = ?"
  )
    .bind(inviter_member_id, household_id)
    .first();
  if (!inviter) return err("inviter_not_found", 404);

  const channel = body.channel || "copy";
  const allowed = new Set(["share_sheet", "copy", "email", "sms", "other"]);
  if (!allowed.has(channel)) return err("invalid_channel", 400, { channel });

  const invite_code =
    (typeof body.invite_code === "string" && body.invite_code.startsWith("HE-INV") && body.invite_code) ||
    makeHeToken("HE-INV");
  const ts = nowIso();
  const expires_at = body.expires_at || null;

  try {
    await env.DB.prepare(
      `INSERT INTO invite
        (invite_code, household_id, inviter_member_id, channel, status, invited_member_id, sent_at, accepted_at, expires_at)
       VALUES (?, ?, ?, ?, 'sent', NULL, ?, NULL, ?)
       ON CONFLICT(invite_code) DO UPDATE SET
         channel = excluded.channel,
         status = 'sent',
         sent_at = excluded.sent_at`
    )
      .bind(invite_code, household_id, inviter_member_id, channel, ts, expires_at)
      .run();
  } catch (e) {
    return err("invite_create_failed", 500, { detail: String(e.message || e) });
  }

  try {
    await env.DB.prepare(
      `INSERT INTO event
        (event_id, event_name, household_id, member_id, plan_id, meal_option_id,
         invite_code, share_object_id, channel, attribution_last_touch, props_json, created_at)
       VALUES (?, 'invite_sent', ?, ?, NULL, NULL, ?, NULL, ?, ?, NULL, ?)`
    )
      .bind(
        id("evt"),
        household_id,
        inviter_member_id,
        invite_code,
        channel,
        invite_code,
        ts
      )
      .run();
  } catch {
    /* non-fatal */
  }

  const origin = productOrigin(requestUrl);
  const invite_url = `${origin}/invite/${encodeURIComponent(invite_code)}`;
  return json(
    {
      ok: true,
      invite_code,
      household_id,
      household_display_name: hh.display_name,
      inviter_member_id,
      channel,
      invite_url,
      sent_at: ts,
      expires_at,
    },
    201
  );
}

async function resolveInvite(env, code) {
  if (!code || !String(code).startsWith("HE-INV")) {
    return err("invalid_invite_code", 400);
  }
  const row = await env.DB.prepare(
    `SELECT invite_code, household_id, inviter_member_id, channel, status, invited_member_id,
            sent_at, accepted_at, expires_at
     FROM invite WHERE invite_code = ?`
  )
    .bind(code)
    .first();
  if (!row) return err("invite_not_found", 404);

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return err("invite_expired", 410, { invite_code: row.invite_code });
  }
  if (row.status === "revoked" || row.status === "expired") {
    return err("invite_inactive", 410, { status: row.status, invite_code: row.invite_code });
  }

  const hh = await env.DB.prepare(
    "SELECT household_id, display_name, status FROM household WHERE household_id = ?"
  )
    .bind(row.household_id)
    .first();

  const inviter = await env.DB.prepare(
    "SELECT member_id, display_name FROM member WHERE member_id = ?"
  )
    .bind(row.inviter_member_id)
    .first();

  return json({
    ok: true,
    invite_code: row.invite_code,
    household_id: row.household_id,
    household_display_name: (hh && hh.display_name) || null,
    household_status: (hh && hh.status) || null,
    inviter_member_id: row.inviter_member_id,
    inviter_display_name: (inviter && inviter.display_name) || null,
    channel: row.channel,
    status: row.status,
    sent_at: row.sent_at,
    accepted_at: row.accepted_at,
    expires_at: row.expires_at,
  });
}

async function getHousehold(env, household_id) {
  const activity = await loadHouseholdActivity(env.DB, household_id);
  if (!activity) return err("household_not_found", 404);
  const hhRow = await env.DB.prepare(
    `SELECT display_name, meal_choice_count, scheduling_cadence, settings_json FROM household WHERE household_id = ?`
  )
    .bind(household_id)
    .first();
  const settings = parseHouseholdSettings(hhRow);
  return json({
    ok: true,
    household: { ...activity.household, ...settings },
    members: activity.members,
    constraints: activity.constraints,
    settings,
  });
}

async function patchHousehold(env, household_id, body, session) {
  if (session.household_id !== household_id) return err("forbidden_cross_household", 403);
  const hhRow = await env.DB.prepare(
    `SELECT display_name, meal_choice_count, scheduling_cadence, settings_json FROM household WHERE household_id = ?`
  )
    .bind(household_id)
    .first();
  if (!hhRow) return err("household_not_found", 404);
  const current = parseHouseholdSettings(hhRow);
  const next = mergeSettingsPatch(current, body);
  const ts = nowIso();
  await env.DB.prepare(
    `UPDATE household SET display_name = ?, meal_choice_count = ?, scheduling_cadence = ?, settings_json = ?, updated_at = ?
     WHERE household_id = ?`
  )
    .bind(
      next.display_name || hhRow.display_name,
      next.meal_choice_count,
      next.scheduling_cadence,
      JSON.stringify(next.prefs),
      ts,
      household_id
    )
    .run();

  if (Array.isArray(body.members)) {
    for (const m of body.members) {
      if (!m.member_id || !m.display_name) continue;
      await env.DB.prepare(
        `UPDATE member SET display_name = ?, updated_at = ? WHERE member_id = ? AND household_id = ?`
      )
        .bind(String(m.display_name).trim(), ts, m.member_id, household_id)
        .run();
    }
  }

  if (Array.isArray(body.constraints)) {
    for (const c of body.constraints) {
      if (!c.member_id || !c.rule_key) continue;
      const constraint_id = c.constraint_id || id("cr");
      await env.DB.prepare(
        `INSERT INTO constraint_rule
          (constraint_id, household_id, member_id, rule_key, status, includes_json, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
         ON CONFLICT(household_id, member_id, rule_key) DO UPDATE SET
           status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`
      )
        .bind(
          constraint_id,
          household_id,
          c.member_id,
          c.rule_key,
          c.status || "prohibited",
          c.note || null,
          ts,
          ts
        )
        .run();
    }
  }

  return getHousehold(env, household_id);
}

async function postRecommendationsPlan(env, body, session, request) {
  const household_id = session.household_id;
  if (body.household_id && body.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }
  const ctx = await loadRecommendationContext(env.DB, household_id);
  const ranked = rankMealsForHousehold(ctx);
  if (ranked.length < 3) return err("not_enough_eligible_meals", 422);

  const plan_id = body.plan_id || id("plan");
  const ts = nowIso();
  const options = scoredToPlanOptions(ranked, plan_id);

  await env.DB.prepare(
    `INSERT INTO plan
      (plan_id, household_id, batch_id, status, created_at, updated_at, attribution_last_touch, attribution_kind)
     VALUES (?, ?, ?, 'Generated', ?, ?, ?, ?)`
  )
    .bind(
      plan_id,
      household_id,
      body.batch_id || null,
      ts,
      ts,
      body.attribution_last_touch || null,
      body.attribution_kind || null
    )
    .run();
  const planOrigin = originFromRequest(request, body);
  if (planOrigin === SYNTHETIC_ORIGIN) {
    await markSynthetic(env, "plan", "plan_id", plan_id);
  }

  for (const opt of options) {
    await env.DB.prepare(
      `INSERT INTO meal_option
        (meal_option_id, plan_id, letter, name, recipe_slug, recipe_version, description_short, attributes_json, selected, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
      .bind(
        opt.meal_option_id,
        plan_id,
        opt.letter,
        opt.name,
        opt.recipe_slug,
        opt.recipe_version || opt.attributes_json.recipe_version_id || null,
        null,
        JSON.stringify(opt.attributes_json),
        ts
      )
      .run();
  }

  try {
    await env.DB.prepare(
      `INSERT INTO event
        (event_id, event_name, household_id, member_id, plan_id, meal_option_id,
         invite_code, share_object_id, channel, attribution_last_touch, props_json, created_at)
       VALUES (?, 'plan_generated', ?, ?, ?, NULL, NULL, NULL, 'app', ?, ?, ?)`
    )
      .bind(
        id("evt"),
        household_id,
        session.member_id,
        plan_id,
        body.attribution_last_touch || null,
        JSON.stringify({ source: "taste_model_v2_pipeline", option_count: options.length, data_origin: planOrigin }),
        ts
      )
      .run();
    if (planOrigin === SYNTHETIC_ORIGIN) {
      await env.DB.prepare(
        `UPDATE event SET data_origin = 'synthetic'
         WHERE plan_id = ? AND event_name = 'plan_generated' AND data_origin = 'household'`
      )
        .bind(plan_id)
        .run();
    }
  } catch { /* non-fatal */ }

  const clientOptions = options.map((o) => ({
    letter: o.letter,
    meal_option_id: o.meal_option_id,
    name: o.name,
    title: o.attributes_json.title,
    chips: o.attributes_json.chips,
    plate: o.attributes_json.plate,
    tone: o.attributes_json.tone,
    time: `${o.attributes_json.minutes} min`,
    effort: o.attributes_json.effort,
    pers: o.attributes_json.pers,
    score: o.score,
    recipe_slug: o.recipe_slug,
    recipe_version_id: o.recipe_version || o.attributes_json.recipe_version_id,
  }));

  return json(
    {
      ok: true,
      plan_id,
      household_id,
      meal_options: clientOptions,
      model: "taste_model_v1",
    },
    201
  );
}

async function getMealHistoryHandler(env, household_id, session) {
  if (session.household_id !== household_id) return err("forbidden_cross_household", 403);
  const items = await loadMealHistory(env.DB, household_id, 25);
  return json({ ok: true, household_id, meals: items });
}

async function getTasteProfileHandler(env, household_id, session) {
  if (session.household_id !== household_id) return err("forbidden_cross_household", 403);
  const ctx = await loadRecommendationContext(env.DB, household_id);
  const profile = buildTasteProfile(ctx.evidence, ctx.ratings);
  return json({ ok: true, household_id, profile, settings: ctx.settings.prefs });
}

async function postPreferenceEvidence(env, body, session, request) {
  const household_id = session.household_id;
  if (body.household_id && body.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }
  const tag = (body.tag || "").trim().toLowerCase();
  if (!tag) return err("tag_required");
  const kind = body.kind || "like";
  if (!["like", "dislike", "neutral"].includes(kind)) return err("invalid_kind");
  const evidence_id = body.evidence_id || id("pe");
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO preference_evidence
      (evidence_id, household_id, member_id, source, kind, tag, weight, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      evidence_id,
      household_id,
      body.member_id || session.member_id,
      body.source || "taste_correction",
      kind,
      tag,
      Number(body.weight) || 1,
      body.note || null,
      ts
    )
    .run();
  if (originFromRequest(request, body) === SYNTHETIC_ORIGIN) {
    await markSynthetic(env, "preference_evidence", "evidence_id", evidence_id);
  }
  return json({ ok: true, evidence_id, tag, kind }, 201);
}

async function postClientError(env, body, session) {
  const error_id = body.error_id || id("cerr");
  const ts = nowIso();
  const props = { ...body };
  delete props.error_id;
  delete props.surface;
  delete props.code;
  delete props.message;
  delete props.path;
  await env.DB.prepare(
    `INSERT INTO client_error
      (error_id, household_id, member_id, surface, code, message, path, props_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      error_id,
      (session && session.household_id) || body.household_id || null,
      (session && session.member_id) || body.member_id || null,
      body.surface || "client",
      body.code || null,
      body.message || null,
      body.path || null,
      Object.keys(props).length ? JSON.stringify(props) : null,
      ts
    )
    .run();
  return json({ ok: true, error_id }, 201);
}

async function getFunnelAnalytics(env, household_id, session) {
  if (session.household_id !== household_id) return err("forbidden_cross_household", 403);
  const names = [
    "household_created",
    "onboarding_completed",
    "invite_sent",
    "invite_opened",
    "invite_accepted",
    "plan_generated",
    "selection_recorded",
    "meal_vote_recorded",
    "selection_resolved",
    "cook_started",
    "cook_recorded",
    "rating_submitted",
    "loop_completed",
    "share_choice_created",
    "share_choice_viewed",
    "recipe_opened",
    "recommendation_failed",
  ];
  const counts = {};
  for (const n of names) {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM event WHERE household_id = ? AND event_name = ? AND data_origin = 'household'`
    )
      .bind(household_id, n)
      .first();
    counts[n] = row ? row.c : 0;
  }
  const loops = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM plan WHERE household_id = ? AND status = 'Rated' AND data_origin = 'household'`
  )
    .bind(household_id)
    .first();
  return json({
    ok: true,
    household_id,
    event_counts: counts,
    completed_meal_loops: loops ? loops.c : 0,
    cml_rule:
      "Cooked meal + every active member rated the selected meal_option (see PRODUCT-STATE.md)",
  });
}

function parseRequestedServings(request, fallback = null) {
  if (!request || !request.url) return fallback;
  try {
    const u = new URL(request.url);
    const raw = u.searchParams.get("servings");
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1 || n > 8) return fallback;
    return Math.round(n);
  } catch {
    return fallback;
  }
}

function serializeRecipeForClient(concept, version) {
  return {
    recipe_slug: concept.concept_id,
    recipe_version_id: version.recipe_version_id,
    title: concept.title,
    name: concept.name,
    servings: version.servings,
    base_servings: version.base_servings ?? version.servings,
    requested_servings: version.requested_servings ?? version.servings,
    scale_factor: version.scale_factor ?? 1,
    prep_minutes: version.prep_minutes,
    cook_minutes: version.cook_minutes,
    total_minutes: version.prep_minutes + version.cook_minutes,
    effort: version.effort,
    methods: version.methods,
    dietary_tags: version.dietary_tags,
    plate: concept.plate,
    ingredients: version.ingredients,
    steps: version.steps.map((s, idx) => ({
      index: idx + 1,
      title: s.title,
      body: s.body,
      ingredients: (s.ingredient_refs || []).map((ref) => {
        const match = version.ingredients.find((i) =>
          i.name.toLowerCase().includes(ref.toLowerCase())
        );
        return match ? `${match.quantity ? match.quantity + " " : ""}${match.name}` : ref;
      }),
    })),
    substitutions: version.substitutions || {},
  };
}

async function getRecipeBySlug(_env, slug, request) {
  const concept = getConceptBySlug(slug);
  if (!concept) return err("recipe_not_found", 404);
  const target = parseRequestedServings(request, concept.current_version.servings);
  const scaled = scaleRecipeVersion(concept.current_version, target);
  return json({
    ok: true,
    recipe: serializeRecipeForClient(concept, scaled),
  });
}

async function getRecipeByVersionId(_env, versionId, request) {
  const loaded = getRecipeVersion(versionId);
  if (!loaded || !loaded.concept) return err("recipe_version_not_found", 404);
  const target = parseRequestedServings(request, loaded.servings);
  const scaled = scaleRecipeVersion(loaded, target);
  return json({
    ok: true,
    recipe: serializeRecipeForClient(loaded.concept, scaled),
  });
}

async function postMealVote(env, plan_id, body, session, request) {
  const household_id = session.household_id;
  const { meal_option_id } = body;
  if (!meal_option_id) return err("meal_option_id_required");
  const planErr = await assertPlanInHousehold(env.DB, plan_id, session);
  if (planErr) return err(planErr, 403);
  const vote_id = body.vote_id || id("vote");
  const ts = nowIso();
  const voteOrigin = originFromRequest(request, body);
  if (voteOrigin === SYNTHETIC_ORIGIN) {
    const existingVote = await env.DB.prepare(
      `SELECT data_origin FROM meal_vote WHERE plan_id = ? AND member_id = ?`
    )
      .bind(plan_id, session.member_id)
      .first();
    if (existingVote && existingVote.data_origin !== SYNTHETIC_ORIGIN) {
      return json({ ok: true, synthetic: true, unchanged: true, status: "real_vote_preserved" });
    }
  }
  try {
    await env.DB.prepare(
      `INSERT INTO meal_vote
        (vote_id, plan_id, meal_option_id, household_id, member_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(plan_id, member_id) DO UPDATE SET
         meal_option_id = excluded.meal_option_id,
         created_at = excluded.created_at`
    )
      .bind(vote_id, plan_id, meal_option_id, household_id, session.member_id, ts)
      .run();
  } catch (e) {
    return err("vote_failed", 500, { detail: String(e.message || e) });
  }

  if (voteOrigin === SYNTHETIC_ORIGIN) {
    await env.DB.prepare(
      `UPDATE meal_vote SET data_origin = 'synthetic' WHERE plan_id = ? AND member_id = ?`
    )
      .bind(plan_id, session.member_id)
      .run();
    return json({ ok: true, vote_id, meal_option_id, status: "vote_recorded", synthetic: true }, 201);
  }

  const voteBundle = await loadPlanBundle(env.DB, plan_id);
  const voteGuard = selectionGuard(voteBundle, meal_option_id);
  if (!voteGuard.ok) {
    return json({
      ok: true,
      vote_id,
      meal_option_id: voteGuard.meal_option_id,
      status: "selection_locked",
      locked: true,
    });
  }

  try {
    await env.DB.prepare(
      `INSERT INTO event
        (event_id, event_name, household_id, member_id, plan_id, meal_option_id,
         invite_code, share_object_id, channel, attribution_last_touch, props_json, created_at)
       VALUES (?, 'meal_vote_recorded', ?, ?, ?, ?, NULL, NULL, 'app', NULL, NULL, ?)`
    )
      .bind(id("evt"), household_id, session.member_id, plan_id, meal_option_id, ts)
      .run();
  } catch { /* non-fatal */ }

  const resolve = body.auto_resolve !== false;
  if (resolve) {
    const resolution = await resolvePlanSelectionFromVotes(env, plan_id, session);
    if (resolution && resolution.ok) {
      return json({ ok: true, vote_id, meal_option_id, ...resolution }, 201);
    }
  }
  return json({ ok: true, vote_id, meal_option_id, status: "vote_recorded" }, 201);
}

async function resolvePlanSelectionFromVotes(env, plan_id, session) {
  const household_id = session.household_id;
  const bundle = await loadPlanBundle(env.DB, plan_id);
  if (bundle) {
    const guard = selectionGuard(bundle, "__not_the_locked_meal__");
    if (!guard.ok) {
      return {
        ok: true,
        status: "selection_locked",
        meal_option_id: guard.meal_option_id,
        locked: true,
      };
    }
  }
  const votesRes = await env.DB.prepare(
    `SELECT member_id, meal_option_id FROM meal_vote WHERE plan_id = ? AND data_origin = 'household'`
  )
    .bind(plan_id)
    .all();
  const active = await env.DB.prepare(
    `SELECT member_id FROM member WHERE household_id = ? AND status = 'active'`
  )
    .bind(household_id)
    .all();
  const activeIds = (active.results || []).map((r) => r.member_id);
  const votes = votesRes.results || [];
  const missing = membersWithoutVote(activeIds, votes);
  if (missing.length > 0 && activeIds.length > 1) {
    return { ok: false, waiting_on: missing };
  }

  const optsRes = await env.DB.prepare(
    `SELECT meal_option_id, letter, name, attributes_json FROM meal_option WHERE plan_id = ?`
  )
    .bind(plan_id)
    .all();
  const options = (optsRes.results || []).map((r) => {
    let score = 0;
    try {
      const attrs = r.attributes_json ? JSON.parse(r.attributes_json) : {};
      if (typeof attrs.score === "number") score = attrs.score;
    } catch { /* ignore */ }
    return {
      meal_option_id: r.meal_option_id,
      letter: r.letter,
      household_score: score,
    };
  });

  const { winner, rule, tallies } = resolveMealSelection(votes, options);
  if (!winner) return { ok: false, error: "no_winner" };

  const existingSel = await env.DB.prepare(
    `SELECT selection_id FROM selection WHERE plan_id = ? AND data_origin = 'household' LIMIT 1`
  )
    .bind(plan_id)
    .first();
  const ts = nowIso();
  if (!existingSel) {
    const selection_id = id("sel");
    await env.DB.prepare(
      `INSERT INTO selection
        (selection_id, plan_id, meal_option_id, household_id, source, actor_member_id, share_object_id, created_at)
       VALUES (?, ?, ?, ?, 'app', ?, NULL, ?)`
    )
      .bind(selection_id, plan_id, winner.meal_option_id, household_id, session.member_id, ts)
      .run();
  } else {
    await env.DB.prepare(`UPDATE selection SET meal_option_id = ? WHERE selection_id = ?`)
      .bind(winner.meal_option_id, existingSel.selection_id)
      .run();
  }
  const nextStatus = statusAfterSelection(bundle && bundle.plan.status, { locked: false });
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE meal_option SET selected = CASE WHEN meal_option_id = ? THEN 1 ELSE 0 END WHERE plan_id = ?`
    ).bind(winner.meal_option_id, plan_id),
    env.DB.prepare(
      `UPDATE plan SET status = ?, updated_at = ? WHERE plan_id = ?`
    ).bind(nextStatus, ts, plan_id),
  ]);

  try {
    await env.DB.prepare(
      `INSERT INTO event
        (event_id, event_name, household_id, member_id, plan_id, meal_option_id,
         invite_code, share_object_id, channel, attribution_last_touch, props_json, created_at)
       VALUES (?, 'selection_resolved', ?, ?, ?, ?, NULL, NULL, 'app', NULL, ?, ?)`
    )
      .bind(
        id("evt"),
        household_id,
        session.member_id,
        plan_id,
        winner.meal_option_id,
        JSON.stringify({ rule, tallies }),
        ts
      )
      .run();
  } catch { /* non-fatal */ }

  return {
    ok: true,
    status: nextStatus,
    meal_option_id: winner.meal_option_id,
    resolution_rule: rule,
    tallies,
  };
}

async function postInviteJoin(env, body, request, requestUrl) {
  const token = readSessionToken(request);
  const existing = token ? await resolveSession(env.DB, token) : null;
  const secure = requestUrl.protocol === "https:";
  const result = await joinHouseholdViaInvite(
    env.DB,
    {
      invite_code: body.invite_code,
      display_name: body.display_name,
      member_id: body.member_id,
      constraint_keys: body.constraint_keys || body.keys,
    },
    {
      session: existing,
      user_agent: request.headers.get("User-Agent") || undefined,
      secure,
    }
  );
  if (result.error) {
    return err(result.error, result.status || 400, {
      current_household_id: result.current_household_id,
      invite_household_id: result.invite_household_id,
    });
  }

  const ts = nowIso();
  try {
    await env.DB.prepare(
      `INSERT INTO event
        (event_id, event_name, household_id, member_id, plan_id, meal_option_id,
         invite_code, share_object_id, channel, attribution_last_touch, props_json, created_at)
       VALUES (?, 'invite_accepted', ?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?)`
    )
      .bind(
        id("evt"),
        result.household_id,
        result.member_id,
        result.invite_code,
        body.channel || "deep_link",
        result.invite_code,
        JSON.stringify({ already_member: result.already_member }),
        ts
      )
      .run();
  } catch { /* non-fatal */ }

  if (Array.isArray(body.sparks)) {
    for (const tag of body.sparks.slice(0, 3)) {
      await env.DB.prepare(
        `INSERT INTO preference_evidence
          (evidence_id, household_id, member_id, source, kind, tag, weight, note, created_at)
         VALUES (?, ?, ?, 'onboarding_spark', 'like', ?, 1, NULL, ?)`
      )
        .bind(id("pe"), result.household_id, result.member_id, tag, ts)
        .run();
    }
  }

  const activity = await loadHouseholdActivity(env.DB, result.household_id);
  const state = deriveHouseholdState({
    plan: activity.plan,
    selection: activity.selection,
    cook: activity.cook,
    ratings: activity.ratings,
    active_member_count: activity.active_member_count,
    onboarded: activity.onboarded,
  });

  return json(
    {
      ok: true,
      already_member: result.already_member,
      household_id: result.household_id,
      member_id: result.member_id,
      household: activity.household,
      members: activity.members,
      constraints: activity.constraints,
      ...state,
    },
    200,
    { "Set-Cookie": result.set_cookie }
  );
}

async function getHouseholdState(env, household_id) {
  const activity = await loadHouseholdActivity(env.DB, household_id);
  if (!activity) return err("household_not_found", 404);
  const state = deriveHouseholdState({
    plan: activity.plan,
    selection: activity.selection,
    cook: activity.cook,
    ratings: activity.ratings,
    active_member_count: activity.active_member_count,
    onboarded: activity.onboarded,
  });
  return json({
    ok: true,
    household: activity.household,
    members: activity.members,
    constraints: activity.constraints,
    meal_options: projectMealOptions(activity.meal_options),
    outcome_locked: activity.outcome_locked,
    locked_meal_option_id: activity.locked_meal_option_id,
    ...state,
  });
}

async function postSession(env, body, request, requestUrl) {
  const household_id = body.household_id;
  const member_id = body.member_id;
  if (!household_id || !member_id) return err("household_id_and_member_id_required");
  const secure = requestUrl.protocol === "https:";
  const created = await createMemberSession(
    env.DB,
    {
      household_id,
      member_id,
      user_agent: request.headers.get("User-Agent") || undefined,
    },
    { secure }
  );
  if (created.error) return err(created.error, created.status || 400);
  return json(
    {
      ok: true,
      household_id: created.household_id,
      member_id: created.member_id,
      expires_at: created.expires_at,
    },
    201,
    { "Set-Cookie": created.set_cookie }
  );
}

async function postRecoveryRequest(env, body, requestUrl) {
  const household_id = body.household_id;
  const member_id = body.member_id;
  if (!household_id || !member_id) return err("household_id_and_member_id_required");
  const destination_path =
    body.destination_path || body.dest || "/";
  const origin = productOrigin(requestUrl);
  const created = await createRecoveryToken(
    env.DB,
    { household_id, member_id, destination_path },
    origin
  );
  if (created.error) return err(created.error, created.status || 400);
  const mail = await deliverRecoveryLink(env, {
    to: body.email || null,
    recovery_url: created.recovery_url,
    member_id,
  });
  const dev_recovery_url = created.recovery_url;
  return json({
    ok: true,
    expires_at: created.expires_at,
    destination_path,
    mail,
    dev_recovery_url,
  });
}

async function postRecoveryConsume(env, body, request, requestUrl) {
  const plain = body.token || body.recovery_token;
  if (!plain) return err("recovery_token_required");
  const secure = requestUrl.protocol === "https:";
  const consumed = await consumeRecoveryToken(env.DB, plain, {
    secure,
    user_agent: request.headers.get("User-Agent") || undefined,
  });
  if (consumed.error) return err(consumed.error, consumed.status || 400);
  return json(
    {
      ok: true,
      household_id: consumed.household_id,
      member_id: consumed.member_id,
      destination_path: consumed.destination_path,
    },
    200,
    { "Set-Cookie": consumed.set_cookie }
  );
}

async function getSessionMe(env, request, requestUrl) {
  const secure = requestUrl.protocol === "https:";
  const token = readSessionToken(request);
  const row = await resolveSession(env.DB, token);
  if (!row) {
    return json(
      { ok: false, error: "session_invalid" },
      401,
      { "Set-Cookie": sessionClearCookieHeader({ secure }) }
    );
  }
  const activity = await loadHouseholdActivity(env.DB, row.household_id);
  if (!activity) {
    return json(
      { ok: false, error: "household_not_found" },
      404,
      { "Set-Cookie": sessionClearCookieHeader({ secure }) }
    );
  }
  const state = deriveHouseholdState({
    plan: activity.plan,
    selection: activity.selection,
    cook: activity.cook,
    ratings: activity.ratings,
    active_member_count: activity.active_member_count,
    onboarded: activity.onboarded,
  });
  let previous_meal = null;
  try {
    previous_meal = previousCompletedMeal(await loadMealHistory(env.DB, row.household_id, 6), state.plan_id);
  } catch { /* history is a nicety here; restore must not fail on it */ }
  return json({
    ok: true,
    previous_meal,
    session: {
      household_id: row.household_id,
      member_id: row.member_id,
      expires_at: row.expires_at,
    },
    household: activity.household,
    members: activity.members,
    constraints: activity.constraints,
    meal_options: projectMealOptions(activity.meal_options),
    ratings: activity.ratings,
    outcome_locked: activity.outcome_locked,
    locked_meal_option_id: activity.locked_meal_option_id,
    ...state,
  });
}

async function postEligibilityCheck(env, body, session) {
  const household_id = session.household_id;
  const options = body.meal_options || body.options;
  if (body.household_id && body.household_id !== household_id) {
    return err("forbidden_cross_household", 403);
  }
  if (!Array.isArray(options)) return err("meal_options_required");
  const activity = await loadHouseholdActivity(env.DB, household_id);
  if (!activity) return err("household_not_found", 404);
  const eligible = filterEligibleOptions(options, activity.constraints);
  const rejected = options.filter(
    (o) => !eligible.some((e) => e.meal_option_id === o.meal_option_id)
  );
  return json({
    ok: true,
    household_id,
    eligible,
    rejected,
    prohibited_rules: [...new Set(
      activity.constraints
        .filter((c) => c.status === "prohibited" && c.rule_key !== "none")
        .map((c) => c.rule_key)
    )],
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (
        (path === "/api/health" || path === "/health") &&
        request.method === "GET"
      ) {
        return handleHealth(env, url);
      }

      if (!env.DB) {
        if (path.startsWith("/api/")) {
          return err("d1_unbound", 503);
        }
      } else {
        // POST /api/households
        if (path === "/api/households" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          return createHousehold(env, body, request);
        }

        // GET /api/households/:id/state
        {
          const m = matchPath(path, "/api/households/:id/state");
          if (m && request.method === "GET") {
            const auth = await requireSession(env.DB, request);
            if (auth.error) return auth.error;
            if (m.id !== auth.session.household_id) {
              return err("forbidden_cross_household", 403);
            }
            return getHouseholdState(env, m.id);
          }
        }

        // GET /api/households/:id
        {
          const m = matchPath(path, "/api/households/:id");
          if (m && request.method === "GET") {
            const auth = await requireSession(env.DB, request);
            if (auth.error) return auth.error;
            if (m.id !== auth.session.household_id) {
              return err("forbidden_cross_household", 403);
            }
            return getHousehold(env, m.id);
          }
        }

        // PATCH /api/households/:id — settings post-onboarding
        {
          const m = matchPath(path, "/api/households/:id");
          if (m && request.method === "PATCH") {
            const body = await readBody(request);
            if (body === null) return err("invalid_json");
            const auth = await requireSession(env.DB, request);
            if (auth.error) return auth.error;
            return patchHousehold(env, m.id, body, auth.session);
          }
        }

        {
          const m = matchPath(path, "/api/households/:id/meals/history");
          if (m && request.method === "GET") {
            const auth = await requireSession(env.DB, request);
            if (auth.error) return auth.error;
            return getMealHistoryHandler(env, m.id, auth.session);
          }
        }

        {
          const m = matchPath(path, "/api/households/:id/taste-profile");
          if (m && request.method === "GET") {
            const auth = await requireSession(env.DB, request);
            if (auth.error) return auth.error;
            return getTasteProfileHandler(env, m.id, auth.session);
          }
        }

        {
          const m = matchPath(path, "/api/households/:id/funnel");
          if (m && request.method === "GET") {
            const auth = await requireSession(env.DB, request);
            if (auth.error) return auth.error;
            return getFunnelAnalytics(env, m.id, auth.session);
          }
        }

        // POST /api/sessions — Set-Cookie he_session
        if (path === "/api/sessions" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          return postSession(env, body, request, url);
        }

        // GET /api/sessions/me — restore returning user
        if (path === "/api/sessions/me" && request.method === "GET") {
          return getSessionMe(env, request, url);
        }

        // POST /api/recovery/request
        if (path === "/api/recovery/request" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          return postRecoveryRequest(env, body, url);
        }

        // POST /api/recovery/consume
        if (path === "/api/recovery/consume" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          return postRecoveryConsume(env, body, request, url);
        }

        if (path === "/api/recommendations/plan" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return postRecommendationsPlan(env, body, auth.session, request);
        }

        if (path === "/api/ops/alpha-metrics" && request.method === "GET") {
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          const metrics = await loadAlphaOpsMetrics(env.DB);
          return json({ ok: true, metrics, catalog_coverage: catalogCoverageMetrics() });
        }

        {
          const m = matchPath(path, "/api/recipes/:slug");
          if (m && request.method === "GET" && !m.slug.startsWith("version")) {
            return getRecipeBySlug(env, m.slug, request);
          }
        }
        {
          const m = matchPath(path, "/api/recipes/version/:versionId");
          if (m && request.method === "GET") {
            return getRecipeByVersionId(env, m.versionId, request);
          }
        }

        {
          const m = matchPath(path, "/api/plans/:plan_id/votes");
          if (m && request.method === "POST") {
            const body = await readBody(request);
            if (body === null) return err("invalid_json");
            const auth = await requireSession(env.DB, request);
            if (auth.error) return auth.error;
            return postMealVote(env, m.plan_id, body, auth.session, request);
          }
        }
        {
          const m = matchPath(path, "/api/plans/:plan_id/resolve-selection");
          if (m && request.method === "POST") {
            const auth = await requireSession(env.DB, request);
            if (auth.error) return auth.error;
            const resolution = await resolvePlanSelectionFromVotes(env, m.plan_id, auth.session);
            return json(resolution && resolution.ok ? { ok: true, ...resolution } : err("unresolved", 409, resolution || {}));
          }
        }

        if (path === "/api/preference-evidence" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return postPreferenceEvidence(env, body, auth.session, request);
        }

        if (path === "/api/client-errors" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const token = readSessionToken(request);
          const row = token ? await resolveSession(env.DB, token) : null;
          return postClientError(env, body, row);
        }

        if (path === "/api/invites/join" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          return postInviteJoin(env, body, request, url);
        }

        // POST /api/eligibility/check
        if (path === "/api/eligibility/check" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return postEligibilityCheck(env, body, auth.session);
        }

        // POST /api/households/:id/members
        {
          const m = matchPath(path, "/api/households/:id/members");
          if (m && request.method === "POST") {
            const body = await readBody(request);
            if (body === null) return err("invalid_json");
            return addMember(env, m.id, body, request);
          }
        }

        // POST /api/members/:id/constraints
        {
          const m = matchPath(path, "/api/members/:id/constraints");
          if (m && request.method === "POST") {
            const body = await readBody(request);
            if (body === null) return err("invalid_json");
            const auth = await requireSession(env.DB, request);
            if (auth.error) return auth.error;
            return setConstraints(env, m.id, body, auth.session);
          }
        }

        // POST /api/plans
        if (path === "/api/plans" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return createPlan(env, body, auth.session);
        }

        // POST /api/selections
        if (path === "/api/selections" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return createSelection(env, body, auth.session, request);
        }

        // POST /api/cooks
        if (path === "/api/cooks" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return createCook(env, body, auth.session, request);
        }

        // POST /api/ratings
        if (path === "/api/ratings" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return createRating(env, body, auth.session, request);
        }

        // POST /api/events
        if (path === "/api/events" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return createEvent(env, body, auth.session, request);
        }


        // POST /api/shares — durable HE-SHARE-* (options snapshot in D1)
        if (path === "/api/shares" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return createShare(env, body, url, auth.session);
        }

        // GET /api/shares/:token  or  GET /api/shares?token=
        {
          const m = matchPath(path, "/api/shares/:token");
          if (m && request.method === "GET") {
            return resolveShare(env, m.token);
          }
        }
        if (path === "/api/shares" && request.method === "GET") {
          const token = url.searchParams.get("token") || url.searchParams.get("share");
          if (!token) return err("token_required");
          return resolveShare(env, token);
        }

        // POST /api/invites — durable HE-INV-*
        if (path === "/api/invites" && request.method === "POST") {
          const body = await readBody(request);
          if (body === null) return err("invalid_json");
          const auth = await requireSession(env.DB, request);
          if (auth.error) return auth.error;
          return createInvite(env, body, url, auth.session);
        }

        // GET /api/invites/:code  or  GET /api/invites?code=
        {
          const m = matchPath(path, "/api/invites/:code");
          if (m && request.method === "GET") {
            return resolveInvite(env, m.code);
          }
        }
        if (path === "/api/invites" && request.method === "GET") {
          const code = url.searchParams.get("code") || url.searchParams.get("invite");
          if (!code) return err("invite_code_required");
          return resolveInvite(env, code);
        }

        if (path.startsWith("/api/")) {
          return err("not_found", 404, { path, hint: "See README API list" });
        }
      }
    } catch (e) {
      return err("internal_error", 500, { detail: String(e.message || e) });
    }

    // SPA deep-link routes → index.html (auth boundary handled client-side)
    if (env.ASSETS) {
      const spaPaths = ["/invite/", "/share/", "/recover/", "/rate/", "/meal/"];
      if (spaPaths.some((p) => path.startsWith(p))) {
        // Serve SPA shell at deep-link URL (wrangler assets 307 /index.html → /).
        const shell = new URL(request.url);
        shell.pathname = "/";
        shell.search = "";
        const res = await env.ASSETS.fetch(new Request(shell.toString(), request));
        const headers = new Headers(res.headers);
        headers.set("Content-Type", "text/html; charset=utf-8");
        return new Response(res.body, { status: 200, headers });
      }
      return env.ASSETS.fetch(request);
    }

    return err("not_found", 404, { hint: "Try GET /api/health" });
  },
};
