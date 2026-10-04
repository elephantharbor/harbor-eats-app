import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { renderStagingD1Sql, splitStagingD1Statements } from "../src/lib/catalog-staging-sql.js";
import { applyCatalogWrites, loadExistingVersions, retireCatalogVersions } from "../src/lib/catalog-write.js";
import { planImport } from "../src/lib/catalog-import.js";
import { loadCatalogRecordsForTest } from "./helpers/catalog-import-fixture.js";

const importedAt = "2026-10-04T00:00:00.000Z";
const MUSHROOM_V2 = "rv_mushroom-walnut-bolognese_v2";

function applyMigrations(database) {
  database.exec("PRAGMA foreign_keys = ON;");
  const dir = join(process.cwd(), "migrations");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, name), "utf8"));
  }
}

function sqliteShim(database) {
  return {
    prepare(sql) {
      const stmt = database.prepare(sql);
      return {
        bind(...params) {
          return {
            run: async () => {
              stmt.run(...params);
              return { success: true };
            },
            first: async () => stmt.get(...params) || null,
            all: async () => ({ results: stmt.all(...params) }),
          };
        },
      };
    },
  };
}

async function importCatalogTo(database) {
  const { records, retireVersionIds } = loadCatalogRecordsForTest();
  const shim = sqliteShim(database);
  const plan = planImport(await loadExistingVersions(shim), records);
  expect(plan.ok).toBe(true);
  await applyCatalogWrites(shim, plan.writes, importedAt);
  if (retireVersionIds.length) {
    await retireCatalogVersions(shim, [...new Set(retireVersionIds)]);
  }
  return records;
}

function copyRecipeRows(from, to) {
  const rows = from.prepare("SELECT recipe_id, dish_id, visibility, household_id, created_at FROM recipe").all();
  for (const row of rows) {
    to.prepare(
      `INSERT INTO recipe (recipe_id, dish_id, visibility, household_id, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(recipe_id) DO NOTHING`
    ).run(row.recipe_id, row.dish_id, row.visibility, row.household_id, row.created_at);
  }
}

describe("staging catalog D1 SQL", () => {
  it("keeps every ingredient and step when statements run in file order", async () => {
    const source = new DatabaseSync(":memory:");
    applyMigrations(source);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "catalog/mushroom-walnut-bolognese/v2.json"), "utf8"));
    const expectedIngredients = pkg.recipe_version.ingredients.length;
    const expectedSteps = pkg.recipe_version.steps.length;

    await importCatalogTo(source);
    const sql = renderStagingD1Sql(source);
    const deleteLines = sql
      .split("\n")
      .filter((line) => line.includes(`DELETE FROM catalog_ingredient WHERE recipe_version_id = '${MUSHROOM_V2}'`));
    expect(deleteLines).toHaveLength(1);

    const target = new DatabaseSync(":memory:");
    applyMigrations(target);
    copyRecipeRows(source, target);
    for (const statement of splitStagingD1Statements(sql)) {
      target.exec(`${statement};`);
    }

    const ingredientCount = target
      .prepare(`SELECT COUNT(*) AS c FROM catalog_ingredient WHERE recipe_version_id = ?`)
      .get(MUSHROOM_V2).c;
    const stepCount = target
      .prepare(`SELECT COUNT(*) AS c FROM catalog_step WHERE recipe_version_id = ?`)
      .get(MUSHROOM_V2).c;
    const tasteCount = target
      .prepare(`SELECT COUNT(*) AS c FROM catalog_taste_tag WHERE recipe_version_id = ?`)
      .get(MUSHROOM_V2).c;

    expect(ingredientCount).toBe(expectedIngredients);
    expect(stepCount).toBe(expectedSteps);
    expect(tasteCount).toBeGreaterThan(0);

    const dish = target.prepare(`SELECT tags_json FROM catalog_dish WHERE dish_id = ?`).get("mushroom-walnut-bolognese");
    const tags = JSON.parse(dish.tags_json);
    expect(tags).toEqual(["plant", "dairy-free"]);
    expect(tags).not.toContain("nuts");
    expect(tags).not.toContain("walnut");
  });
});
