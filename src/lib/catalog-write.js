/**
 * Idempotent catalog writes. A repeat import refreshes child rows and does
 * not insert a second version. A different hash for the same version id is
 * refused by planImport before this runs.
 */

function json(value) {
  return JSON.stringify(value ?? null);
}

async function run(db, sql, ...params) {
  return db.prepare(sql).bind(...params).run();
}

async function all(db, sql, ...params) {
  const res = await db.prepare(sql).bind(...params).all();
  return res.results || [];
}

/**
 * @param {object} db D1-style prepared statements
 */
export async function loadExistingVersions(db) {
  const rows = await all(
    db,
    `SELECT recipe_version_id, content_hash, version_number, dish_id FROM catalog_version`
  );
  return new Map(rows.map((row) => [row.recipe_version_id, row]));
}

async function replaceChildren(db, record) {
  const id = record.recipe_version_id;
  for (const table of [
    "catalog_ingredient",
    "catalog_step",
    "catalog_taste_tag",
    "catalog_dietary_label",
    "catalog_allergen",
    "catalog_equipment",
    "catalog_eligibility_tag",
    "catalog_image_ref",
  ]) {
    await run(db, `DELETE FROM ${table} WHERE recipe_version_id = ?`, id);
  }
  for (const item of record.ingredients) {
    await run(
      db,
      `INSERT INTO catalog_ingredient
        (recipe_version_id, position, ingredient_id, name, display_name, quantity, unit,
         raw_quantity, note, preparation, optional, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      item.position,
      item.ingredient_id,
      item.name,
      item.display_name,
      item.quantity,
      item.unit,
      item.raw_quantity,
      item.note,
      item.preparation,
      item.optional ? 1 : 0,
      item.role
    );
  }
  for (const step of record.steps) {
    await run(
      db,
      `INSERT INTO catalog_step
        (recipe_version_id, step_number, title, body, ingredient_refs_json)
       VALUES (?, ?, ?, ?, ?)`,
      id,
      step.step_number,
      step.title,
      step.body,
      json(step.ingredient_refs)
    );
  }
  for (const slug of record.vocabulary_tag_ids) {
    await run(
      db,
      `INSERT INTO catalog_taste_tag (recipe_version_id, vocabulary_slug) VALUES (?, ?)`,
      id,
      slug
    );
  }
  for (const label of record.dietary_labels) {
    await run(
      db,
      `INSERT INTO catalog_dietary_label (recipe_version_id, label) VALUES (?, ?)`,
      id,
      label
    );
  }
  for (const allergen of record.allergens) {
    await run(
      db,
      `INSERT INTO catalog_allergen (recipe_version_id, allergen) VALUES (?, ?)`,
      id,
      allergen
    );
  }
  for (const item of record.equipment) {
    await run(
      db,
      `INSERT INTO catalog_equipment (recipe_version_id, item) VALUES (?, ?)`,
      id,
      item
    );
  }
  for (const tag of record.eligibility_tags) {
    await run(
      db,
      `INSERT INTO catalog_eligibility_tag (recipe_version_id, tag) VALUES (?, ?)`,
      id,
      tag
    );
  }
  for (const image of record.images) {
    await run(
      db,
      `INSERT INTO catalog_image_ref
        (recipe_version_id, role, path, provenance, rights_state)
       VALUES (?, ?, ?, ?, ?)`,
      id,
      image.role,
      image.path,
      image.provenance,
      image.rights_state
    );
  }
  const provenance = record.provenance;
  await run(db, `DELETE FROM catalog_provenance WHERE recipe_version_id = ?`, id);
  await run(
    db,
    `INSERT INTO catalog_provenance
      (recipe_version_id, certification_class, factory_certified, text_provenance,
       text_provenance_raw, image_provenance, image_rights, kitchen_tested,
       household_cook_count, rating_count, freeze_integrity, gates_a_o, image_gates,
       evidence_basis, package_self_report_json, evidence_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    provenance.certification_class,
    provenance.factory_certified ? 1 : 0,
    provenance.text_provenance ?? null,
    provenance.text_provenance_raw ?? null,
    provenance.image_provenance ?? null,
    provenance.image_rights ?? null,
    provenance.kitchen_tested ? 1 : 0,
    provenance.household_cook_count ?? null,
    provenance.rating_count ?? null,
    provenance.freeze_integrity ?? null,
    provenance.gates_a_o ?? null,
    provenance.image_gates ?? null,
    provenance.evidence_basis ?? null,
    json(provenance.package_self_report || {}),
    provenance.evidence_note ?? null
  );
}

async function upsertDish(db, record, importedAt) {
  const dish = await db
    .prepare(`SELECT current_version_id FROM catalog_dish WHERE dish_id = ?`)
    .bind(record.dish_id)
    .first();
  if (!dish) {
    await run(
      db,
      `INSERT INTO catalog_dish
        (dish_id, slug, title, name, description, cuisine, meal_format, primary_ingredient,
         texture, flavor_profile, effort_band, weeknight, exploration, plate, tone,
         tags_json, sparks_json, chips_json, current_recipe_id, current_version_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.dish_id,
      record.slug,
      record.title,
      record.name,
      record.description,
      record.cuisine,
      record.meal_format,
      record.primary_ingredient,
      record.texture,
      record.flavor_profile,
      record.effort_band,
      record.weeknight,
      record.exploration,
      record.plate,
      record.tone,
      json(record.tags),
      json(record.sparks),
      json(record.chips),
      record.recipe_id,
      record.recipe_version_id,
      importedAt
    );
    return;
  }
  const current = dish.current_version_id
    ? await db
        .prepare(`SELECT version_number FROM catalog_version WHERE recipe_version_id = ?`)
        .bind(dish.current_version_id)
        .first()
    : null;
  const currentNumber = current ? Number(current.version_number) : 0;
  if (record.version_number >= currentNumber) {
    await run(
      db,
      `UPDATE catalog_dish
          SET current_recipe_id = ?, current_version_id = ?
        WHERE dish_id = ?`,
      record.recipe_id,
      record.recipe_version_id,
      record.dish_id
    );
  }
}

/**
 * @param {object} db
 * @param {object[]} records records already accepted by planImport
 * @param {string} importedAt
 */
/**
 * Staging policy: a published v2 retires the superseded v1 row without deleting it.
 * @param {object} db
 * @param {string[]} versionIds
 */
export async function retireCatalogVersions(db, versionIds) {
  for (const versionId of versionIds) {
    if (!versionId) continue;
    await run(
      db,
      `UPDATE catalog_version SET publication_status = 'retired' WHERE recipe_version_id = ?`,
      versionId
    );
  }
}

export async function applyCatalogWrites(db, records, importedAt) {
  await run(db, "BEGIN");
  try {
    for (const record of records) {
      const existing = await db
        .prepare(`SELECT recipe_version_id, content_hash FROM catalog_version WHERE recipe_version_id = ?`)
        .bind(record.recipe_version_id)
        .first();
      if (existing && existing.content_hash !== record.content_hash) {
        throw new Error(`immutable_version_conflict:${record.recipe_version_id}`);
      }
      await run(
        db,
        `INSERT INTO recipe (recipe_id, dish_id, visibility, household_id, created_at)
         VALUES (?, ?, 'global', NULL, ?)
         ON CONFLICT(recipe_id) DO NOTHING`,
        record.recipe_id,
        record.dish_id,
        importedAt
      );
      if (!existing) {
        await run(
          db,
          `INSERT INTO catalog_version
            (recipe_version_id, recipe_id, dish_id, version_number, title, description, base_servings,
             prep_minutes, cook_minutes, total_minutes, effort, heat, doneness, methods_json,
             dietary_tags_json, substitutions_json, components_json, publication_status,
             artifact_publication_status, visibility, household_id, content_hash, source_contract,
             source_path, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'global', NULL, ?, ?, ?, ?)`,
          record.recipe_version_id,
          record.recipe_id,
          record.dish_id,
          record.version_number,
          record.version_title,
          record.version_description,
          record.base_servings,
          record.prep_minutes,
          record.cook_minutes,
          record.total_minutes,
          record.effort,
          record.heat,
          record.doneness,
          json(record.methods),
          json(record.dietary_tags),
          json(record.substitutions),
          json(record.components),
          record.publication_status,
          record.artifact_publication_status,
          record.content_hash,
          record.source_contract,
          record.source_path,
          importedAt
        );
      }
      await upsertDish(db, record, importedAt);
      await replaceChildren(db, record);
    }
    await run(db, "COMMIT");
  } catch (error) {
    try {
      await run(db, "ROLLBACK");
    } catch {
      /* the original error is the one to surface */
    }
    throw error;
  }
  return { written: records.length };
}
