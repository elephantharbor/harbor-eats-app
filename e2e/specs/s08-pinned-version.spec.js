// @ts-check
/**
 * A plan pinned to salmon v2 still shows v2 after a newer version is published.
 * The local e2e catalog has v2 published and no v3, so this spec inserts v3
 * for the duration of the test and puts v2 back.
 */
import { expect, test } from "@playwright/test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { skipToChoices } from "./helpers.js";
import { openPlanReviewFromHome } from "./alpha-helpers.js";

const V2 = "rv_maple-mustard-glazed-salmon_v2";
const V3 = "rv_maple-mustard-glazed-salmon_v3";
const DISH = "maple-mustard-glazed-salmon";
const CHILD_TABLES = [
  "catalog_ingredient",
  "catalog_step",
  "catalog_taste_tag",
  "catalog_dietary_label",
  "catalog_allergen",
  "catalog_equipment",
  "catalog_eligibility_tag",
  "catalog_image_ref",
  "catalog_provenance",
  "catalog_classification_history",
];

function openCatalog() {
  const base = join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const files = readdirSync(base).filter((file) => file.endsWith(".sqlite") && file !== "metadata.sqlite");
  for (const file of files) {
    const database = new DatabaseSync(join(base, file));
    database.exec("PRAGMA busy_timeout = 8000");
    const ready = database.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'catalog_version'").get();
    const salmon = ready
      ? database.prepare("SELECT recipe_version_id FROM catalog_version WHERE recipe_version_id = ?").get(V2)
      : null;
    if (salmon) return database;
    database.close();
  }
  throw new Error("local D1 has no salmon v2 row");
}

function restoreSalmon(database) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const table of CHILD_TABLES) {
      const exists = database.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      if (exists) database.prepare(`DELETE FROM ${table} WHERE recipe_version_id = ?`).run(V3);
    }
    database.prepare("DELETE FROM catalog_version WHERE recipe_version_id = ?").run(V3);
    database.prepare("UPDATE catalog_version SET publication_status = 'published' WHERE recipe_version_id = ?").run(V2);
    database.prepare("UPDATE catalog_dish SET current_version_id = ? WHERE dish_id = ?").run(V2, DISH);
    database.exec("COMMIT");
    database.exec("PRAGMA wal_checkpoint(PASSIVE)");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* already closed */
    }
    throw error;
  }
}

