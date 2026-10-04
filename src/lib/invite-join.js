/**
 * Invite accept / join — production PLG path.
 */

import { validateInviteForHousehold } from "./auth.js";
import { createMemberSession } from "./session.js";
import { sessionClearCookieHeader } from "./cookies.js";
import { constraintRowsFromKeys } from "./eligibility.js";

function slugMemberId(display_name) {
  const base =
    display_name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 24) || "member";
  return `${base}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

/**
 * An invite is how a second device becomes an existing diner.
 * Match the name they type to the household member already on the plan.
 * @param {import('@cloudflare/workers-types').D1Database} db
 */
async function findMemberByDisplayName(db, household_id, display_name) {
  const name = String(display_name || "").trim().toLowerCase();
  if (!name) return null;
  const res = await db
    .prepare(
      `SELECT member_id, display_name, status, created_at FROM member
       WHERE household_id = ? AND lower(trim(display_name)) = ?`
    )
    .bind(household_id, name)
    .all();
  const rows = (res && res.results) || [];
  const rank = (status) => (status === "active" ? 0 : status === "invited" ? 1 : 9);
  const usable = rows.filter((row) => rank(String(row.status || "").toLowerCase()) < 9);
  usable.sort(
    (a, b) =>
      rank(String(a.status || "").toLowerCase()) - rank(String(b.status || "").toLowerCase()) ||
      String(a.created_at || "").localeCompare(String(b.created_at || ""))
  );
  return usable[0] || null;
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 */
export async function joinHouseholdViaInvite(db, input, opts = {}) {
  const invite_code = input.invite_code;
  const display_name = (input.display_name || "").trim();
  if (!invite_code) return { error: "invite_code_required", status: 400 };
  if (!display_name) return { error: "display_name_required", status: 400 };

  const inv = await db
    .prepare(
      `SELECT invite_code, household_id, inviter_member_id, channel, status, expires_at
       FROM invite WHERE invite_code = ?`
    )
    .bind(invite_code)
    .first();
  if (!inv) return { error: "invite_not_found", status: 404 };

  const invErr = await validateInviteForHousehold(db, invite_code, inv.household_id);
  if (invErr) {
    const status = invErr === "invite_expired" ? 410 : 403;
    return { error: invErr, status };
  }

  if (opts.session && opts.session.household_id !== inv.household_id) {
    return {
      error: "wrong_household_logged_in",
      status: 409,
      current_household_id: opts.session.household_id,
      invite_household_id: inv.household_id,
    };
  }

  const named = await findMemberByDisplayName(db, inv.household_id, display_name);
  let member_id = input.member_id || (named && named.member_id) || slugMemberId(display_name);
  let existing = await db
    .prepare(
      "SELECT member_id, status FROM member WHERE household_id = ? AND member_id = ?"
    )
    .bind(inv.household_id, member_id)
    .first();
  if (!existing && named) {
    existing = named;
    member_id = named.member_id;
  }

  const ts = new Date().toISOString();
  let already_member = false;

  const existingStatus = String((existing && existing.status) || "").toLowerCase();
  if (existing && existingStatus === "active") {
    already_member = true;
    member_id = existing.member_id;
  } else if (existing && existingStatus === "invited") {
    await db
      .prepare(
        `UPDATE member SET display_name = ?, status = 'active', accepted_at = ?, updated_at = ?,
         invite_code = ?, invite_channel = ?
         WHERE member_id = ?`
      )
      .bind(
        display_name,
        ts,
        ts,
        invite_code,
        inv.channel || "copy",
        member_id
      )
      .run();
  } else if (!existing) {
    try {
      await db
        .prepare(
          `INSERT INTO member
            (member_id, household_id, display_name, role, status, invite_code, inviter_member_id,
             invite_channel, invited_at, accepted_at, inherits_household_eligibility, created_at, updated_at)
           VALUES (?, ?, ?, 'member', 'active', ?, ?, ?, ?, ?, 0, ?, ?)`
        )
        .bind(
          member_id,
          inv.household_id,
          display_name,
          invite_code,
          inv.inviter_member_id,
          inv.channel || "copy",
          ts,
          ts,
          ts,
          ts
        )
        .run();
    } catch (e) {
      return { error: "member_create_failed", status: 500, detail: String(e.message || e) };
    }
  }

  if (Array.isArray(input.constraint_keys) && input.constraint_keys.length) {
    for (const row of constraintRowsFromKeys(input.constraint_keys)) {
      const constraint_id = `cr_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      await db
        .prepare(
          `INSERT INTO constraint_rule
            (constraint_id, household_id, member_id, rule_key, status, includes_json, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)
           ON CONFLICT(household_id, member_id, rule_key) DO UPDATE SET
             status = excluded.status, updated_at = excluded.updated_at`
        )
        .bind(constraint_id, inv.household_id, member_id, row.rule_key, row.status, ts, ts)
        .run();
    }
  }

  await db
    .prepare(
      `UPDATE invite SET status = 'accepted', accepted_at = ?, invited_member_id = ?
       WHERE invite_code = ?`
    )
    .bind(ts, member_id, invite_code)
    .run();

  const session = await createMemberSession(
    db,
    { household_id: inv.household_id, member_id, user_agent: opts.user_agent },
    { secure: opts.secure !== false }
  );
  if (session.error) return session;

  return {
    ok: true,
    already_member,
    household_id: inv.household_id,
    member_id,
    invite_code,
    set_cookie: session.set_cookie,
    clear_other: opts.clear_other_cookie
      ? sessionClearCookieHeader({ secure: opts.secure !== false })
      : null,
  };
}
