/**
 * D1 persistence for the household shopping list.
 * Writes are one batch. The first statement aborts the batch when revision
 * is stale, so two shoppers cannot both commit the same version.
 */

import { emptyHouseholdList } from "./household-shop.js";

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function first(db, sql, params = []) {
  return db.prepare(sql).bind(...params).first();
}

async function all(db, sql, params = []) {
  const result = await db.prepare(sql).bind(...params).all();
  return result?.results || [];
}

function lineFromRow(row, requirements) {
  return {
    line_id: row.line_id,
    ingredient_id: row.ingredient_id,
    general_key: row.general_key,
    display_name: row.display_name,
    name_custom: row.name_custom ? 1 : 0,
    preparation: row.preparation,
    unit: row.unit,
    quantity_required: row.quantity_required,
    quantity_manual: row.quantity_manual,
    quantity_override: row.quantity_override,
    override_basis: row.override_basis,
    override_stale: row.override_stale ? 1 : 0,
    reconcile_note: row.reconcile_note,
    list_state: row.list_state,
    still_needed: row.still_needed ? 1 : 0,
    surplus_quantity: row.surplus_quantity || 0,
    meal_ids: parseJson(row.meal_ids_json, []),
    recipe_version_ids: parseJson(row.recipe_version_ids_json, []),
    category: row.category || "other",
    category_custom: row.category_custom ? 1 : 0,
    unparsed: row.unparsed ? 1 : 0,
    note: row.note,
    requirements,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function requirementFromRow(row) {
  return {
    requirement_id: row.requirement_id,
    origin: row.origin,
    dinner_plan_id: row.dinner_plan_id,
    plan_line_id: row.plan_line_id,
    meal_ids: parseJson(row.meal_ids_json, []),
    recipe_version_ids: parseJson(row.recipe_version_ids_json, []),
    quantity: row.quantity,
    unit: row.unit,
    still_needed: row.still_needed ? 1 : 0,
    source_key: row.source_key,
    client_request_id: row.client_request_id,
    display_name: row.display_name,
    preparation: row.preparation,
  };
}

export async function loadOpenList(db, householdId) {
  const parent = await first(
    db,
    `SELECT shop_list_id, household_id, status, revision, content_revision, dinner_plan_id,
            trip_method, created_at, updated_at
     FROM household_shop_list
     WHERE household_id = ? AND status = 'open'`,
    [householdId]
  );
  if (!parent) return null;
  const [lineRows, reqRows] = await Promise.all([
    all(
      db,
      `SELECT line_id, shop_list_id, ingredient_id, general_key, display_name, name_custom,
              preparation, unit, quantity_required, quantity_manual, quantity_override, override_basis,
              override_stale, reconcile_note, list_state, still_needed, surplus_quantity,
              meal_ids_json, recipe_version_ids_json, category, category_custom, unparsed, note,
              created_at, updated_at
       FROM household_shop_line WHERE shop_list_id = ?`,
      [parent.shop_list_id]
    ),
    all(
      db,
      `SELECT requirement_id, line_id, shop_list_id, origin, dinner_plan_id, plan_line_id,
              meal_ids_json, recipe_version_ids_json, quantity, unit, still_needed, source_key,
              client_request_id, display_name, preparation
       FROM household_shop_requirement WHERE shop_list_id = ?`,
      [parent.shop_list_id]
    ),
  ]);
  const byLine = new Map();
  for (const row of reqRows) {
    if (!byLine.has(row.line_id)) byLine.set(row.line_id, []);
    byLine.get(row.line_id).push(requirementFromRow(row));
  }
  return {
    shop_list_id: parent.shop_list_id,
    household_id: parent.household_id,
    status: parent.status,
    revision: parent.revision,
    content_revision: parent.content_revision,
    dinner_plan_id: parent.dinner_plan_id,
    trip_method: parent.trip_method,
    created_at: parent.created_at,
    updated_at: parent.updated_at,
    lines: lineRows.map((row) => lineFromRow(row, byLine.get(row.line_id) || [])),
  };
}

export function newListId() {
  return `hsl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export async function insertOpenList(db, householdId, now) {
  const list = emptyHouseholdList({
    shop_list_id: newListId(),
    household_id: householdId,
    now,
  });
  await db
    .prepare(
      `INSERT INTO household_shop_list
        (shop_list_id, household_id, status, revision, content_revision, dinner_plan_id, trip_method, created_at, updated_at)
       VALUES (?, ?, 'open', 1, 1, NULL, NULL, ?, ?)`
    )
    .bind(list.shop_list_id, householdId, now, now)
    .run();
  return list;
}

function statementsFor(db, list, expectedRevision, contentChanged) {
  const nextRevision = expectedRevision + 1;
  const nextContent = contentChanged ? Number(list.content_revision || 1) + 1 : Number(list.content_revision || 1);
  const stmts = [];
  const add = (sql, params) => stmts.push(db.prepare(sql).bind(...params));
  add(
    `INSERT OR REPLACE INTO household_shop_cas (shop_list_id, token)
     VALUES (
       (SELECT shop_list_id FROM household_shop_list WHERE shop_list_id = ? AND revision = ?),
       ?
     )`,
    [list.shop_list_id, expectedRevision, String(nextRevision)]
  );
  add(
    `UPDATE household_shop_list
     SET revision = ?, content_revision = ?, dinner_plan_id = ?, trip_method = ?, updated_at = ?
     WHERE shop_list_id = ? AND revision = ?`,
    [
      nextRevision,
      nextContent,
      list.dinner_plan_id,
      list.trip_method,
      list.updated_at,
      list.shop_list_id,
      expectedRevision,
    ]
  );
  add(`DELETE FROM household_shop_requirement WHERE shop_list_id = ?`, [list.shop_list_id]);
  add(`DELETE FROM household_shop_line WHERE shop_list_id = ?`, [list.shop_list_id]);
  for (const line of list.lines || []) {
    add(
      `INSERT INTO household_shop_line
        (line_id, shop_list_id, ingredient_id, general_key, display_name, name_custom, preparation, unit,
         quantity_required, quantity_manual, quantity_override, override_basis, override_stale, reconcile_note,
         list_state, still_needed, surplus_quantity, meal_ids_json, recipe_version_ids_json, category,
         category_custom, unparsed, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        line.line_id,
        list.shop_list_id,
        line.ingredient_id,
        line.general_key,
        line.display_name,
        line.name_custom ? 1 : 0,
        line.preparation,
        line.unit,
        line.quantity_required,
        line.quantity_manual,
        line.quantity_override,
        line.override_basis,
        line.override_stale ? 1 : 0,
        line.reconcile_note,
        line.list_state || "open",
        line.still_needed ? 1 : 0,
        line.surplus_quantity || 0,
        JSON.stringify(line.meal_ids || []),
        JSON.stringify(line.recipe_version_ids || []),
        line.category || "other",
        line.category_custom ? 1 : 0,
        line.unparsed ? 1 : 0,
        line.note,
        line.created_at || list.updated_at,
        line.updated_at || list.updated_at,
      ]
    );
    for (const req of line.requirements || []) {
      add(
        `INSERT INTO household_shop_requirement
          (requirement_id, line_id, shop_list_id, origin, dinner_plan_id, plan_line_id, meal_ids_json,
           recipe_version_ids_json, quantity, unit, still_needed, source_key, client_request_id,
           display_name, preparation, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.requirement_id,
          line.line_id,
          list.shop_list_id,
          req.origin,
          req.dinner_plan_id,
          req.plan_line_id,
          JSON.stringify(req.meal_ids || []),
          JSON.stringify(req.recipe_version_ids || []),
          req.quantity,
          req.unit || line.unit,
          req.still_needed ? 1 : 0,
          req.source_key,
          req.client_request_id,
          req.display_name,
          req.preparation,
          list.updated_at,
          list.updated_at,
        ]
      );
    }
  }
  return { stmts, nextRevision, nextContent };
}

export async function commitList(db, list, expectedRevision, contentChanged) {
  if (typeof db.batch !== "function") {
    throw new Error("household_shop_save_requires_transaction");
  }
  const prepared = statementsFor(db, list, expectedRevision, contentChanged);
  try {
    await db.batch(prepared.stmts);
    list.revision = prepared.nextRevision;
    list.content_revision = prepared.nextContent;
    return { ok: true, list };
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("household_shop_cas") || message.includes("NOT NULL constraint failed")) {
      return { ok: false, error: "revision_conflict", status: 409 };
    }
    if (message.includes("client_request_id") || message.includes("idx_household_shop_requirement_client")) {
      return { ok: false, error: "duplicate_request", status: 409 };
    }
    throw error;
  }
}

export function isActiveMember(row) {
  return !!row && row.status === "active";
}
