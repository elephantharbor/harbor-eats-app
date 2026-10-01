import { randomToken, sha256Hex } from "./crypto.js";
import { createMemberSession } from "./session.js";
import { sessionClearCookieHeader } from "./cookies.js";

const RECOVERY_MINUTES = 30;

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {{ household_id: string, member_id: string, destination_path?: string|null }} input
 * @param {string} origin
 */
export async function createRecoveryToken(db, input, origin) {
  const member = await db
    .prepare(
      "SELECT member_id, household_id FROM member WHERE member_id = ? AND household_id = ? AND status = 'active'"
    )
    .bind(input.member_id, input.household_id)
    .first();
  if (!member) return { error: "member_not_found", status: 404 };

  const plain = randomToken(32);
  const token_hash = await sha256Hex(plain);
  const ts = new Date();
  const expires = new Date(ts.getTime() + RECOVERY_MINUTES * 60000);
  const recovery_id = `rcv_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const destination_path = input.destination_path || "/";

  await db
    .prepare(
      `INSERT INTO recovery_token
        (recovery_id, token_hash, household_id, member_id, destination_path, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      recovery_id,
      token_hash,
      input.household_id,
      input.member_id,
      destination_path,
      expires.toISOString(),
      ts.toISOString()
    )
    .run();

  const recovery_url = `${origin.replace(/\/$/, "")}/recover/${plain}?dest=${encodeURIComponent(destination_path)}`;
  return {
    ok: true,
    recovery_id,
    recovery_url,
    expires_at: expires.toISOString(),
    /** Dev/test transport only — never log in production UI */
    dev_token: plain,
  };
}

/**
 * @param {import('@cloudflare/workers-types').D1Database} db
 * @param {string} plainToken
 * @param {{ secure?: boolean, user_agent?: string }} opts
 */
export async function consumeRecoveryToken(db, plainToken, opts = {}) {
  if (!plainToken || plainToken.length < 16) return { error: "invalid_recovery_token", status: 400 };
  const token_hash = await sha256Hex(plainToken);
  const row = await db
    .prepare(
      `SELECT recovery_id, household_id, member_id, destination_path, expires_at, used_at
       FROM recovery_token WHERE token_hash = ?`
    )
    .bind(token_hash)
    .first();
  if (!row) return { error: "recovery_not_found", status: 404 };
  if (row.used_at) return { error: "recovery_already_used", status: 410 };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { error: "recovery_expired", status: 410 };
  }

  const ts = new Date().toISOString();
  await db
    .prepare("UPDATE recovery_token SET used_at = ? WHERE recovery_id = ?")
    .bind(ts, row.recovery_id)
    .run();

  const session = await createMemberSession(
    db,
    {
      household_id: row.household_id,
      member_id: row.member_id,
      user_agent: opts.user_agent,
    },
    { secure: opts.secure !== false }
  );
  if (session.error) return session;

  return {
    ok: true,
    household_id: row.household_id,
    member_id: row.member_id,
    destination_path: row.destination_path || "/",
    set_cookie: session.set_cookie,
  };
}

export function recoveryClearCookie(secure) {
  return sessionClearCookieHeader({ secure });
}
