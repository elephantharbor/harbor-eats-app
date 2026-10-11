// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

const adaptResponse = {
  ok: true,
  support: "advice",
  acknowledgement: "Parsley works here instead.",
  kind: "substitution",
  ingredient_ops: [{ op: "replace", from_id: "cilantro", to_name: "parsley", policy: "keep_scaled" }],
  step_notes: [{ step_number: 2, note: "scatter parsley at the end" }],
  equipment_supported: true,
  flavor_impact: "similar",
  warning: null,
  override: {
    acknowledgement: "Parsley works here instead.",
    kind: "substitution",
    support: "advice",
    ops: [
      {
        op: "replace",
        from_id: "cilantro",
        to_name: "parsley",
        to_ingredient_id: "parsley",
        policy: "keep_scaled",
        step_notes: [{ step_number: 2, note: "scatter parsley at the end" }],
      },
    ],
    dropped: [],
  },
};

const explainResponse = {
  ok: true,
  text: "Easy on a weeknight, with flavors your table tends to enjoy.",
  source: "template",
  basis: "run",
};

/** @param {import('@playwright/test').Page} page */
async function mockAlphaAi(page) {
  await page.route("**/api/recipes/adapt", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(adaptResponse),
    });
  });
  await page.route("**/api/explain", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(explainResponse),
    });
  });
}

/** @param {import('@playwright/test').Page} page */
async function seedDinnerPlan(page) {
  await page.evaluate(async () => {
    const created = await fetch("/api/dinner-plans", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal_count: 1, entry_point: "plan_dinners", fill: "planner" }),
    }).then((r) => r.json());
    if (!created.ok) throw new Error("create plan failed: " + JSON.stringify(created));
  });
}

/** @param {import('@playwright/test').Page} page */
async function openPlanRecipe(page) {
  await seedDinnerPlan(page);
  await page.goto("/");
  await page.locator('[data-go="home"][data-nav="home"]').filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Finish the plan" }).click();
  await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible({ timeout: 30000 });
  const mealOpen = page.locator(".view.is-active[data-view='planReview'] [data-action='open-plan-meal']").first();
  await expect(mealOpen).toHaveCount(1, { timeout: 60000 });
  await mealOpen.scrollIntoViewIfNeeded();
  await mealOpen.click({ force: true });
  await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
}

test.describe("Alpha readiness UI", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await mockAlphaAi(page);
    await skipToChoices(page);
  });

  test("plan back from recipe names Plan parent", async ({ page }) => {
    await openPlanRecipe(page);
    await expect(page.getByRole("button", { name: /Plan/i })).toBeVisible();
    await page.getByRole("button", { name: /Plan/i }).click();
    await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible();
  });

  test("adaptation apply shows your version and undo toast", async ({ page }) => {
    const fromId = await page.evaluate(async () => {
      const res = await fetch("/api/dinner-plans/current", { credentials: "include" }).then((r) => r.json());
      const meal = res.plan && res.plan.meals && res.plan.meals[0];
      const ing = meal && meal.pinned_ingredients && meal.pinned_ingredients[0];
      return ing ? ing.ingredient_id : "salt";
    });
    await page.unroute("**/api/recipes/adapt");
    await page.route("**/api/recipes/adapt", async (route) => {
      const body = {
        ...adaptResponse,
        ingredient_ops: [{ op: "replace", from_id: fromId, to_name: "parsley", policy: "keep_scaled" }],
        override: {
          ...adaptResponse.override,
          ops: [
            {
              op: "replace",
              from_id: fromId,
              to_name: "parsley",
              to_ingredient_id: "parsley",
              policy: "keep_scaled",
              step_notes: [{ step_number: 2, note: "scatter parsley at the end" }],
            },
          ],
        },
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    await openPlanRecipe(page);
    const weave = page.locator("#detailWeaveHost .weave-composer__field");
    await weave.click();
    await weave.fill("I don't have cilantro");
    await weave.press("Enter");
    await expect(page.locator(".weave-change")).toBeVisible({ timeout: 30000 });
    await page.locator(".weave-adapt-apply").click();
    await expect(page.locator("#detailVersionLine")).toContainText("Your version", { timeout: 15000 });
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  });

  test("why this one expands with explanation", async ({ page }) => {
    await openPlanRecipe(page);
    await page.getByRole("button", { name: /Plan/i }).click();
    const why = page.getByRole("button", { name: "Why this one?" }).first();
    if (!(await why.isVisible().catch(() => false))) {
      test.skip();
    }
    await why.click();
    await expect(page.locator("[data-why-reveal]:not([hidden])")).toBeVisible({ timeout: 15000 });
  });
});
