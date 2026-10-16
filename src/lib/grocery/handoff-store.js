/**
 * Durable handoff rows. A row is a link we created, not a purchase.
 */

const STATUSES = ["prepared", "link_created", "stale", "expired", "failed", "cancelled", "rejected"];

export function newHandoffId() {
  return `gh_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function mapRow(row) {
  if (!row) return null;
  return {
    handoff_id: row.handoff_id,
    shop_list_id: row.shop_list_id,
    household_id: row.household_id,
    provider_id: row.provider_id,
    link_type: row.link_type,
    revision_sent: row.revision_sent,
    content_revision_sent: row.content_revision_sent,
    request_hash: row.request_hash,
    content_fingerprint: row.content_fingerprint,
    status: row.status,
    products_link_url: row.products_link_url,
    expires_at: row.expires_at,
    retailer_key: row.retailer_key,
    error_code: row.error_code,
    provider_code: row.provider_code,
    line_count: row.line_count,
    excluded_count: row.excluded_count,
    created_by_member_id: row.created_by_member_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function refreshHandoffStates(db, { shopListId, providerId, contentFingerprint, now }) {
  await db
    .prepare(
      `UPDATE grocery_handoff
       SET status = 'expired', updated_at = ?
       WHERE shop_list_id = ? AND provider_id = ? AND status = 'link_created'
         AND expires_at IS NOT NULL AND expires_at <= ?`
    )
    .bind(now, shopListId, providerId, now)
    .run();
  const stale = await db
    .prepare(
      `UPDATE grocery_handoff
       SET status = 'stale', updated_at = ?
       WHERE shop_list_id = ? AND provider_id = ? AND status = 'link_created'
         AND content_fingerprint != ?`
    )
    .bind(now, shopListId, providerId, contentFingerprint)
    .run();
  return Number(stale?.meta?.changes || 0);
}

export async function findReusableHandoff(db, { shopListId, providerId, requestHash }) {
  const row = await db
    .prepare(
      `SELECT * FROM grocery_handoff
       WHERE shop_list_id = ? AND provider_id = ? AND request_hash = ? AND status = 'link_created'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(shopListId, providerId, requestHash)
    .first();
  return mapRow(row);
}

export async function latestHandoff(db, { shopListId, providerId }) {
  const row = await db
    .prepare(
      `SELECT * FROM grocery_handoff
       WHERE shop_list_id = ? AND provider_id = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .bind(shopListId, providerId)
    .first();
  return mapRow(row);
}

export async function insertHandoff(db, row) {
  if (!STATUSES.includes(row.status)) throw new Error("handoff_status");
  await db
    .prepare(
      `INSERT INTO grocery_handoff
        (handoff_id, shop_list_id, household_id, provider_id, link_type, revision_sent,
         content_revision_sent, request_hash, content_fingerprint, status, products_link_url,
         expires_at, retailer_key, error_code, provider_code, line_count, excluded_count,
         created_by_member_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      row.handoff_id,
      row.shop_list_id,
      row.household_id,
      row.provider_id,
      row.link_type || "shopping_list",
      row.revision_sent,
      row.content_revision_sent,
      row.request_hash,
      row.content_fingerprint,
      row.status,
      row.products_link_url || null,
      row.expires_at || null,
      row.retailer_key || null,
      row.error_code || null,
      row.provider_code || null,
      row.line_count || 0,
      row.excluded_count || 0,
      row.created_by_member_id,
      row.created_at,
      row.updated_at
    )
    .run();
  return row.handoff_id;
}

export async function updateHandoff(db, handoffId, patch) {
  await db
    .prepare(
      `UPDATE grocery_handoff
       SET status = ?, products_link_url = ?, expires_at = ?, error_code = ?, provider_code = ?, updated_at = ?
       WHERE handoff_id = ?`
    )
    .bind(
      patch.status,
      patch.products_link_url || null,
      patch.expires_at || null,
      patch.error_code || null,
      patch.provider_code || null,
      patch.updated_at,
      handoffId
    )
    .run();
}

export async function getHandoff(db, handoffId) {
  const row = await db.prepare(`SELECT * FROM grocery_handoff WHERE handoff_id = ?`).bind(handoffId).first();
  return mapRow(row);
}