function promoteSalmon(database) {
  const cols = database.prepare("PRAGMA table_info(catalog_version)").all().map((column) => column.name);
  const row = database.prepare("SELECT * FROM catalog_version WHERE recipe_version_id = ?").get(V2);
  if (!row) throw new Error("salmon v2 missing");
  const copy = {
    ...row,
    recipe_version_id: V3,
    version_number: 3,
    publication_status: "published",
    content_hash: `${row.content_hash}-s08e2e`,
    source_path: String(row.source_path || "").replace(/v2\.json$/, "v3.json"),
  };
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(`INSERT INTO catalog_version (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`)
      .run(...cols.map((column) => copy[column]));
    for (const table of ["catalog_taste_tag", "catalog_dietary_label", "catalog_allergen", "catalog_equipment", "catalog_eligibility_tag", "catalog_image_ref", "catalog_provenance"]) {
      const names = database.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
      const rows = database.prepare(`SELECT * FROM ${table} WHERE recipe_version_id = ?`).all(V2);
      const insert = database.prepare(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`);
      for (const child of rows) {
        const next = { ...child, recipe_version_id: V3 };
        insert.run(...names.map((name) => next[name]));
      }
    }
    const ingredients = database.prepare("SELECT * FROM catalog_ingredient WHERE recipe_version_id = ? ORDER BY position").all(V2);
    const ingredientCols = database.prepare("PRAGMA table_info(catalog_ingredient)").all().map((column) => column.name);
    const insertIngredient = database.prepare(
      `INSERT INTO catalog_ingredient (${ingredientCols.join(", ")}) VALUES (${ingredientCols.map(() => "?").join(", ")})`
    );
    for (const item of ingredients) {
      insertIngredient.run(...ingredientCols.map((name) => (name === "recipe_version_id" ? V3 : item[name])));
    }
    const nextPosition = ingredients.length;
    for (const [offset, item] of [
      ["fresh dill", "2 tbsp", 2, "tbsp"],
      ["olive oil", "1 tbsp", 1, "tbsp"],
    ].entries()) {
      const [name, raw, quantity, unit] = item;
      insertIngredient.run(
        ...ingredientCols.map((column) => {
          if (column === "recipe_version_id") return V3;
          if (column === "position") return nextPosition + offset;
          if (column === "name" || column === "display_name") return name;
          if (column === "quantity") return quantity;
          if (column === "unit") return unit;
          if (column === "raw_quantity") return raw;
          if (column === "optional") return 0;
          return null;
        })
      );
    }
    const steps = database.prepare("SELECT * FROM catalog_step WHERE recipe_version_id = ? ORDER BY step_number").all(V2);
    const stepCols = database.prepare("PRAGMA table_info(catalog_step)").all().map((column) => column.name);
    const insertStep = database.prepare(`INSERT INTO catalog_step (${stepCols.join(", ")}) VALUES (${stepCols.map(() => "?").join(", ")})`);
    for (const step of steps) {
      const body =
        step.step_number === 1
          ? "Heat the oven to 400 F. Mix the Dijon and the maple syrup. Brush it on the salmon and the asparagus. Scatter the fresh dill and the olive oil."
          : step.body;
      insertStep.run(...stepCols.map((column) => (column === "recipe_version_id" ? V3 : column === "body" ? body : step[column])));
    }
    database.prepare("UPDATE catalog_version SET publication_status = 'retired' WHERE recipe_version_id = ?").run(V2);
    database.prepare("UPDATE catalog_dish SET current_version_id = ? WHERE dish_id = ?").run(V3, DISH);
    database.exec("COMMIT");
    database.exec("PRAGMA wal_checkpoint(PASSIVE)");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      /* already closed */
    }
    throw error;
  }
}

async function createPinnedPlan(page) {
  return page.evaluate(async (versionId) => {
    const me = await fetch("/api/sessions/me", { credentials: "include" }).then((response) => response.json());
    const memberId = me.session?.member_id || me.member_id;
    if (!memberId) throw new Error("no member");
    const created = await fetch("/api/dinner-plans", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meal_count: 2,
        entry_point: "plan_dinners",
        participant_ids: [memberId],
        meals: [
          { kind: "recipe", recipe_version_id: versionId, participant_ids: [memberId] },
          { kind: "recipe", recipe_version_id: versionId, participant_ids: [memberId] },
        ],
      }),
    }).then((response) => response.json());
    if (!created.ok) throw new Error("create plan failed: " + JSON.stringify(created));
    return {
      dinner_plan_id: created.plan.dinner_plan_id,
      meals: created.plan.meals.map((meal) => meal.meal_id),
    };
  }, V2);
}

test("a plan pinned to salmon v2 stays on v2 after v3 is published", async ({ page }) => {
  test.setTimeout(180000);
  let database = openCatalog();
  try {
    restoreSalmon(database);
  } finally {
    database.close();
  }
  try {
    await page.goto("/");
    await skipToChoices(page);
    const plan = await createPinnedPlan(page);
    database = openCatalog();
    try {
      promoteSalmon(database);
    } finally {
      database.close();
    }

    const latest = await page.evaluate(async (slug) => {
      const response = await fetch("/api/recipes/" + slug, { credentials: "include" });
      return response.json();
    }, DISH);
    expect(latest.recipe.recipe_version_id).toBe(V3);
    expect(latest.recipe.ingredients.map((item) => item.name)).toContain("fresh dill");

    await page.goto("/");
    await openPlanReviewFromHome(page);
    await page.locator(`[data-action='open-plan-meal'][data-meal-id='${plan.meals[0]}']`).filter({ visible: true }).first().click();
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
    await expect(page.locator("#detailIngredients")).toContainText("salmon fillets");
    await expect(page.locator("#detailIngredients")).not.toContainText("fresh dill");
    await expect(page.locator("#detailSteps")).toContainText("No oil is listed");

    const beganCook = page.waitForResponse(
      (response) => response.url().includes("/mutations") && (response.request().postData() || "").includes("begin_cook")
    );
    await page.locator("#btnStartCook").click();
    await beganCook;
    await expect(page.locator(".view.is-active[data-view='cook']")).toBeVisible();
    await expect(page.locator("#cookStepBody")).toContainText("No oil is listed");
    await expect(page.locator("#cookStepBody")).not.toContainText("fresh dill");
    const leftCook = page.waitForResponse(
      (response) => response.url().includes("/mutations") && (response.request().postData() || "").includes("exit_cook")
    );
    await page.locator("#btnExitCook").click();
    await expect(page.locator("#confirmDialog")).toBeVisible();
    await page.locator("#confirmOk").click();
    await leftCook;

    const shopBefore = await page.evaluate(async (planId) => {
      const response = await fetch("/api/dinner-plans/" + planId + "/shopping", { credentials: "include" });
      return response.json();
    }, plan.dinner_plan_id);
    expect(shopBefore.lines.map((line) => line.display_name).join("\n")).not.toMatch(/dill/i);

    await page.locator("[data-go='home'][data-nav='home']").filter({ visible: true }).first().click();
    await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
    await expect(page.locator(".view.is-active[data-view='shopList']")).toBeVisible();
    await expect(page.locator(".view.is-active[data-view='shopList']")).not.toContainText(/dill/i);

    const cooked = await page.evaluate(async ({ planId, mealId }) => {
      const post = (body) =>
        fetch("/api/dinner-plans/" + planId + "/mutations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((response) => response.json());
      const began = await post({ op: "begin_cook", meal_id: mealId });
      if (!began.ok) return began;
      const finished = await post({ op: "finish_cook", meal_id: mealId });
      if (!finished.ok) return finished;
      return post({ op: "rate_meal", meal_id: mealId, score: 6 });
    }, { planId: plan.dinner_plan_id, mealId: plan.meals[0] });
    expect(cooked.ok, JSON.stringify(cooked)).toBe(true);
    const rated = cooked.plan.meals.find((meal) => meal.meal_id === plan.meals[0]);
    expect(rated.cooked_recipe_version_id).toBe(V2);
    expect(rated.ratings[0].recipe_version_id).toBe(V2);

    const adopted = await page.evaluate(async ({ planId, mealId, versionId }) => {
      const response = await fetch("/api/dinner-plans/" + planId + "/mutations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "adopt_version", meal_id: mealId, recipe_version_id: versionId }),
      });
      return response.json();
    }, { planId: plan.dinner_plan_id, mealId: plan.meals[1], versionId: V3 });
    expect(adopted.ok, JSON.stringify(adopted)).toBe(true);

    await page.goto("/");
    await page.locator("[data-go='home'][data-nav='home']").filter({ visible: true }).first().click();
    await page.locator("[data-go='shopList']").filter({ visible: true }).first().click();
    await expect(page.locator(".view.is-active[data-view='shopList']")).toContainText(/\bdill\b/i);
    await page.getByRole("button", { name: /more for dill/i }).click();
    await page.locator("[data-action='shop-view-recipe']").click();
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
    await expect(page.locator("#detailIngredients")).toContainText("fresh dill");
    await expect(page.locator("#detailSteps")).toContainText("fresh dill");
    await expect(page.locator("#detailSteps")).not.toContainText("No oil is listed");
    await page.locator("#btnStartCook").click();
    await expect(page.locator("#cookStepBody")).toContainText("fresh dill");
    await expect(page.locator("#cookStepBody")).not.toContainText("No oil is listed");

    const shopAfter = await page.evaluate(async (planId) => {
      const response = await fetch("/api/dinner-plans/" + planId + "/shopping", { credentials: "include" });
      return response.json();
    }, plan.dinner_plan_id);
    expect(shopAfter.lines.map((line) => line.display_name).join("\n")).toMatch(/dill/i);

    const selected = await page.evaluate(async (versionId) => {
      const me = await fetch("/api/sessions/me", { credentials: "include" }).then((response) => response.json());
      const memberId = me.session?.member_id || me.member_id;
      const response = await fetch("/api/dinner-plans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meal_count: 1,
          entry_point: "plan_dinners",
          participant_ids: [memberId],
          meals: [{ kind: "recipe", recipe_version_id: versionId, participant_ids: [memberId] }],
        }),
      });
      return response.json();
    }, V3);
    expect(selected.ok, JSON.stringify(selected)).toBe(true);
    expect(selected.plan.meals[0].recipe_version_id).toBe(V3);
    expect(selected.plan.meals[0].pinned_ingredients.map((item) => item.name)).toContain("fresh dill");
    expect(selected.plan.shop_lines.map((line) => line.display_name).join("\n")).toMatch(/dill/i);
  } finally {
    const cleanup = openCatalog();
    try {
      restoreSalmon(cleanup);
    } finally {
      cleanup.close();
    }
  }
});
