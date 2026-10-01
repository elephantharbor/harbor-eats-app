import { SESSION_COOKIE, parseCookies, sessionSetCookieHeader } from "./cookies.js";
import { sha256Hex } from "./crypto.js";

const SESSION_DAYS = 90;

function sessionTokenPlain() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function readSessionToken(request) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const headerToken = request.headers.get("X-HE-Session");
  if (headerToken) return headerToken.trim();
  return null;
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ household_id: string, member_id: string, user_agent?: string }} input
 */
export async function createMemberSession(db, input, cookieOpts = {}) {
  const member = await db
    .prepare(
      "SELECT member_id, household_id FROM member WHERE member_id = ? AND household_id = ? AND status = 'active'"
    )
    .bind(input.member_id, input.household_id)
    .first();
  if (!member) return { error: "member_not_found", status: 404 };

  const ts = new Date();
  const expires = new Date(ts.getTime() + SESSION_DAYS * 86400000);
  const session_id = `sess_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const plain = sessionTokenPlain();
  const token_hash = await sha256Hex(plain);
  const created_at = ts.toISOString();
  const expires_at = expires.toISOString();

  await db
    .prepare(
      `INSERT INTO member_session
        (session_id, session_token, session_token_hash, household_id, member_id, created_at, expires_at, user_agent, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      session_id,
      token_hash,
      token_hash,
      input.household_id,
      input.member_id,
      created_at,
      expires_at,
      input.user_agent || null,
      created_at
    )
    .run();

  return {
    session_id,
    session_token: plain,
    household_id: input.household_id,
    member_id: input.member_id,
    expires_at,
    set_cookie: sessionSetCookieHeader(plain, expires_at, {
      secure: cookieOpts.secure !== false,
    }),
  };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string|null} token
 */
export async function resolveSession(db, token) {
  if (!token) return null;
  const token_hash = await sha256Hex(token);
  let row = await db
    .prepare(
      `SELECT session_id, session_token, session_token_hash, household_id, member_id, expires_at, revoked_at
       FROM member_session WHERE session_token_hash = ?`
    )
    .bind(token_hash)
    .first();
  if (!row) {
    row = await db
      .prepare(
        `SELECT session_id, session_token, session_token_hash, household_id, member_id, expires_at, revoked_at
         FROM member_session WHERE session_token = ?`
      )
      .bind(token)
      .first();
  }
  if (!row || row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await db
    .prepare("UPDATE member_session SET last_seen_at = ? WHERE session_id = ?")
    .bind(new Date().toISOString(), row.session_id)
    .run();

  return row;
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} household_id
 */
export async function loadHouseholdActivity(db, household_id) {
  const hh = await db
    .prepare("SELECT household_id, display_name, status FROM household WHERE household_id = ?")
    .bind(household_id)
    .first();
  if (!hh) return null;

  const membersRes = await db
    .prepare(
      `SELECT member_id, display_name, role, status FROM member WHERE household_id = ? ORDER BY created_at`
    )
    .bind(household_id)
    .all();
  const members = membersRes.results || [];

  const constraintsRes = await db
    .prepare(
      `SELECT constraint_id, member_id, rule_key, status FROM constraint_rule WHERE household_id = ?`
    )
    .bind(household_id)
    .all();
  const constraints = constraintsRes.results || [];

  const plan = await db
    .prepare(
      `SELECT plan_id, status, created_at, updated_at FROM plan
       WHERE household_id = ? ORDER BY updated_at DESC LIMIT 1`
    )
    .bind(household_id)
    .first();

  let selection = null;
  let cook = null;
  let ratings = [];
  let meal_options = [];

  if (plan) {
    const sel = await db
      .prepare(
        `SELECT meal_option_id, plan_id FROM selection WHERE plan_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .bind(plan.plan_id)
      .first();
    selection = sel || null;

    const ck = await db
      .prepare(`SELECT cook_id, meal_option_id FROM cook WHERE plan_id = ? ORDER BY created_at DESC LIMIT 1`)
      .bind(plan.plan_id)
      .first();
    cook = ck || null;

    const rat = await db
      .prepare(`SELECT member_id, score FROM rating WHERE plan_id = ?`)
      .bind(plan.plan_id)
      .all();
    ratings = rat.results || [];

    const mo = await db
      .prepare(`SELECT meal_option_id, letter, name, attributes_json FROM meal_option WHERE plan_id = ?`)
      .bind(plan.plan_id)
      .all();
    meal_options = mo.results || [];
  }

  const active_member_count = members.filter((m) => m.status === "active").length;
  const hasConstraints = constraints.some((c) => c.status === "prohibited" && c.rule_key !== "none");
  const onboarded =
    members.length >= 2 || hasConstraints || plan != null || selection != null;

  return {
    household: hh,
    members,
    constraints,
    plan,
    selection,
    cook,
    ratings,
    meal_options,
    active_member_count,
    onboarded,
  };
}
