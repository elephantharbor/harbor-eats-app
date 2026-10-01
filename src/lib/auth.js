import { readSessionToken, resolveSession } from "./session.js";

/** @typedef {{ session_id: string, household_id: string, member_id: string, expires_at: string }} AuthSession */

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {Request} request
 * @returns {Promise<{ session: AuthSession }|{ error: Response }>}
 */
export async function requireSession(db, request) {
  const token = readSessionToken(request);
  const row = await resolveSession(db, token);
  if (!row) {
    return {
      error: jsonAuthError("unauthorized", 401),
    };
  }
  return {
    session: {
      session_id: row.session_id,
      household_id: row.household_id,
      member_id: row.member_id,
      expires_at: row.expires_at,
    },
  };
}

export function jsonAuthError(error, status = 403, extra = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * @param {AuthSession} session
 * @param {string|null|undefined} requestedHouseholdId
 */
export function assertSameHousehold(session, requestedHouseholdId) {
  if (!requestedHouseholdId) return null;
  if (requestedHouseholdId !== session.household_id) {
    return "forbidden_cross_household";
  }
  return null;
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} member_id
 * @param {AuthSession} session
 */
export async function assertMemberInSessionHousehold(db, member_id, session) {
  const row = await db
    .prepare(
      "SELECT member_id, household_id FROM member WHERE member_id = ? AND household_id = ?"
    )
    .bind(member_id, session.household_id)
    .first();
  if (!row) return "forbidden_member";
  return null;
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} plan_id
 * @param {AuthSession} session
 */
export async function assertPlanInHousehold(db, plan_id, session) {
  const row = await db
    .prepare("SELECT plan_id FROM plan WHERE plan_id = ? AND household_id = ?")
    .bind(plan_id, session.household_id)
    .first();
  if (!row) return "forbidden_plan";
  return null;
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} household_id
 */
export async function countActiveMembers(db, household_id) {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS c FROM member WHERE household_id = ? AND status = 'active'"
    )
    .bind(household_id)
    .first();
  return Number(row?.c || 0);
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} invite_code
 * @param {string} household_id
 */
export async function validateInviteForHousehold(db, invite_code, household_id) {
  if (!invite_code || !String(invite_code).startsWith("HE-INV")) {
    return "invalid_invite_code";
  }
  const row = await db
    .prepare(
      `SELECT invite_code, household_id, status, expires_at FROM invite WHERE invite_code = ?`
    )
    .bind(invite_code)
    .first();
  if (!row || row.household_id !== household_id) return "invite_not_found";
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return "invite_expired";
  }
  if (row.status === "revoked" || row.status === "expired") return "invite_inactive";
  return null;
}
