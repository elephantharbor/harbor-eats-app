/**
 * The recipe and cook screens load a plan's recipe_version_id, including a retired one.
 * resolvedRecipe is not that path.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { loadCatalogFromDisk } from "../src/lib/catalog-disk.js";
import { planImport } from "../src/lib/catalog-import.js";
import { applyCatalogWrites, loadExistingVersions, retireCatalogVersions } from "../src/lib/catalog-write.js";
import { createMemberSession } from "../src/lib/session.js";

const V2 = "rv_maple-mustard-glazed-salmon_v2";
const V3 = "rv_maple-mustard-glazed-salmon_v3";
const DISH = "maple-mustard-glazed-salmon";
const PRIVATE = "rv_maple-mustard-glazed-salmon_v99";

function sqliteShim(database) {
  function statement(sql, params) {
    return {
      sql,
      params,
      async run() {
        const result = database.prepare(sql).run(...params);
        return { success: true, meta: { changes: result.changes } };
      },
      async first() {
        return database.prepare(sql).get(...params) ?? null;
      },
      async all() {
        return { results: database.prepare(sql).all(...params) };
      },
    };
  }
  return {
    prepare(sql) {
      return {
        ...statement(sql, []),
        bind(...params) {
          return statement(sql, params);
        },
      };
    },
    async batch(statements) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const stmt of statements) {
          results.push(/^\s*(select|with)\b/i.test(stmt.sql || "") ? await stmt.all() : await stmt.run());
        }
        database.exec("COMMIT");
        return results;
      } catch (error) {
        try {
          database.exec("ROLLBACK");
        } catch {
          /* already closed */
        }
        throw error;
      }
    },
  };
}

function applyMigrations(database) {
  database.exec("PRAGMA foreign_keys = ON;");
  const dir = join(process.cwd(), "migrations");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, name), "utf8"));
  }
}

async function importCatalog(database) {
  const root = join(process.cwd(), "catalog");
  const stagingPolicy = JSON.parse(readFileSync(join(root, "staging-publication.json"), "utf8"));
  const loaded = loadCatalogFromDisk(root, stagingPolicy);
  expect(loaded.failures, JSON.stringify(loaded.failures, null, 2)).toEqual([]);
  const shim = sqliteShim(database);
  const existing = await loadExistingVersions(shim);
  const plan = planImport(existing, loaded.records);
  expect(plan.ok, JSON.stringify(plan.errors)).toBe(true);
  await applyCatalogWrites(shim, plan.writes, "2026-10-18T00:00:00.000Z");
  await retireCatalogVersions(shim, [...new Set(loaded.retireVersionIds)]);
}

function publishSalmon(database, versionId) {
  const retire = versionId === V2 ? V3 : V2;
  database.prepare("UPDATE catalog_version SET publication_status = 'retired' WHERE recipe_version_id = ?").run(retire);
  database.prepare("UPDATE catalog_version SET publication_status = 'published' WHERE recipe_version_id = ?").run(versionId);
  database.prepare("UPDATE catalog_dish SET current_version_id = ? WHERE dish_id = ?").run(versionId, DISH);
}

function seedHousehold(database, householdId, memberId) {
  database
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES (?, ?, 'active', 'America/Chicago', 2, 'synthetic_qa', '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z', 'synthetic')`
    )
    .run(householdId, `[synthetic] ${householdId}`);
  database
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', 'active', '2026-10-18T00:00:00Z', '2026-10-18T00:00:00Z')`
    )
    .run(memberId, householdId, memberId);
}

function insertPrivateVersion(database, householdId) {
  const cols = database.prepare("PRAGMA table_info(catalog_version)").all().map((column) => column.name);
  const row = database.prepare("SELECT * FROM catalog_version WHERE recipe_version_id = ?").get(V2);
  const copy = {
    ...row,
    recipe_version_id: PRIVATE,
    version_number: 99,
    publication_status: "draft",
    visibility: "household",
    household_id: householdId,
    content_hash: "private-s08-pin",
    source_path: "test/s08-pinned-version",
  };
  database
    .prepare(`INSERT INTO catalog_version (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
    .run(...cols.map((column) => copy[column]));
  database
    .prepare(
      `INSERT INTO catalog_step (recipe_version_id, step_number, title, body, ingredient_refs_json)
       VALUES (?, 1, 'Private', 'private household step', '[]')`
    )
    .run(PRIVATE);
}

function names(recipe) {
  return (recipe?.ingredients || []).map((item) => item.name);
}

function steps(recipe) {
  return (recipe?.steps || []).map((step) => step.body).join("\n");
}

describe("S-08 pinned recipe version", () => {
  it("keeps a v2 plan on v2 after v3 is published, and adopt_version moves recipe, shopping, and cook together", async () => {
    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    await importCatalog(database);
    publishSalmon(database, V2);
    seedHousehold(database, "hh_s08_pin", "m_s08");
    seedHousehold(database, "hh_s08_other", "m_other");
    insertPrivateVersion(database, "hh_s08_other");
    const db = sqliteShim(database);
    const env = { DB: db, CATALOG_SOURCE: "d1" };
    const auth = await createMemberSession(db, { household_id: "hh_s08_pin", member_id: "m_s08" }, { secure: false });
    const other = await createMemberSession(db, { household_id: "hh_s08_other", member_id: "m_other" }, { secure: false });

    async function call(path, { method = "GET", token = auth.session_token, body } = {}) {
      const res = await worker.fetch(
        new Request(new URL(`https://fw.test${path}`), {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        }),
        env
      );
      const text = await res.text();
      let parsed = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = { raw: text };
      }
      return { status: res.status, body: parsed };
    }

    const created = await call("/api/dinner-plans", {
      method: "POST",
      body: {
        meal_count: 2,
        entry_point: "plan_dinners",
        participant_ids: ["m_s08"],
        meals: [
          { kind: "recipe", recipe_version_id: V2, participant_ids: ["m_s08"] },
          { kind: "recipe", recipe_version_id: V2, participant_ids: ["m_s08"] },
        ],
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const planId = created.body.plan.dinner_plan_id;
    const [cookedMeal, adoptedMeal] = created.body.plan.meals;
    expect(cookedMeal.recipe_version_id).toBe(V2);
    expect(names({ ingredients: cookedMeal.pinned_ingredients })).not.toContain("fresh dill");

    publishSalmon(database, V3);

    const pinned = await call(`/api/recipes/version/${V2}`);
    expect(pinned.status, JSON.stringify(pinned.body)).toBe(200);
    expect(pinned.body.recipe.recipe_version_id).toBe(V2);
    expect(names(pinned.body.recipe)).not.toContain("fresh dill");
    expect(names(pinned.body.recipe)).not.toContain("olive oil");
    expect(steps(pinned.body.recipe)).toContain("No oil is listed");

    const anonymous = await call(`/api/recipes/version/${V2}`, { token: null });
    expect(anonymous.status).toBe(401);

    const latest = await call(`/api/recipes/${DISH}`, { token: null });
    expect(latest.status).toBe(200);
    expect(latest.body.recipe.recipe_version_id).toBe(V3);
    expect(names(latest.body.recipe)).toContain("fresh dill");

    const published = await call(`/api/recipes/version/${V3}`, { token: null });
    expect(published.status).toBe(200);
    expect(names(published.body.recipe)).toContain("fresh dill");

    const hidden = await call(`/api/recipes/version/${PRIVATE}`);
    expect(hidden.status).toBe(404);
    const owned = await call(`/api/recipes/version/${PRIVATE}`, { token: other.session_token });
    expect(owned.status).toBe(200);
    expect(steps(owned.body.recipe)).toContain("private household step");

    const shopBefore = await call(`/api/dinner-plans/${planId}/shopping`);
    expect(shopBefore.status).toBe(200);
    expect(shopBefore.body.lines.map((line) => line.display_name).join("\n")).not.toMatch(/dill/i);

    const began = await call(`/api/dinner-plans/${planId}/mutations`, {
      method: "POST",
      body: { op: "begin_cook", meal_id: cookedMeal.meal_id },
    });
    expect(began.status, JSON.stringify(began.body)).toBe(200);
    const finished = await call(`/api/dinner-plans/${planId}/mutations`, {
      method: "POST",
      body: { op: "finish_cook", meal_id: cookedMeal.meal_id },
    });
    expect(finished.status, JSON.stringify(finished.body)).toBe(200);
    const rated = await call(`/api/dinner-plans/${planId}/mutations`, {
      method: "POST",
      body: { op: "rate_meal", meal_id: cookedMeal.meal_id, score: 6 },
    });
    expect(rated.status, JSON.stringify(rated.body)).toBe(200);
    const cooked = rated.body.plan.meals.find((meal) => meal.meal_id === cookedMeal.meal_id);
    expect(cooked.recipe_version_id).toBe(V2);
    expect(cooked.cooked_recipe_version_id).toBe(V2);
    expect(cooked.ratings[0].recipe_version_id).toBe(V2);
    expect(names({ ingredients: cooked.pinned_ingredients })).not.toContain("fresh dill");

    const adopted = await call(`/api/dinner-plans/${planId}/mutations`, {
      method: "POST",
      body: { op: "adopt_version", meal_id: adoptedMeal.meal_id, recipe_version_id: V3 },
    });
    expect(adopted.status, JSON.stringify(adopted.body)).toBe(200);
    const moved = adopted.body.plan.meals.find((meal) => meal.meal_id === adoptedMeal.meal_id);
    expect(moved.recipe_version_id).toBe(V3);
    expect(names({ ingredients: moved.pinned_ingredients })).toContain("fresh dill");
    expect(moved.pinned_steps.map((step) => step.body).join("\n")).not.toContain("No oil is listed");

    const shopAfter = await call(`/api/dinner-plans/${planId}/shopping`);
    expect(shopAfter.body.lines.map((line) => line.display_name).join("\n")).toMatch(/dill/i);

    const cookVersion = await call(`/api/recipes/version/${moved.recipe_version_id}`);
    expect(cookVersion.body.recipe.recipe_version_id).toBe(V3);
    expect(names(cookVersion.body.recipe)).toContain("fresh dill");
    expect(steps(cookVersion.body.recipe)).not.toContain("No oil is listed");

    const beganNext = await call(`/api/dinner-plans/${planId}/mutations`, {
      method: "POST",
      body: { op: "begin_cook", meal_id: adoptedMeal.meal_id },
    });
    expect(beganNext.status, JSON.stringify(beganNext.body)).toBe(200);
    const finishedNext = await call(`/api/dinner-plans/${planId}/mutations`, {
      method: "POST",
      body: { op: "finish_cook", meal_id: adoptedMeal.meal_id },
    });
    expect(finishedNext.status, JSON.stringify(finishedNext.body)).toBe(200);
    const ratedNext = await call(`/api/dinner-plans/${planId}/mutations`, {
      method: "POST",
      body: { op: "rate_meal", meal_id: adoptedMeal.meal_id, score: 8 },
    });
    expect(ratedNext.status, JSON.stringify(ratedNext.body)).toBe(200);
    const cookedNext = ratedNext.body.plan.meals.find((meal) => meal.meal_id === adoptedMeal.meal_id);
    expect(cookedNext.cooked_recipe_version_id).toBe(V3);
    expect(cookedNext.ratings[0].recipe_version_id).toBe(V3);

    const selected = await call("/api/dinner-plans", {
      method: "POST",
      body: {
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: ["m_s08"],
        meals: [{ kind: "recipe", recipe_version_id: V3, participant_ids: ["m_s08"] }],
      },
    });
    expect(selected.status, JSON.stringify(selected.body)).toBe(201);
    expect(selected.body.plan.meals[0].recipe_version_id).toBe(V3);
    expect(names({ ingredients: selected.body.plan.meals[0].pinned_ingredients })).toContain("fresh dill");
    expect(selected.body.plan.shop_lines.map((line) => line.display_name).join("\n")).toMatch(/dill/i);
  }, 120000);
});
